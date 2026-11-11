import { chromium, Browser, Page, Locator } from 'playwright';
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

// Header the client's WordPress site checks to skip CAPTCHA for FormGuard test submissions.
export const CAPTCHA_BYPASS_HEADER = 'X-FormGuard-Key';

const FORM_ERROR_SELECTORS = [
  // WPForms
  '[class*="wpforms-error-container"]',
  '.wpforms-error',
  '.wpforms-form [role="alert"]',
  // Contact Form 7
  '.wpcf7-not-valid-tip',
  '.wpcf7 form.invalid .wpcf7-response-output',
  '.wpcf7 form.spam .wpcf7-response-output',
  '.wpcf7 form.failed .wpcf7-response-output',
  // Elementor / MetForm
  '.elementor-message-danger',
  '.metform-error',
  '.mf-error-message',
  '.mf-main-response-wrap.mf-error-res',
  // Gravity Forms
  '.gform_validation_errors',
  '.gfield_validation_message',
  '.validation_message',
].join(', ');

const CAPTCHA_PATTERN = /re-?captcha|h-?captcha|turnstile|captcha|verify (that )?you are (a )?human|spam/i;

function normalizeHost(u: string): string {
  try {
    return new URL(u).hostname.toLowerCase().replace(/^www\./, '');
  } catch {
    return '';
  }
}

/**
 * Adds the CAPTCHA bypass header to POST requests sent to the client's own site only.
 * The secret is never sent to Google, analytics, CDNs or any other third party.
 */
async function attachCaptchaBypassHeader(page: Page, siteUrl: string, key: string) {
  const siteHost = normalizeHost(siteUrl);
  if (!siteHost) return;

  await page.route(
    (url) => normalizeHost(url.href) === siteHost,
    async (route) => {
      const request = route.request();
      if (request.method() !== 'POST') {
        return route.continue();
      }
      return route.continue({
        headers: { ...request.headers(), [CAPTCHA_BYPASS_HEADER.toLowerCase()]: key },
      });
    }
  );
}

/** Returns every visible, non-empty error message rendered by the form builder. */
async function collectVisibleFormErrors(page: Page): Promise<string[]> {
  const messages = await page
    .evaluate((selectors) => {
      const seen = new Set<string>();
      const out: string[] = [];
      document.querySelectorAll(selectors).forEach((el) => {
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return;
        const text = (el.textContent || '')
          .replace(/\s+/g, ' ')
          .replace(/^Form error message\s*/i, '')
          .trim();
        if (text && !seen.has(text)) {
          seen.add(text);
          out.push(text);
        }
      });
      return out;
    }, FORM_ERROR_SELECTORS)
    .catch(() => [] as string[]);

  // Drop messages fully contained in a longer one (e.g. container text that repeats a field error).
  return messages.filter((m) => !messages.some((other) => other !== m && other.includes(m)));
}

/** Builds a readable error describing why the form rejected the submission. */
function buildSubmissionBlockedError(errors: string[], bypassKeyConfigured: boolean): Error {
  const captchaMsg = errors.find((e) => CAPTCHA_PATTERN.test(e));

  if (captchaMsg) {
    const score = captchaMsg.match(/\((0(?:\.\d+)?|1(?:\.0+)?)\)/)?.[1];
    const advice = bypassKeyConfigured
      ? 'A CAPTCHA bypass key is configured for this site, but the site still enforced CAPTCHA. Check that the FormGuard snippet is installed on the WordPress site and that its key matches.'
      : 'The form most likely works for real visitors, but the anti-spam check rejected the automated browser. Add a CAPTCHA bypass key in this site\'s settings and install the FormGuard snippet on the WordPress site.';
    return new Error(
      `Blocked by CAPTCHA${score ? ` (score ${score})` : ''}: ${advice} Site message: "${captchaMsg}"`
    );
  }

  return new Error(
    `WordPress form validation blocked submission: ${errors.map((e) => `"${e}"`).join(' | ')}`
  );
}

/**
 * Resolves the exact form to test. When a page holds several forms with identical field names
 * (e.g. "Contact Form" + "Get A Quote", or desktop/mobile copies), page-wide selectors would hit
 * whichever comes first in the HTML. The scope pins the test to the form's own plugin ID, and
 * prefers the copy that is actually rendered for visitors.
 */
