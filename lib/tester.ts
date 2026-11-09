import { chromium, Browser, Page } from 'playwright';
import { ISite } from '@/models/Site';

export interface TestResult {
  status: 'passed' | 'failed';
  durationMs: number;
  errorMessage?: string;
  consoleErrors: string[];
  screenshotBase64?: string;
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

          switch (fieldType) {
            case 'select':
              await locator.selectOption(valToFill).catch(async () => {
                // If value doesn't match, select first available non-empty option
                await locator.selectOption({ index: 1 });
              });
              break;

            case 'checkbox':
              if (valToFill === 'true' || valToFill === '1' || valToFill === 'checked' || !valToFill) {
                await locator.check({ force: true });
              } else {
                await locator.uncheck({ force: true });
              }
              break;

            case 'textarea':
            case 'text':
            case 'email':
            case 'tel':
            default:
              await locator.fill(valToFill, { timeout: 8000 });
              break;
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

