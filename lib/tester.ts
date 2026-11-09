import { chromium, Browser, Page } from 'playwright';
import { ISite } from '@/models/Site';
import { IFormTestResult } from '@/models/TestLog';
import { getOrCreateDummyUploadImage } from '@/lib/dummy-asset';

export interface TestResult {
  status: 'passed' | 'failed';
  durationMs: number;
  errorMessage?: string;
  consoleErrors: string[];
  screenshotBase64?: string;
  formResults?: IFormTestResult[];
}

export interface SiteTestResult {
  status: 'passed' | 'failed';
  durationMs: number;
  errorMessage?: string;
  consoleErrors: string[];
  screenshotBase64?: string;
  formResults: IFormTestResult[];
}

export async function runFormTest(site: ISite | any): Promise<TestResult> {
  const startTime = Date.now();
  const consoleErrors: string[] = [];
  let browser: Browser | null = null;
  let page: Page | null = null;

  try {
    // 1. Launch headless Chromium
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
      ],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 FormGuardPro/1.0',
    });

    page = await context.newPage();

    // 2. Attach error listeners for JS runtime errors and console errors
    page.on('pageerror', (exception) => {
      consoleErrors.push(`[PageError] ${exception.message || String(exception)}`);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[ConsoleError] ${msg.text()}`);
      }
    });

    // 3. Navigate to target URL
    try {
      await page.goto(site.url, {
        waitUntil: 'networkidle',
        timeout: 30000,
      });
    } catch {
      // If networkidle times out due to persistent websocket or analytics polling, fallback to domcontentloaded
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    }

    // Give dynamic JS scripts (Elementor, reCAPTCHA, CF7, etc.) 1s to settle
    await page.waitForTimeout(1000);

    // 4. Fill form fields
    if (site.fields && Array.isArray(site.fields) && site.fields.length > 0) {
      for (const field of site.fields) {
        if (!field.selector) continue;

        try {
          const locator = page.locator(field.selector).first();
          await locator.waitFor({ state: 'attached', timeout: 10000 });
          await locator.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});

          const fieldType = (field.type || 'text').toLowerCase();
          const valToFill = field.testValue || 'Test Value';
          const wantsRandom = !valToFill || valToFill === '[Random Option]' || valToFill.toLowerCase().includes('random');

          const inputTypeAttr = await locator.getAttribute('type').catch(() => null);
          const isHidden = inputTypeAttr === 'hidden';
          const isSelectType = fieldType === 'select';
          const isFileType = fieldType === 'file' || inputTypeAttr === 'file';

          // Check if custom dropdown container (like MetForm/React-Select/Elementor custom select) exists
          const customControl = locator.locator('xpath=..').locator('.mf_select__control, .mf-input-select, [class*="select__control"], [class*="custom-select"]').first();
          const hasCustomControl = (await customControl.count().catch(() => 0)) > 0;

          if (isFileType) {
            // Automatically upload dummy black image for media/file upload fields
            const dummyFilePath = getOrCreateDummyUploadImage();
            await locator.setInputFiles(dummyFilePath, { timeout: 8000 });
          } else if (hasCustomControl || (isSelectType && isHidden)) {
            // Modern AJAX / MetForm dropdown handling with live random option picking
            try {
              const clickTarget = hasCustomControl
                ? customControl
                : page.locator('.mf_select__control, .mf-input-select').first();

              await clickTarget.click({ timeout: 4000 });
              await page.waitForTimeout(300);

              const optionLocators = page.locator(
                '[class*="option"], [id*="react-select"][id*="option"], .select-options li, .dropdown-menu li'
              );
              const optCount = await optionLocators.count();

              if (optCount > 0) {
                let chosenIdx = Math.floor(Math.random() * optCount);
                if (!wantsRandom) {
                  for (let i = 0; i < optCount; i++) {
                    const optText = (await optionLocators.nth(i).textContent()) || '';
                    if (optText.toLowerCase().includes(valToFill.trim().toLowerCase())) {
                      chosenIdx = i;
                      break;
                    }
                  }
                }
                await optionLocators.nth(chosenIdx).click({ timeout: 4000 });
              }
            } catch {
              // Fallback: evaluate value directly
              await locator.evaluate((el: HTMLInputElement, val: string) => {
                el.value = val === '[Random Option]' ? 'General Inquiry' : val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
              }, valToFill);
            }
          } else if (isSelectType) {
            // Standard native <select> element with random option selection
            try {
              const options = await locator.locator('option').all();
              const validIndices: number[] = [];

              for (let i = 0; i < options.length; i++) {
                const optText = ((await options[i].textContent()) || '').trim();
                const optVal = ((await options[i].getAttribute('value')) || '').trim();
                const isDis = await options[i].isDisabled();
                const isPlaceholder =
                  optText.toLowerCase().includes('select') ||
                  optText.toLowerCase().includes('choose') ||
                  optText === '' ||
                  optText.startsWith('--');

                if (!isDis && (optVal || optText) && !isPlaceholder) {
                  validIndices.push(i);
                }
              }

              if (wantsRandom && validIndices.length > 0) {
                const randomIdx = validIndices[Math.floor(Math.random() * validIndices.length)];
                await locator.selectOption({ index: randomIdx });
              } else {
                await locator.selectOption(valToFill).catch(async () => {
                  const fallbackIdx = validIndices.length > 0 ? validIndices[0] : 1;
                  await locator.selectOption({ index: fallbackIdx });
                });
              }
            } catch {
              await locator.selectOption({ index: 1 }).catch(() => {});
            }
          } else if (isHidden) {
            await locator.evaluate((el: HTMLInputElement, val: string) => {
              el.value = val;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }, valToFill);
          } else {
            switch (fieldType) {
              case 'checkbox':
                if (valToFill === 'true' || valToFill === '1' || valToFill === 'checked' || !valToFill) {
                  await locator.check({ force: true });
                } else {
                  await locator.uncheck({ force: true });
                }
                break;

              case 'file': {
                const dummyFilePath = getOrCreateDummyUploadImage();
                await locator.setInputFiles(dummyFilePath, { timeout: 8000 });
                break;
              }

              case 'textarea':
              case 'text':
              case 'email':
              case 'tel':
              default:
                await locator.fill(valToFill, { timeout: 8000 });
                break;
            }
          }
        } catch (fieldErr: any) {
          throw new Error(
            `Failed to interact with field "${field.label || field.selector}": ${
              fieldErr.message || String(fieldErr)
            }`
          );
        }
      }
    }

    // 5. Click Submit Button
    if (!site.submitButtonSelector) {
      throw new Error('Submit button selector is not configured.');
    }

    const submitBtn = page.locator(site.submitButtonSelector).first();
    try {
      await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
      await submitBtn.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      await submitBtn.click({ timeout: 8000 });
    } catch (btnErr: any) {
      throw new Error(
        `Failed to click submit button (${site.submitButtonSelector}): ${
          btnErr.message || String(btnErr)
        }`
      );
    }

    // 6. Verify Submission
    const verifyMethod = site.verificationMethod || 'text_visible';
    const expectedVal = site.expectedSuccessValue?.trim();

    if (!expectedVal) {
      throw new Error('Expected success verification value is empty.');
    }

    switch (verifyMethod) {
      case 'text_visible': {
        const textLocator = page.getByText(expectedVal, { exact: false }).first();
        try {
          await textLocator.waitFor({ state: 'visible', timeout: 15000 });
        } catch {
          throw new Error(
            `Verification failed: Text "${expectedVal}" was not visible within 15 seconds after submission.`
          );
        }
        break;
      }

      case 'selector_visible': {
        const selectorLocator = page.locator(expectedVal).first();
        try {
          await selectorLocator.waitFor({ state: 'visible', timeout: 15000 });
        } catch {
          throw new Error(
            `Verification failed: Selector "${expectedVal}" was not found or visible within 15 seconds after submission.`
          );
        }
        break;
      }

      case 'url_redirect': {
        try {
          await page.waitForURL((url) => url.href.includes(expectedVal), {
            timeout: 15000,
          });
        } catch {
          const currentUrl = page.url();
          throw new Error(
            `Verification failed: Redirect URL did not include "${expectedVal}". Current URL: ${currentUrl}`
          );
        }
        break;
      }

      default:
        throw new Error(`Unsupported verification method: ${verifyMethod}`);
    }

    // If we reached here, form submission succeeded!
    const durationMs = Date.now() - startTime;
    return {
      status: 'passed',
      durationMs,
      consoleErrors: consoleErrors.slice(-10), // keep recent 10 errors if any
      screenshotBase64: '',
    };
  } catch (err: any) {
    const durationMs = Date.now() - startTime;
    const errorMessage = err.message || 'Unknown form test execution failure.';

    let screenshotBase64 = '';
    if (page) {
      try {
        const buffer = await page.screenshot({
          fullPage: false,
          timeout: 5000,
        });
        screenshotBase64 = buffer.toString('base64');
      } catch (screenErr) {
        console.error('Failed to capture failure screenshot:', screenErr);
      }
    }

    return {
      status: 'failed',
      durationMs,
      errorMessage,
      consoleErrors: consoleErrors.slice(-10),
      screenshotBase64,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (closeErr) {
        console.error('Error closing browser:', closeErr);
      }
    }
  }
}

export async function runSiteTest(site: ISite | any): Promise<SiteTestResult> {
  const startTime = Date.now();
  const formResults: IFormTestResult[] = [];
  const allConsoleErrors: string[] = [];

  // Determine forms to test
  let formsToTest: any[] = [];
  if (site.forms && Array.isArray(site.forms) && site.forms.length > 0) {
    formsToTest = site.forms.filter((f: any) => f.isActive !== false);
  }

  // Fallback for single-form sites or if no active sub-forms
  if (formsToTest.length === 0) {
    formsToTest = [
      {
        id: site._id?.toString() || 'default-form',
        name: site.name || 'Primary Form',
        pageUrl: site.url,
        formPluginType: site.formPluginType || 'Custom',
        fields: site.fields || [],
        submitButtonSelector: site.submitButtonSelector,
        verificationMethod: site.verificationMethod,
        expectedSuccessValue: site.expectedSuccessValue,
        isActive: site.isActive !== false,
      },
    ];
  }

  let overallStatus: 'passed' | 'failed' = 'passed';
  let primaryErrorMessage = '';
  let primaryScreenshotBase64 = '';

  for (const form of formsToTest) {
    // Construct single form test payload
    const formPayload = {
      url: form.pageUrl || site.url,
      fields: form.fields,
      submitButtonSelector: form.submitButtonSelector,
      verificationMethod: form.verificationMethod,
      expectedSuccessValue: form.expectedSuccessValue,
      name: `${site.name} — ${form.name || 'Form'}`,
    };

    const res = await runFormTest(formPayload);

    formResults.push({
      formId: form.id || form._id?.toString(),
      formName: form.name || 'Form',
      pageUrl: form.pageUrl || site.url,
      status: res.status,
      durationMs: res.durationMs,
      errorMessage: res.errorMessage || '',
      consoleErrors: res.consoleErrors || [],
      screenshotBase64: res.screenshotBase64 || '',
    });

    if (res.consoleErrors && res.consoleErrors.length > 0) {
      allConsoleErrors.push(...res.consoleErrors);
    }

    if (res.status === 'failed') {
      overallStatus = 'failed';
      if (!primaryErrorMessage) {
        primaryErrorMessage = `Form "${form.name || 'Form'}" failed: ${res.errorMessage}`;
        primaryScreenshotBase64 = res.screenshotBase64 || '';
      }
    }
  }

  const totalDurationMs = Date.now() - startTime;

  return {
    status: overallStatus,
    durationMs: totalDurationMs,
    errorMessage: primaryErrorMessage,
    consoleErrors: Array.from(new Set(allConsoleErrors)).slice(-15),
    screenshotBase64: primaryScreenshotBase64,
    formResults,
  };
}

