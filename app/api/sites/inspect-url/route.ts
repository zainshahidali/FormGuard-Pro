import { NextRequest, NextResponse } from 'next/server';
import { chromium, Browser, Page } from 'playwright';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // Allow sufficient time for multi-page crawling

// Helper to discover all candidate URLs from sitemap and homepage
async function discoverSiteCandidateUrls(baseUrl: string, page: Page): Promise<string[]> {
  const origin = new URL(baseUrl).origin;
  const discovered = new Set<string>([origin + '/']);

  // 1. Try common WordPress XML sitemaps (RankMath, Yoast, Core WP)
  const sitemapEndpoints = [
    `${origin}/page-sitemap.xml`,
    `${origin}/wp-sitemap-posts-page-1.xml`,
    `${origin}/sitemap_index.xml`,
    `${origin}/sitemap.xml`,
  ];

  for (const smUrl of sitemapEndpoints) {
    try {
      const res = await fetch(smUrl, {
        headers: { 'User-Agent': 'Mozilla/5.0 FormGuardPro/1.0' },
        signal: AbortSignal.timeout(4000),
      });
      if (res.ok) {
        const text = await res.text();
        const matches = text.match(/<loc>(.*?)<\/loc>/g);
        if (matches) {
          matches.forEach((m) => {
            const u = m.replace(/<\/?loc>/g, '').trim();
            if (u.startsWith(origin) && !u.match(/\.(jpg|jpeg|png|gif|pdf|css|js|webp|svg|zip|xml)$/i)) {
              discovered.add(u);
            }
          });
        }
        if (discovered.size > 5) break;
      }
    } catch {}
  }

  // 2. Also harvest links from page DOM
  try {
    const domLinks: string[] = await page.evaluate((orig) => {
      return Array.from(document.querySelectorAll('a[href]'))
        .map((a) => a.getAttribute('href') || '')
        .filter(Boolean);
    }, origin);

    domLinks.forEach((href) => {
      try {
        const resolved = new URL(href, baseUrl);
        if (resolved.origin === origin && !resolved.pathname.match(/\.(jpg|jpeg|png|gif|pdf|css|js|webp|svg|zip)$/i)) {
          const clean = resolved.origin + resolved.pathname.replace(/\/$/, '') + (resolved.pathname.endsWith('/') ? '/' : '');
          discovered.add(clean);
        }
      } catch {}
    });
  } catch {}

  return Array.from(discovered);
}

// Smart priority sorting for pages likely to host forms across all business departments
function selectPriorityPages(urls: string[], baseUrl: string): string[] {
  const categories: Record<string, string[]> = {
    contact: ['contact', 'reach', 'touch', 'hello', 'inquiry', 'enquiry'],
    booking: ['book', 'booking', 'appointment', 'reserve', 'reservation', 'schedule'],
    career: ['career', 'careers', 'job', 'jobs', 'join', 'hiring', 'work-with-us', 'apply'],
    quote: ['quote', 'estimate', 'pricing', 'calculator', 'order'],
    product: ['product', 'products', 'shop', 'package'],
    service: ['service', 'services', 'treatment', 'treatments'],
  };

  const selected = new Set<string>([baseUrl.replace(/\/$/, '') + '/']);

  // Pick top 1-2 pages from each high-value category
  for (const [cat, kws] of Object.entries(categories)) {
    const matches = urls.filter((u) => kws.some((k) => u.toLowerCase().includes(k)));
    if (cat === 'product') {
      // Prioritize single product detail pages (e.g. /products/face-neck-lifting-serum/)
      const singleProduct = matches.find((m) => m.replace(/\/$/, '').split('/').length > 4);
      if (singleProduct) selected.add(singleProduct);
    }
    matches.slice(0, 2).forEach((m) => selected.add(m));
  }

  // Fill up to 11 pages total with remaining URLs
  for (const u of urls) {
    if (selected.size >= 11) break;
    selected.add(u);
  }

  return Array.from(selected);
}

