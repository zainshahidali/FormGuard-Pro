import { NextRequest, NextResponse } from 'next/server';
import { chromium, Browser, Page } from 'playwright';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  let browser: Browser | null = null;
  try {
    const body = await req.json();
    const { url } = body;

    if (!url || !url.startsWith('http')) {
      return NextResponse.json(
        { success: false, error: 'A valid http/https URL is required' },
        { status: 400 }
      );
    }

    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 FormGuardPro/1.0',
    });

    const page: Page = await context.newPage();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      await page.waitForTimeout(2500); // Give JS time to mount widgets (MetForm, Elementor, WPForms)
    } catch (navErr: any) {
      return NextResponse.json(
        { success: false, error: `Failed to load page: ${navErr.message || String(navErr)}` },
        { status: 400 }
      );
    }

    // Inspect the DOM for all forms and form plugins
    const detectedForms = await page.evaluate(() => {
      const formContainers: any[] = [];
      const rawForms = Array.from(document.querySelectorAll('form'));
      rawForms.forEach((f) => {
        const idOrClass = (String(f.className || '') + ' ' + String(f.id || '') + ' ' + String(f.getAttribute('action') || '')).toLowerCase();
        if (!idOrClass.includes('search') && !idOrClass.includes('admin-bar')) {
          formContainers.push(f);
        }
      });

      document.querySelectorAll('.metform-form-content').forEach((mf) => {
        if (!formContainers.some((f) => f.contains(mf) || f === mf)) {
          formContainers.push(mf);
        }
      });

      return formContainers.map((container, index) => {
        const formClasses = String(container.className || '');
        const formId = String(container.id || '');

        let detectedPlugin = 'Custom';
        let expectedSuccessValue = 'Thank you';
        let verificationMethod = 'text_visible';

        if (formClasses.includes('metform') || container.querySelector('.metform-form-content') || document.querySelector('.metform-form-content')) {
          detectedPlugin = 'MetForm';
          verificationMethod = 'selector_visible';
          expectedSuccessValue = '.metform-success-message, .mf-response-msg-wrap';
        } else if (formClasses.includes('elementor-form') || container.closest('.elementor-widget-form')) {
          detectedPlugin = 'Elementor Pro';
          verificationMethod = 'selector_visible';
          expectedSuccessValue = '.elementor-message-success';
        } else if (formClasses.includes('wpcf7')) {
          detectedPlugin = 'Contact Form 7';
          verificationMethod = 'selector_visible';
          expectedSuccessValue = '.wpcf7-mail-sent-ok, .wpcf7-response-output';
        } else if (formClasses.includes('wpforms')) {
          detectedPlugin = 'WPForms';
          verificationMethod = 'selector_visible';
          expectedSuccessValue = 'div.wpforms-confirmation-container-full';
        } else if (formClasses.includes('gform') || formId.startsWith('gform_')) {
          detectedPlugin = 'Gravity Forms';
          verificationMethod = 'selector_visible';
          expectedSuccessValue = 'div.gform_confirmation_message';
        }

        // Title
        let formTitle = '';
        const nearbyHeading =
          container.querySelector('h1, h2, h3, h4, .elementor-heading-title') ||
          container.closest('section, div.elementor-section, div.elementor-column')?.querySelector('h2, h3, h4, .elementor-heading-title');

        if (nearbyHeading && nearbyHeading.textContent?.trim()) {
          formTitle = nearbyHeading.textContent.trim().replace(/\s+/g, ' ');
        }
        if (!formTitle) {
          formTitle = `Form #${index + 1} (${detectedPlugin})`;
        } else {
          formTitle = `${formTitle} (${detectedPlugin})`;
        }

        // Query all inputs, selects, textareas (including custom dropdown hidden values)
        const inputElements = Array.from(
          container.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select')
        );

        const fields: any[] = [];
        const seenNames = new Set();

        inputElements.forEach((el: any) => {
          const tagName = el.tagName.toLowerCase();
          const typeAttr = (el.getAttribute('type') || (tagName === 'textarea' ? 'textarea' : 'text')).toLowerCase();
          const nameAttr = el.getAttribute('name') || '';
          const idAttr = el.getAttribute('id') || '';
          const placeholder = el.getAttribute('placeholder') || '';

          // Skip WordPress system hidden fields (nonces, referrers, form IDs)
          if (typeAttr === 'hidden') {
            const lowerName = nameAttr.toLowerCase();
            const isSystemHidden =
              lowerName.includes('nonce') ||
              lowerName.includes('referer') ||
              lowerName.includes('form_id') ||
              lowerName === 'action' ||
              lowerName.startsWith('_');
            if (isSystemHidden) return;
          }

          // Skip react-select internal dummy inputs without name
          if (idAttr.includes('react-select') && !nameAttr) {
            return;
          }

          // Deduplicate fields in same form
          const fieldKey = nameAttr || idAttr || placeholder;
          if (fieldKey && seenNames.has(fieldKey)) {
            return;
          }
          if (fieldKey) seenNames.add(fieldKey);

          // Find label
          let labelText = '';
          if (idAttr) {
            const labelEl = document.querySelector(`label[for="${idAttr}"]`);
            if (labelEl) labelText = labelEl.textContent?.trim() || '';
          }
          if (!labelText) {
            const parentLabel = el.closest('label');
            if (parentLabel) labelText = parentLabel.textContent?.trim() || '';
          }
          if (!labelText) {
            // Check wrapper label or placeholder
            const wrapper = el.closest('.mf-input-wrapper, .elementor-field-group, .wpforms-field');
            if (wrapper) {
              const wLabel = wrapper.querySelector('label, .mf-input-label, [class*="placeholder"]');
              if (wLabel) labelText = wLabel.textContent?.trim() || '';
            }
          }
          if (!labelText) {
            labelText = placeholder || nameAttr || idAttr || 'Field';
          }
          labelText = labelText.replace(/[*:]/g, '').trim();

          // Resilient CSS selector
          let selector = '';
          if (nameAttr) {
            selector = `input[name="${nameAttr}"], textarea[name="${nameAttr}"], select[name="${nameAttr}"]`;
          } else if (idAttr) {
            selector = `#${idAttr}`;
          } else if (placeholder) {
            selector = `[placeholder*="${placeholder.trim()}"]`;
          } else {
            selector = `${tagName}`;
          }

          // Type & sensible test value
          let fieldType = 'text';
          let testValue = 'FormGuard QA Bot';

          if (typeAttr === 'email' || nameAttr.toLowerCase().includes('email')) {
            fieldType = 'email';
            testValue = 'qa-bot@formguardpro.com';
          } else if (typeAttr === 'tel' || nameAttr.toLowerCase().includes('phone') || nameAttr.toLowerCase().includes('tel')) {
            fieldType = 'tel';
            testValue = '+1 555-019-2834';
          } else if (tagName === 'textarea' || nameAttr.toLowerCase().includes('message')) {
            fieldType = 'textarea';
            testValue = 'FormGuard Pro automated health check test submission.';
          } else if (tagName === 'select' || nameAttr.toLowerCase().includes('service') || typeAttr === 'hidden') {
            fieldType = 'select';
            testValue = '[Random Option]';
          } else if (typeAttr === 'checkbox') {
            fieldType = 'checkbox';
            testValue = 'true';
          }

          fields.push({
            label: labelText,
            selector,
            type: fieldType,
            testValue,
          });
        });

        // Submit Button
        let submitButtonSelector = 'button[type="submit"], input[type="submit"], .metform-btn';
        const submitBtn =
          container.querySelector('button[type="submit"]') ||
          container.querySelector('input[type="submit"]') ||
          container.querySelector('.metform-btn') ||
          container.querySelector('.elementor-button[type="submit"]') ||
          container.querySelector('.wpcf7-submit') ||
          container.querySelector('.wpforms-submit');

        if (submitBtn && submitBtn.className) {
          const classes = String(submitBtn.className).split(' ').filter((c: string) => c && !c.includes('active') && !c.includes('hover'));
          if (classes.length > 0) {
            submitButtonSelector = `button.${classes[0]}, input.${classes[0]}, button[type="submit"], .metform-btn`;
          }
        }

        return {
          id: `form-${index}`,
          title: formTitle,
          detectedPlugin,
          fields,
          submitButtonSelector,
          verificationMethod,
          expectedSuccessValue,
        };
      });
    });

    if (!detectedForms || detectedForms.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'No active HTML form was detected on the specified URL. Please configure selectors manually.',
      });
    }

    return NextResponse.json({
      success: true,
      forms: detectedForms,
      count: detectedForms.length,
    });
  } catch (error: any) {
    console.error('Error inspecting form URL:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to inspect URL' },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
