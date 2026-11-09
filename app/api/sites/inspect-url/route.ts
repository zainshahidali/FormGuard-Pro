import { NextRequest, NextResponse } from 'next/server';
import { chromium, Browser, Page } from 'playwright';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // Allow sufficient time for multi-page crawling

// Helper to inspect forms on an individual loaded page
async function extractFormsFromPage(page: Page, pageUrl: string) {
  return await page.evaluate((pageUrl) => {
    const currentUrl = pageUrl || window.location.href;
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

    const pageTitle = (document.title || '').split('|')[0].split('-')[0].trim() || 'Page';

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
        formTitle = `${pageTitle} — Form #${index + 1}`;
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

        // Skip WordPress system hidden fields
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

        // Selector
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

      // Extract plugin-specific form ID if present
      let wpFormId = '';
      const cf7Val = (container.querySelector('input[name="_wpcf7"]') as HTMLInputElement)?.value;
      if (cf7Val) wpFormId = `cf7-${cf7Val}`;

      const mfVal =
        container.getAttribute('data-metform-form-id') ||
        (container.querySelector('input[name="form_id"]') as HTMLInputElement)?.value;
      if (mfVal) wpFormId = `metform-${mfVal}`;

      const wpfVal =
        container.getAttribute('data-formid') ||
        (container.id && container.id.includes('wpforms') ? container.id : '');
      if (wpfVal) wpFormId = `wpforms-${wpfVal}`;

      // Fallback signature from field selectors and types
      const fieldSig = fields
        .map((f: any) => `${f.selector || f.label}:${f.type}`)
        .sort()
        .join('|');
      const fingerprint = wpFormId || `${detectedPlugin}::${fieldSig}::${submitButtonSelector}`;

      return {
        id: `form-${currentUrl.replace(/[^a-zA-Z0-9]/g, '-')}-${index}`,
        pageUrl: currentUrl,
        pageTitle,
        title: formTitle,
        fingerprint,
        detectedPlugin,
        fields,
        submitButtonSelector,
        verificationMethod,
        expectedSuccessValue,
      };
    });
  }, pageUrl);
}

// Smart deduplication helper to merge identical forms repeating across multiple pages
function deduplicateForms(rawForms: any[]) {
  const uniqueFormsMap = new Map<string, any>();

  for (const form of rawForms) {
    if (!form.fields || form.fields.length === 0) continue;

    const fp = form.fingerprint || `${form.detectedPlugin}::${form.fields.length}::${form.submitButtonSelector}`;

    if (!uniqueFormsMap.has(fp)) {
      uniqueFormsMap.set(fp, {
        ...form,
        occurrences: 1,
        pagesFoundOn: [form.pageUrl],
      });
    } else {
      const existing = uniqueFormsMap.get(fp);
      existing.occurrences += 1;
      if (!existing.pagesFoundOn.includes(form.pageUrl)) {
        existing.pagesFoundOn.push(form.pageUrl);
      }

      // Prioritize dedicated pages (e.g. /contact-us/, /quote/, /booking/) over generic pages (e.g. /)
      const isCurrentDedicated = /contact|quote|estimate|book|inquiry|request|booking/i.test(form.pageUrl);
      const isExistingDedicated = /contact|quote|estimate|book|inquiry|request|booking/i.test(existing.pageUrl);

      if (isCurrentDedicated && !isExistingDedicated) {
        existing.pageUrl = form.pageUrl;
        existing.pageTitle = form.pageTitle;
      }
    }
  }

  return Array.from(uniqueFormsMap.values()).map((f, idx) => {
    return {
      ...f,
      id: `form-unique-${idx}`,
      title: f.title,
      occurrences: f.occurrences,
      pagesFoundOn: f.pagesFoundOn,
    };
  });
}