async function resolveFormRoot(page: Page, scopeSelector?: string): Promise<Page | Locator> {
  const scope = (scopeSelector || '').trim();
  if (!scope) return page;

  const candidates = page.locator(scope);
  await candidates.first().waitFor({ state: 'attached', timeout: 10000 }).catch(() => {});
  const count = await candidates.count().catch(() => 0);
  if (count === 0) {
    throw new Error(
      `Form not found on the page (looked for ${scope}). The form may have been removed, replaced with a new form, or moved to another page. Re-scan the website to update it.`
    );
  }

  for (let i = 0; i < count; i++) {
    const rendered = await candidates
      .nth(i)
      .evaluate((el) =>
        Array.from(el.querySelectorAll('input:not([type="hidden"]), textarea, select')).some((f) => {
          const r = f.getBoundingClientRect();
          return r.width > 20 && r.height > 10;
        })
      )
      .catch(() => false);
    if (rendered) return candidates.nth(i);
  }
  return candidates.first();
}

interface SubmissionVerdict {
  ok: boolean;
  plugin: string;
  message: string;
}

// Raw reply of the most recent form submission request, kept for failure diagnostics.
let lastSubmissionResponse = '';

/** Identifies the form builder's submission request (REST / admin-ajax), or null for unrelated traffic. */
function detectSubmissionPlugin(url: string, method: string, postData: string): string | null {
  if (method !== 'POST') return null;
  if (/\/metform\/v1\/entries\/insert\//.test(url)) return 'MetForm';
  if (/\/contact-form-7\/v1\/contact-forms\/\d+\/feedback/.test(url)) return 'Contact Form 7';
  if (/admin-ajax\.php/.test(url)) {
    if (/elementor_pro_forms_send_form/.test(postData)) return 'Elementor Pro';
    if (/wpforms_submit/.test(postData)) return 'WPForms';
  }
  return null;
}

function flattenMessages(value: any): string {
  if (!value) return '';
  if (typeof value === 'string') {
    return value
      .replace(/<span[^>]*class="[^"]*wpforms-hidden[^"]*"[^>]*>[\s\S]*?<\/span>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  if (Array.isArray(value)) return value.map(flattenMessages).filter(Boolean).join(' | ');
  if (typeof value === 'object') return Object.values(value).map(flattenMessages).filter(Boolean).join(' | ');
  return String(value);
}

/** Turns an HTML error page (e.g. WordPress "critical error" screen) into a short readable message. */
function summarizeHtmlError(raw: string): string {
  if (!raw) return '';
  if (!/<html|<!doctype/i.test(raw)) return raw.slice(0, 200);
  const title = (raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] || '')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const body = (raw.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] || raw)
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&[a-z#0-9]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return [title, body].filter(Boolean).join(' — ').slice(0, 300);
}

function httpFailureHint(status: number): string {
  if (status >= 500) {
    return 'WordPress crashed (PHP fatal error) while processing the submission, so no entry/email was completed. This is usually caused by a plugin hooked into form submission or email sending (SMTP/mail plugin, MetForm integrations, CRM/webhook add-ons) or a PHP version conflict. Check the WordPress debug log or the hosting error log for the exact error.';
  }
  if (status === 401 || status === 403) {
    return 'This often means a cached/expired security nonce (page cache such as LiteSpeed/WP Rocket) or a security plugin/firewall blocking the request.';
  }
  return 'The site refused the submission request.';
}

/**
 * Waits for the form builder's own submission response and reads its verdict.
 * This is the source of truth: a visible "response" box can appear for errors too.
 * Resolves to null if no recognised submission request is seen.
 */
function watchSubmissionResponse(page: Page, timeoutMs: number): Promise<SubmissionVerdict | null> {
  return page
    .waitForResponse(
      (res) => {
        const req = res.request();
        return !!detectSubmissionPlugin(req.url(), req.method(), req.postData() || '');
      },
      { timeout: timeoutMs }
    )
    .then(async (res) => {
      const req = res.request();
      const plugin = detectSubmissionPlugin(req.url(), req.method(), req.postData() || '') || 'Form';
      const raw = await res.text().catch(() => '');
      lastSubmissionResponse = `[FormResponse] ${plugin} HTTP ${res.status()}: ${raw.replace(/\s+/g, ' ').slice(0, 400)}`;
      let json: any = null;
      try {
        json = JSON.parse(raw);
      } catch {}

      if (res.status() >= 400) {
        const detail = flattenMessages(json?.message || json?.data?.message || json?.error) || summarizeHtmlError(raw);
        return {
          ok: false,
          plugin,
          message: `${plugin} rejected the submission (HTTP ${res.status()})${detail ? `: "${detail}"` : ''}. ${httpFailureHint(res.status())}`,
        };
      }
      if (!json) return null;

      switch (plugin) {
        case 'MetForm': {
          // MetForm pre-fills `error` with a default "Something went wrong." and leaves it there on
          // success, so only `status` decides the outcome.
          const errors = flattenMessages(json.error);
          if (Number(json.status) !== 1) {
            return { ok: false, plugin, message: `MetForm rejected the submission: "${errors || flattenMessages(json.data?.message) || 'unknown error'}"` };
          }
          return { ok: true, plugin, message: flattenMessages(json.data?.message) };
        }
        case 'Contact Form 7': {
          if (json.status !== 'mail_sent') {
            const hint = json.status === 'mail_failed' ? ' The submission was received but WordPress failed to send the email (check SMTP / mail settings).' : '';
            return { ok: false, plugin, message: `Contact Form 7 returned "${json.status}": "${flattenMessages(json.message)}".${hint}` };
          }
          return { ok: true, plugin, message: flattenMessages(json.message) };
        }
        case 'Elementor Pro':
        case 'WPForms': {
          if (json.success === false) {
            return { ok: false, plugin, message: `${plugin} rejected the submission: "${flattenMessages(json.data?.message || json.data?.errors || json.data) || 'unknown error'}"` };
          }
          return { ok: true, plugin, message: flattenMessages(json.data?.message) };
        }
      }
      return null;
    })
    .catch(() => null);
}

export async function runFormTest(site: ISite | any): Promise<TestResult> {
  const startTime = Date.now();
  const consoleErrors: string[] = [];
  lastSubmissionResponse = '';
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

    const bypassKey = String(site.captchaBypassKey || '').trim();
    if (bypassKey) {
      await attachCaptchaBypassHeader(page, site.url, bypassKey);
    }

    // 2. Attach error listeners for JS runtime errors and console errors
    page.on('pageerror', (exception) => {
      consoleErrors.push(`[PageError] ${exception.message || String(exception)}`);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[ConsoleError] ${msg.text()}`);
      }
    });

    // Count how many real submission requests the form sends, to detect double submissions.
    let submissionRequestCount = 0;
    page.on('request', (req) => {
      if (detectSubmissionPlugin(req.url(), req.method(), req.postData() || '')) {
        submissionRequestCount++;
      }
    });
    const noteDoubleSubmission = () => {
      if (submissionRequestCount > 1) {
        consoleErrors.push(
          `[Warning] The form sent ${submissionRequestCount} submission requests for a single click on Submit. The website is double-submitting (duplicate entries/emails for real visitors too).`
        );
      }
    };

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
    if (!site.fields || !Array.isArray(site.fields) || site.fields.length === 0) {
      throw new Error(
        `Form "${site.name || 'Form'}" has no input fields configured. Please edit the website, inspect forms, and import input fields before testing.`
      );
    }

    const formRoot = await resolveFormRoot(page, site.scopeSelector);

    for (const field of site.fields) {
        if (!field.selector) continue;

        try {
          const locator = formRoot.locator(field.selector).first();
          await locator.waitFor({ state: 'attached', timeout: 10000 });
          await locator.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});

          const fieldType = (field.type || 'text').toLowerCase();
          // The global "test submission email" (Settings) replaces the saved value in every email field.
          const globalTestEmail = String(site.testEmail || '').trim();
          const valToFill =
            (fieldType === 'email' && globalTestEmail) ||
            field.testValue ||
            (fieldType === 'email'
              ? 'test@gmail.com'
              : fieldType === 'textarea'
              ? 'Testing'
              : 'Test User');
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
                : formRoot.locator('.mf_select__control, .mf-input-select').first();

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

    // 5. Click Submit Button
    if (!site.submitButtonSelector) {
      throw new Error('Submit button selector is not configured.');
    }

    const submitBtn = formRoot.locator(site.submitButtonSelector).first();
    let submissionVerdict: Promise<SubmissionVerdict | null> = Promise.resolve(null);
    try {
      await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
      await submitBtn.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
      // Start listening before the click so the response can't be missed.
      submissionVerdict = watchSubmissionResponse(page, 20000);
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

    let domVerificationError: any = null;
    try {
    // Wait briefly for WordPress form handlers to process/validate
    await page.waitForTimeout(800);

    // Check if WordPress or form builder flagged an immediate validation / anti-spam error
    const detectedFormErrors = await collectVisibleFormErrors(page);
    if (detectedFormErrors.length > 0) {
      throw buildSubmissionBlockedError(detectedFormErrors, !!bypassKey);
    }

    switch (verifyMethod) {
      case 'text_visible': {
        // Look for the success text in alert/confirmation containers or the active form area to prevent matching unrelated page text/reviews
        const successMessageLocator = page.locator(
          `[class*="success"], [class*="confirm"], [class*="message"], [class*="response"], [class*="alert"], [role="alert"], .wpforms-confirmation-container-full, .elementor-message-success, .metform-success-message, .wpcf7-response-output`
        ).filter({ hasText: expectedVal }).first();

        try {
          await successMessageLocator.waitFor({ state: 'visible', timeout: 12000 });
        } catch {
          // Check if an error message appeared on the page
          const errorsOnPage = await collectVisibleFormErrors(page);
          if (errorsOnPage.length > 0) {
            throw buildSubmissionBlockedError(errorsOnPage, !!bypassKey);
          }

          // If specialized alert container is not found, check if text appeared in the form or main area
          const textLocator = page.locator('form, [class*="form"], main, article').getByText(expectedVal, { exact: false }).first();
          try {
            await textLocator.waitFor({ state: 'visible', timeout: 5000 });
          } catch {
            throw new Error(
              `Verification failed: Success message "${expectedVal}" was not visible within 15 seconds after submission.`
            );
          }
        }
        break;
      }

      case 'selector_visible': {
        const selectorLocator = page.locator(expectedVal).first();
        try {
          await selectorLocator.waitFor({ state: 'visible', timeout: 15000 });
        } catch {
          // Check if an error message appeared on the page (e.g. CAPTCHA rejection, anti-spam token expired)
          const errorsOnPage = await collectVisibleFormErrors(page);
          if (errorsOnPage.length > 0) {
            throw buildSubmissionBlockedError(errorsOnPage, !!bypassKey);
          }

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
    } catch (verifyErr) {
      domVerificationError = verifyErr;
    }

    // The form builder's own server response is the source of truth. A visible
    // "response" element can show for errors too (e.g. MetForm's .mf-response-msg-wrap).
    const verdict = await submissionVerdict;
    noteDoubleSubmission();
    if (verdict && !verdict.ok) {
      throw CAPTCHA_PATTERN.test(verdict.message)
        ? buildSubmissionBlockedError([verdict.message], !!bypassKey)
        : new Error(verdict.message);
    }
    if (domVerificationError) {
      throw domVerificationError;
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
      // Include the form plugin's raw server reply so failures can be diagnosed from facts.
      consoleErrors: [...consoleErrors.slice(-10), ...(lastSubmissionResponse ? [lastSubmissionResponse] : [])],
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

/**
 * A form is tested once per run, on one page, no matter how many pages show it.
 * Forms are identified by their plugin form ID (scopeSelector). Forms without one are kept as-is,
 * because two different forms can share identical fields.
 */
export function uniqueFormsToTest<T extends { scopeSelector?: string }>(forms: T[]): T[] {
  const seen = new Set<string>();
  return forms.filter((form) => {
    const key = (form.scopeSelector || '').trim();
    if (!key) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function runSiteTest(
  site: ISite | any,
  options: { testEmail?: string } = {}
): Promise<SiteTestResult> {
  const startTime = Date.now();
  const formResults: IFormTestResult[] = [];
  const allConsoleErrors: string[] = [];

  // Determine forms to test
  let formsToTest: any[] = [];
  if (site.forms && Array.isArray(site.forms) && site.forms.length > 0) {
    formsToTest = uniqueFormsToTest(site.forms.filter((f: any) => f.isActive !== false));
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
      scopeSelector: form.scopeSelector || '',
      name: `${site.name} — ${form.name || 'Form'}`,
      captchaBypassKey: site.captchaBypassKey || '',
      testEmail: options.testEmail || '',
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

