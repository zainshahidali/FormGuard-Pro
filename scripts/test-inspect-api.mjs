import { chromium } from 'playwright';

async function testInspectDirect() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const siteUrl = 'https://extremeroofingpro.co.uk/';
  console.log('Testing deep crawl logic on:', siteUrl);
  
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForSelector('form, .metform-form-content', { timeout: 8000 }).catch(() => {});

  const internalLinks = await page.evaluate((baseUrl) => {
    const origin = new URL(baseUrl).origin;
    const allLinks = Array.from(document.querySelectorAll('a[href]'));
    const internal = new Set();
    allLinks.forEach((a) => {
      try {
        const u = new URL(a.getAttribute('href') || '', baseUrl);
        if (u.origin === origin && !u.pathname.match(/\.(jpg|jpeg|png|gif|pdf|css|js|webp|svg|zip)$/i)) {
          const clean = u.origin + u.pathname.replace(/\/$/, '') + '/';
          internal.add(clean);
        }
      } catch {}
    });
    return Array.from(internal);
  }, siteUrl);

  const priorityKeywords = ['contact', 'quote', 'estimate', 'service', 'emergency'];
  const sorted = internalLinks.sort((a, b) => {
    const aP = priorityKeywords.some(k => a.toLowerCase().includes(k)) ? 1 : 0;
    const bP = priorityKeywords.some(k => b.toLowerCase().includes(k)) ? 1 : 0;
    return bP - aP;
  });

  const uniquePages = Array.from(new Set([siteUrl, ...sorted])).slice(0, 5);
  console.log(`Discovered ${internalLinks.length} total links. Crawling top ${uniquePages.length} pages...`);

  for (const pUrl of uniquePages) {
    try {
      await page.goto(pUrl, { waitUntil: 'domcontentloaded', timeout: 25000 });
      await page.waitForSelector('form, .metform-form-content', { timeout: 7000 }).catch(() => {});
      
      const forms = await page.evaluate((currentUrl) => {
        const containers = Array.from(document.querySelectorAll('form, .metform-form-content')).filter(f => {
          const idOrClass = (String(f.className || '') + ' ' + String(f.id || '')).toLowerCase();
          return !idOrClass.includes('search') && !idOrClass.includes('admin-bar');
        });
        const pageTitle = (document.title || '').split('|')[0].split('-')[0].trim();
        return containers.map((c, i) => {
          const inputs = Array.from(c.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select')).map(el => el.name || el.type);
          return { pageTitle, pageUrl: currentUrl, formNum: i + 1, inputs };
        });
      }, pUrl);

      console.log(`- [${pUrl}] found ${forms.length} forms:`, forms.map(f => `${f.pageTitle} (#${f.formNum}): ${f.inputs.length} inputs`));
    } catch (err) {
      console.log(`Skipped ${pUrl}:`, err.message);
    }
  }

  await browser.close();
}

testInspectDirect();

