import { chromium } from 'playwright';

async function testSkinCreation() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  const siteUrl = 'https://skincreationsg.com/';
  console.log('Testing crawl on:', siteUrl);
  
  await page.goto(siteUrl, { waitUntil: 'domcontentloaded', timeout: 35000 });
  await page.waitForSelector('form, .metform-form-content, .wpcf7-form, .elementor-form', { timeout: 8000 }).catch(() => {});

  const forms = await page.evaluate((pageUrl) => {
    const currentUrl = pageUrl || window.location.href;
    const formContainers = [];
    const rawForms = Array.from(document.querySelectorAll('form'));
    rawForms.forEach((f) => {
      const idOrClass = (String(f.className || '') + ' ' + String(f.id || '')).toLowerCase();
      if (!idOrClass.includes('search') && !idOrClass.includes('admin-bar')) {
        formContainers.push(f);
      }
    });

    const pageTitle = (document.title || '').split('|')[0].split('-')[0].trim() || 'Page';

    return formContainers.map((container, index) => {
      const formClasses = String(container.className || '');
      let detectedPlugin = 'Custom';
      if (formClasses.includes('wpcf7')) detectedPlugin = 'Contact Form 7';
      else if (formClasses.includes('elementor-form')) detectedPlugin = 'Elementor Pro';

      const inputs = Array.from(
        container.querySelectorAll('input:not([type="submit"]):not([type="button"]), textarea, select')
      ).map(i => ({ name: i.name, type: i.type, placeholder: i.placeholder }));

      return {
        id: `form-${currentUrl.replace(/[^a-zA-Z0-9]/g, '-')}-${index}`,
        pageUrl: currentUrl,
        pageTitle,
        detectedPlugin,
        inputs
      };
    });
  }, siteUrl);

  console.log('Detected forms on skincreationsg.com:', JSON.stringify(forms, null, 2));
  await browser.close();
}

testSkinCreation();

