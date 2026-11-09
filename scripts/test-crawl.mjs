import { chromium } from 'playwright';

async function testMultiPageDiscovery() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const siteUrl = 'https://extremeroofingpro.co.uk/';
  console.log('Loading base URL:', siteUrl);
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
  await page.waitForSelector('form, .metform-form-content', { timeout: 8000 }).catch(() => {});

  // Find all internal navigation links
  const links = await page.evaluate((baseUrl) => {
    const origin = new URL(baseUrl).origin;
    const internal = new Set();
    document.querySelectorAll('a[href]').forEach(a => {
      try {
        const u = new URL(a.getAttribute('href'), baseUrl);
        if (u.origin === origin && !u.pathname.match(/\.(jpg|png|gif|pdf|css|js|webp|svg|zip)$/i)) {
          const clean = u.origin + u.pathname.replace(/\/$/, '') + '/';
          internal.add(clean);
        }
      } catch {}
    });
    return Array.from(internal);
  }, siteUrl);

  console.log(`Found ${links.length} total internal pages.`);
  
  // Prioritize key form pages: contact, quote, services, about, etc.
  const priorityKeywords = ['contact', 'quote', 'estimate', 'service', 'emergency', 'repair'];
  const prioritized = links.sort((a, b) => {
    const aP = priorityKeywords.some(k => a.toLowerCase().includes(k)) ? 1 : 0;
    const bP = priorityKeywords.some(k => b.toLowerCase().includes(k)) ? 1 : 0;
    return bP - aP;
  });

  const testPages = Array.from(new Set([siteUrl, ...prioritized])).slice(0, 5);
  console.log('Testing top pages:', testPages);

  for (const pageUrl of testPages) {
    console.log(`\nChecking: ${pageUrl} ...`);
    try {
      await page.goto(pageUrl, { waitUntil: 'domcontentloaded', timeout: 20000 });
      await page.waitForSelector('form, .metform-form-content', { timeout: 5000 }).catch(() => {});
      
      const pageInfo = await page.evaluate(() => {
        const pageTitle = (document.title || '').split('|')[0].split('-')[0].trim();
        const forms = Array.from(document.querySelectorAll('form, .metform-form-content')).filter(f => {
          const idCls = (f.className + ' ' + f.id).toLowerCase();
          return !idCls.includes('search') && !idCls.includes('admin-bar');
        });

        return {
          title: pageTitle,
          formCount: forms.length,
          forms: forms.map((f, idx) => {
            const h = f.closest('section, div')?.querySelector('h1, h2, h3, h4')?.textContent?.trim() || `Form #${idx+1}`;
            const inputs = Array.from(f.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select')).map(i => i.name || i.placeholder || i.type);
            return { heading: h, inputs };
          })
        };
      });

      console.log(`-> Page: "${pageInfo.title}" has ${pageInfo.formCount} forms.`);
      pageInfo.forms.forEach(f => {
        console.log(`   * [${f.heading}] Inputs: ${f.inputs.join(', ')}`);
      });
    } catch (e) {
      console.log('Error loading', pageUrl, e.message);
    }
  }

  await browser.close();
}

testMultiPageDiscovery();
