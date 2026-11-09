import { chromium } from 'playwright';

async function testInspect() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  
  console.log('Visiting https://extremeroofingpro.co.uk/ ...');
  await page.goto('https://extremeroofingpro.co.uk/', { waitUntil: 'networkidle', timeout: 35000 });
  await page.waitForTimeout(2000);

  const res = await page.evaluate(() => {
    const allForms = Array.from(document.querySelectorAll('form'));
    const metforms = Array.from(document.querySelectorAll('.metform-form-content, [data-metform-form], div[class*="metform"]'));
    const inputs = Array.from(document.querySelectorAll('input, textarea, select')).map(i => ({
      tag: i.tagName,
      name: i.name,
      type: i.type,
      cls: i.className
    }));
    return {
      formsCount: allForms.length,
      formClasses: allForms.map(f => f.className),
      metformsCount: metforms.length,
      metformClasses: metforms.map(m => m.className),
      inputsCount: inputs.length,
      inputsSample: inputs.slice(0, 10)
    };
  });

  console.log('Result:', JSON.stringify(res, null, 2));
  await browser.close();
}

testInspect();