export async function POST(req: NextRequest) {
  let browser: Browser | null = null;
  try {
    const body = await req.json();
    const { url, deepScan } = body;

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

    // 1. Visit the root URL
    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 35000 });
      // Wait for dynamic/React form builders like MetForm or Elementor to render
      await page.waitForSelector('form, .metform-form-content, .elementor-form, .wpforms-container, .wpcf7-form', {
        timeout: 8000,
      }).catch(() => {});
      await page.waitForTimeout(2000);
    } catch (navErr: any) {
      return NextResponse.json(
        { success: false, error: `Failed to load page: ${navErr.message || String(navErr)}` },
        { status: 400 }
      );
    }

    // Single-page scan or Deep multi-page crawl
    if (!deepScan) {
      const rawForms = await extractFormsFromPage(page, url);
      const forms = deduplicateForms(rawForms);
      if (!forms || forms.length === 0) {
        return NextResponse.json({
          success: false,
          error: 'No active HTML form was detected on this page URL. Try "Deep Crawl Website" to discover forms on other pages.',
        });
      }
      return NextResponse.json({ success: true, forms, count: forms.length });
    }

    // 2. Deep Multi-Page Crawl
    const internalLinks: string[] = await page.evaluate((baseUrl) => {
      const origin = new URL(baseUrl).origin;
      const allLinks = Array.from(document.querySelectorAll('a[href]'));
      const internal = new Set<string>();

      allLinks.forEach((a) => {
        try {
          const u = new URL(a.getAttribute('href') || '', baseUrl);
          if (
            u.origin === origin &&
            !u.pathname.match(/\.(jpg|jpeg|png|gif|pdf|css|js|webp|svg|zip)$/i)
          ) {
            const clean = u.origin + u.pathname.replace(/\/$/, '') + (u.pathname.endsWith('/') ? '/' : '');
            internal.add(clean);
          }
        } catch {}
      });

      return Array.from(internal);
    }, url);

    // Prioritize contact, quote, estimate, inquiry, services pages first
    const sortedLinks = internalLinks.sort((a, b) => {
      const priorityKeywords = ['contact', 'quote', 'estimate', 'book', 'inquiry', 'request', 'services'];
      const aPriority = priorityKeywords.some((k) => a.toLowerCase().includes(k)) ? 1 : 0;
      const bPriority = priorityKeywords.some((k) => b.toLowerCase().includes(k)) ? 1 : 0;
      return bPriority - aPriority;
    });

    // Check top 6 priority internal pages plus root
    const uniquePages = Array.from(new Set([url, ...sortedLinks])).slice(0, 7);

    const allDiscoveredForms: any[] = [];
    const scannedUrls: string[] = [];

    // Extract from first page
    const firstPageForms = await extractFormsFromPage(page, url);
    scannedUrls.push(url);
    if (firstPageForms && firstPageForms.length > 0) {
      allDiscoveredForms.push(...firstPageForms);
    }

    // Crawl other pages
    for (const pageUrl of uniquePages) {
      if (pageUrl === url) continue;
      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
        await page.waitForSelector('form, .metform-form-content, .elementor-form, .wpforms-container, .wpcf7-form', {
          timeout: 6000,
        }).catch(() => {});
        await page.waitForTimeout(1200);
        scannedUrls.push(pageUrl);
        const formsOnPage = await extractFormsFromPage(page, pageUrl);
        if (formsOnPage && formsOnPage.length > 0) {
          allDiscoveredForms.push(...formsOnPage);
        }
      } catch (pageErr: any) {
        console.warn(`[Crawler] Skipping ${pageUrl}:`, pageErr.message);
      }
    }

    // Apply smart deduplication across all discovered forms
    const uniqueForms = deduplicateForms(allDiscoveredForms);

    if (uniqueForms.length === 0) {
      return NextResponse.json({
        success: false,
        error: `Scanned ${scannedUrls.length} pages across the website but no contact forms were found.`,
      });
    }

    return NextResponse.json({
      success: true,
      deepScan: true,
      pagesScanned: scannedUrls.length,
      count: uniqueForms.length,
      forms: uniqueForms,
    });
  } catch (error: any) {
    console.error('Error crawling website for forms:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to inspect website' },
      { status: 500 }
    );
  } finally {
    if (browser) {
      await browser.close().catch(() => {});
    }
  }
}
