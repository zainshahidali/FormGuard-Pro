import { chromium } from 'playwright';

async function testDedup() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const siteUrl = 'https://skincreationsg.com/';
  console.log('Testing crawling & deduplication on:', siteUrl);
  
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForSelector('form, .metform-form-content, .wpcf7-form', { timeout: 8000 }).catch(() => {});

  const internalLinks = await page.evaluate((baseUrl) => {
    const origin = new URL(baseUrl).origin;
    const internal = new Set();
    document.querySelectorAll('a[href]').forEach(a => {
      try {
        const u = new URL(a.getAttribute('href'), baseUrl);
        if (u.origin === origin && !u.pathname.match(/\.(jpg|png|gif|pdf|css|js|webp|svg|zip)$/i)) {
          internal.add(u.origin + u.pathname.replace(/\/$/, '') + '/');
        }
      } catch {}
    });
    return Array.from(internal);
  }, siteUrl);

  const priorityKeywords = ['contact', 'quote', 'estimate', 'book', 'inquiry', 'request', 'treatments'];
  const sorted = internalLinks.sort((a, b) => {
    const aP = priorityKeywords.some(k => a.toLowerCase().includes(k)) ? 1 : 0;
    const bP = priorityKeywords.some(k => b.toLowerCase().includes(k)) ? 1 : 0;
    return bP - aP;
  });

  const uniquePages = Array.from(new Set([siteUrl, ...sorted])).slice(0, 6);
  console.log(`Checking ${uniquePages.length} pages...`);

  const allRawForms = [];

  for (const pageUrl of uniquePages) {
    try {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('form, .wpcf7-form', { timeout: 5000 }).catch(() => {});
      
      const forms = await page.evaluate((currentUrl) => {
        const containers = Array.from(document.querySelectorAll('form')).filter(f => {
          const idCls = (f.className + ' ' + f.id).toLowerCase();
          return !idCls.includes('search') && !idCls.includes('admin-bar');
        });

        const pageTitle = (document.title || '').split('|')[0].split('-')[0].trim() || 'Page';

        return containers.map((c, i) => {
          const inputs = Array.from(c.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select'))
            .filter(el => {
              const type = (el.getAttribute('type') || '').toLowerCase();
              const name = (el.getAttribute('name') || '').toLowerCase();
              if (type === 'hidden' && (name.startsWith('_') || name.includes('nonce') || name.includes('referer'))) return false;
              return true;
            })
            .map(el => ({ name: el.name || el.placeholder, type: el.type || el.tagName.toLowerCase() }));

          const cf7Id = c.querySelector('input[name="_wpcf7"]')?.value;
          const fp = cf7Id ? `cf7-${cf7Id}` : inputs.map(x => `${x.name}:${x.type}`).sort().join('|');

          const heading = c.closest('section, div')?.querySelector('h1, h2, h3, h4')?.textContent?.trim() || `${pageTitle} Form #${i+1}`;

          return {
            pageUrl: currentUrl,
            pageTitle,
            title: heading,
            fingerprint: fp,
            inputs
          };
        });
      }, pageUrl);

      allRawForms.push(...forms);
    } catch (e) {
      console.log('Error loading', pageUrl, e.message);
    }
  }

  console.log(`\nRaw forms found across pages: ${allRawForms.length}`);

  // Deduplication
  const dedupMap = new Map();
  for (const form of allRawForms) {
    if (!form.inputs || form.inputs.length === 0) continue;
    const fp = form.fingerprint;
    if (!dedupMap.has(fp)) {
      dedupMap.set(fp, { ...form, count: 1, pages: [form.pageUrl] });
    } else {
      const ex = dedupMap.get(fp);
      ex.count++;
      if (!ex.pages.includes(form.pageUrl)) ex.pages.push(form.pageUrl);
      if (/contact|quote|book/i.test(form.pageUrl) && !/contact|quote|book/i.test(ex.pageUrl)) {
        ex.pageUrl = form.pageUrl;
        ex.pageTitle = form.pageTitle;
      }
    }
  }

  const finalUnique = Array.from(dedupMap.values());
  console.log(`\n✅ AFTER DEDUPLICATION: ${finalUnique.length} UNIQUE FORMS:`);
  finalUnique.forEach((f, i) => {
    console.log(`  [Form ${i+1}] "${f.title}" (${f.inputs.length} inputs)`);
    console.log(`             Page: ${f.pageUrl}`);
    console.log(`             Found across ${f.count} page(s): ${f.pages.join(', ')}`);
    console.log(`             Inputs: ${f.inputs.map(x => x.name).join(', ')}`);
  });

  await browser.close();
}

testDedup();