// Helper to inspect forms on an individual loaded page
async function extractFormsFromPage(page: Page, pageUrl: string) {
  return await page.evaluate((pageUrl) => {
    const currentUrl = pageUrl || window.location.href;
    const formContainers: any[] = [];

    // Helper to check if an element or its attributes match blacklisted widgets
    const isBlacklisted = (el: Element) => {
      const text = (
        String(el.className || '') + ' ' +
        String(el.id || '') + ' ' +
        String(el.getAttribute('action') || '')
      ).toLowerCase();

      return (
        text.includes('search') ||
        text.includes('admin-bar') ||
        text.includes('whatsapp') ||
        text.includes('chaty') ||
        text.includes('joinchat') ||
        text.includes('qlwapp') ||
        text.includes('wa-chat') ||
        text.includes('click-to-chat') ||
        text.includes('comment') ||
        text.includes('login') ||
        text.includes('woocommerce-cart') ||
        text.includes('woocommerce-checkout') ||
        text.includes('variations_form') ||
        text.includes('wa.me') ||
        text.includes('whatsapp.com')
      );
    };

    // 1. Collect standard <form> tags (skipping blacklisted widgets)
    const rawForms = Array.from(document.querySelectorAll('form'));
    rawForms.forEach((f) => {
      if (!isBlacklisted(f)) {
        formContainers.push(f);
      }
    });

    // 2. MetForm can be rendered in a div (.metform-form-content)
    document.querySelectorAll('.metform-form-content').forEach((mf) => {
      if (!isBlacklisted(mf) && !formContainers.some((f) => f.contains(mf) || f === mf)) {
        formContainers.push(mf);
      }
    });

    // 3. Check for specific form plugin containers that might enclose forms
    document.querySelectorAll('.elementor-widget-form form, .wpcf7 form, .wpforms-container form, .gform_wrapper form').forEach((wf) => {
      if (!isBlacklisted(wf) && !formContainers.some((f) => f.contains(wf) || f === wf)) {
        formContainers.push(wf);
      }
    });

    const pageTitle = (document.title || '').split('|')[0].split(' – ')[0].split(' — ')[0].trim() || 'Page';

    const mapped = formContainers.map((container, index) => {
      if (isBlacklisted(container)) {
        return null;
      }

      const formClasses = String(container.className || '');
      const formId = String(container.id || '');

      // Strict WordPress Form Builder Detection:
      // We ONLY accept forms created in: MetForm, Contact Form 7, Elementor Pro, WPForms, Gravity Forms
      let detectedPlugin: string | null = null;
      let expectedSuccessValue = 'Thank you';
      let verificationMethod = 'text_visible';

      if (
        formClasses.includes('metform') ||
        container.querySelector('.metform-form-content') ||
        container.closest('.metform-form-content') ||
        container.hasAttribute('data-metform-form-id') ||
        container.querySelector('input[name="form_id"]')
      ) {
        detectedPlugin = 'MetForm';
        verificationMethod = 'selector_visible';
        expectedSuccessValue = '.metform-success-message, .mf-response-msg-wrap';
      } else if (
        formClasses.includes('wpcf7') ||
        container.querySelector('input[name="_wpcf7"]') ||
        container.closest('.wpcf7')
      ) {
        detectedPlugin = 'Contact Form 7';
        verificationMethod = 'selector_visible';
        expectedSuccessValue = '.wpcf7-mail-sent-ok, .wpcf7-response-output';
      } else if (
        formClasses.includes('elementor-form') ||
        container.closest('.elementor-widget-form') ||
        container.querySelector('[name^="form_fields"]')
      ) {
        detectedPlugin = 'Elementor Pro';
        verificationMethod = 'selector_visible';
        expectedSuccessValue = '.elementor-message-success';
      } else if (
        formClasses.includes('wpforms') ||
        container.closest('.wpforms-container') ||
        container.querySelector('[name^="wpforms"]') ||
        container.hasAttribute('data-formid')
      ) {
        detectedPlugin = 'WPForms';
        verificationMethod = 'selector_visible';
        expectedSuccessValue = 'div.wpforms-confirmation-container-full';
      } else if (
        formClasses.includes('gform') ||
        formId.startsWith('gform_') ||
        container.closest('.gform_wrapper')
      ) {
        detectedPlugin = 'Gravity Forms';
        verificationMethod = 'selector_visible';
        expectedSuccessValue = 'div.gform_confirmation_message';
      }

      // If the form does NOT belong to one of the verified WordPress form plugins, exclude it!
      if (!detectedPlugin) {
        return null;
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
        let testValue = 'Test User';

        if (typeAttr === 'email' || nameAttr.toLowerCase().includes('email')) {
          fieldType = 'email';
          testValue = 'test@gmail.com';
        } else if (typeAttr === 'tel' || nameAttr.toLowerCase().includes('phone') || nameAttr.toLowerCase().includes('tel')) {
          fieldType = 'tel';
          testValue = '+1 555-019-2834';
        } else if (tagName === 'textarea' || nameAttr.toLowerCase().includes('message')) {
          fieldType = 'textarea';
          testValue = 'Testing';
        } else if (tagName === 'select' || nameAttr.toLowerCase().includes('service') || typeAttr === 'hidden') {
          fieldType = 'select';
          testValue = '[Random Option]';
        } else if (typeAttr === 'checkbox') {
          fieldType = 'checkbox';
          testValue = 'true';
        } else if (
          typeAttr === 'file' ||
          nameAttr.toLowerCase().includes('resume') ||
          nameAttr.toLowerCase().includes('upload') ||
          nameAttr.toLowerCase().includes('attachment')
        ) {
          fieldType = 'file';
          testValue = '[Dummy Black Image]';
          if (nameAttr) {
            selector = `input[type="file"][name="${nameAttr}"], input[name="${nameAttr}"]`;
          } else if (idAttr) {
            selector = `input[type="file"]#${idAttr}, #${idAttr}`;
          }
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

    // Only return valid forms that belong to approved WordPress form plugins and have fields
    return mapped.filter((f): f is NonNullable<typeof f> => f !== null && f.fields && f.fields.length > 0);
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

    // 2. Deep Multi-Page Crawl (Sitemap-assisted & multi-department prioritized)
    const allDiscoveredCandidateUrls = await discoverSiteCandidateUrls(url, page);
    const uniquePages = selectPriorityPages(allDiscoveredCandidateUrls, url);

    const allDiscoveredForms: any[] = [];
    const scannedUrls: string[] = [];

    // Extract forms from root/homepage first
    const firstPageForms = await extractFormsFromPage(page, url);
    scannedUrls.push(url);
    if (firstPageForms && firstPageForms.length > 0) {
      allDiscoveredForms.push(...firstPageForms);
    }

    // Crawl prioritized pages across the entire site
    for (const pageUrl of uniquePages) {
      if (pageUrl === url) continue;
      try {
        await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 15000 });
        await page.waitForSelector('form, .metform-form-content, .elementor-form, .wpforms-container, .wpcf7-form', {
          timeout: 4000,
        }).catch(() => {});
        await page.waitForTimeout(600);
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
