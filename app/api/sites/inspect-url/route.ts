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
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForTimeout(1500); // Allow dynamic scripts to mount
    } catch (navErr: any) {
      return NextResponse.json(
        { success: false, error: `Failed to load page: ${navErr.message || String(navErr)}` },
        { status: 400 }
      );
    }

    // Inspect the DOM for forms and form plugins
    const inspectionResult = await page.evaluate(() => {
      // Find all forms excluding search forms
      const forms = Array.from(document.querySelectorAll('form')).filter((f) => {
        const idOrClass = (f.className + ' ' + f.id + ' ' + (f.getAttribute('action') || '')).toLowerCase();
        return !idOrClass.includes('search') && !idOrClass.includes('admin-bar');
      });

      if (forms.length === 0) {
        return null;
      }

      // Select the most relevant contact form
      const form = forms[0];
      const formClasses = form.className || '';
      const formId = form.id || '';

      // 1. Detect Plugin Type
      let detectedPlugin: 'Elementor Pro' | 'Contact Form 7' | 'MetForm' | 'WPForms' | 'Gravity Forms' | 'Custom' = 'Custom';
      let expectedSuccessValue = 'Thank you';
      let verificationMethod: 'text_visible' | 'selector_visible' | 'url_redirect' = 'text_visible';

      if (formClasses.includes('elementor-form') || document.querySelector('.elementor-widget-form')) {
        detectedPlugin = 'Elementor Pro';
        verificationMethod = 'selector_visible';
        expectedSuccessValue = '.elementor-message-success';
      } else if (formClasses.includes('wpcf7-form') || document.querySelector('.wpcf7')) {
        detectedPlugin = 'Contact Form 7';
        verificationMethod = 'selector_visible';
        expectedSuccessValue = '.wpcf7-mail-sent-ok, .wpcf7-response-output';
      } else if (formClasses.includes('metform-form') || document.querySelector('.metform-form-content')) {
        detectedPlugin = 'MetForm';
        verificationMethod = 'selector_visible';
        expectedSuccessValue = '.metform-success-message';
      } else if (formClasses.includes('wpforms-form') || document.querySelector('.wpforms-container')) {
        detectedPlugin = 'WPForms';
        verificationMethod = 'selector_visible';
        expectedSuccessValue = 'div.wpforms-confirmation-container-full';
      } else if (formClasses.includes('gform_wrapper') || formId.startsWith('gform_')) {
        detectedPlugin = 'Gravity Forms';
        verificationMethod = 'selector_visible';
        expectedSuccessValue = 'div.gform_confirmation_message';
      }

      // 2. Locate Fields
      const inputElements = Array.from(
        form.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, select')
      );

      const fields: Array<{
        label: string;
        selector: string;
        type: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox';
        testValue: string;
      }> = [];

      inputElements.forEach((el) => {
        const tagName = el.tagName.toLowerCase();
        const inputType = (el.getAttribute('type') || (tagName === 'textarea' ? 'textarea' : 'text')).toLowerCase();
        const nameAttr = el.getAttribute('name') || '';
        const idAttr = el.getAttribute('id') || '';
        const placeholder = el.getAttribute('placeholder') || '';

        // Attempt to find associated label
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
          labelText = placeholder || nameAttr || idAttr || 'Field';
        }

        // Clean labelText
        labelText = labelText.replace(/[*:]/g, '').trim();

        // Build most stable CSS selector
        let selector = '';
        if (nameAttr) {
          selector = `${tagName}[name="${nameAttr}"]`;
        } else if (idAttr) {
          selector = `#${idAttr}`;
        } else if (placeholder) {
          selector = `${tagName}[placeholder="${placeholder}"]`;
        } else {
          selector = `${tagName}`;
        }

        // Determine input type
        let fieldType: 'text' | 'email' | 'tel' | 'textarea' | 'select' | 'checkbox' = 'text';
        let testValue = 'FormGuard QA Bot';

        if (inputType === 'email' || nameAttr.toLowerCase().includes('email')) {
          fieldType = 'email';
          testValue = 'qa-bot@formguardpro.com';
        } else if (inputType === 'tel' || nameAttr.toLowerCase().includes('phone') || nameAttr.toLowerCase().includes('tel')) {
          fieldType = 'tel';
          testValue = '+1 555-019-2834';
        } else if (tagName === 'textarea' || nameAttr.toLowerCase().includes('message')) {
          fieldType = 'textarea';
          testValue = 'FormGuard Pro automated health check test submission.';
        } else if (tagName === 'select') {
          fieldType = 'select';
          testValue = '';
        } else if (inputType === 'checkbox') {
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

      // 3. Locate Submit Button
      let submitButtonSelector = 'button[type="submit"]';
      const submitBtn =
        form.querySelector('button[type="submit"]') ||
        form.querySelector('input[type="submit"]') ||
        form.querySelector('.elementor-button[type="submit"]') ||
        form.querySelector('.wpcf7-submit') ||
        form.querySelector('.wpforms-submit');

      if (submitBtn) {
        if (submitBtn.className) {
          const firstClass = submitBtn.className.split(' ').filter(Boolean)[0];
          submitButtonSelector = `form button.${firstClass}, form input.${firstClass}, button[type="submit"], input[type="submit"]`;
        } else if (submitBtn.getAttribute('name')) {
          submitButtonSelector = `[name="${submitBtn.getAttribute('name')}"]`;
        }
      }

      return {
        detectedPlugin,
        fields,
        submitButtonSelector,
        verificationMethod,
        expectedSuccessValue,
      };
    });

    if (!inspectionResult) {
      return NextResponse.json({
        success: false,
        error: 'No active HTML form was detected on the specified URL. Please configure selectors manually.',
      });
    }

    return NextResponse.json({
      success: true,
      data: inspectionResult,
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

