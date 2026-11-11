/**
 * Regression test for form discovery + form targeting. Runs fully offline against a local fixture page.
 *
 *   npm run test:discovery
 *
 * Guards against the bugs where two different forms with identical fields were merged into one,
 * hidden system fields / honeypots were imported as fillable fields, and the tester filled the
 * wrong look-alike form on a page.
 */
import http from 'http';
import { chromium } from 'playwright';

// tsx (esbuild) wraps functions with a __name() helper that does not exist inside the browser page.
const origLaunch = chromium.launch.bind(chromium);
(chromium as any).launch = async (...args: any[]) => {
  const browser = await origLaunch(...args);
  const origNewContext = browser.newContext.bind(browser);
  (browser as any).newContext = async (...ctxArgs: any[]) => {
    const ctx = await origNewContext(...ctxArgs);
    await ctx.addInitScript('window.__name = (f) => f;');
    return ctx;
  };
  return browser;
};

const { POST } = await import('../app/api/sites/inspect-url/route.ts');
const { runFormTest, runSiteTest } = await import('../lib/tester.ts');
const { tryAcquireSiteRun, releaseSiteRun } = await import('../lib/run-lock.ts');

const PORT = 4610;
const BASE = `http://localhost:${PORT}/`;

const metform = (id: string) => `
  <div class="mf-form-wrapper" data-form-id="${id}"><form class="metform-form-content">
    <input name="Name" type="text"><input name="Email_Address" type="email"><textarea name="Message"></textarea>
    <button type="submit" class="metform-btn">Send</button></form></div>`;
const cf7 = (id: string) => `
  <div class="wpcf7"><form class="wpcf7-form"><input type="hidden" name="_wpcf7" value="${id}">
    <input name="your-name" type="text"><input name="your-email" type="email"><textarea name="your-message"></textarea>
    <input type="submit" class="wpcf7-submit" value="Send"></form></div>`;
const elementor = (id: string) => `
  <div class="elementor-widget-form"><form class="elementor-form"><input type="hidden" name="form_id" value="${id}">
    <input type="hidden" name="post_id" value="9">
    <input name="form_fields[name]" type="text"><input name="form_fields[email]" type="email"><textarea name="form_fields[message]"></textarea>
    <button type="submit" class="elementor-button">Send</button></form></div>`;
const wpforms = (id: string) => `
  <div class="wpforms-container"><form id="wpforms-form-${id}" class="wpforms-form" data-formid="${id}">
    <div class="wpforms-field" style="position:absolute!important;overflow:hidden!important;height:1px!important;width:1px!important;z-index:-1000!important">
      <label>Name Email</label><input name="wpforms[fields][99]" type="text"></div>
    <div class="wpforms-field"><input name="wpforms[fields][1]" type="text"></div>
    <div class="wpforms-field"><input name="wpforms[fields][2]" type="email"></div>
    <div class="wpforms-field"><input name="wpforms[fields][3]" type="number"></div>
    <input type="hidden" name="wpforms[id]" value="${id}"><input type="hidden" name="wpforms[time_token]" value="x">
    <input type="hidden" name="page_url" value="/"><input type="hidden" name="wpforms[recaptcha]" value="">
    <button type="submit" class="wpforms-submit">Send</button></form>
    <div class="wpforms-confirmation-container-full" id="confirm-${id}" style="display:none">Thanks</div></div>`;
const gravity = (id: string) => `
  <div class="gform_wrapper"><form id="gform_${id}">
    <input name="input_1" type="text"><input name="input_2" type="email"><textarea name="input_3"></textarea>
    <input type="submit" class="gform_button" value="Send"></form></div>`;

const page = `<!doctype html><html><head><title>Fixture</title><style>input,textarea{display:block;width:300px;height:30px}</style></head><body>
<h1>Fixture</h1>
<section><h2>MetForm A</h2>${metform('11')}</section>
<section><h2>MetForm B</h2>${metform('12')}</section>
<section><h2>MetForm A again (same form shown twice)</h2>${metform('11')}</section>
<section><h2>CF7 A</h2>${cf7('21')}</section><section><h2>CF7 B</h2>${cf7('22')}</section>
<section><h2>Elementor A</h2>${elementor('aa31')}</section><section><h2>Elementor B</h2>${elementor('bb32')}</section>
<section><h2>WPForms A</h2>${wpforms('41')}</section><section><h2>WPForms B</h2>${wpforms('42')}</section>
<section><h2>Gravity A</h2>${gravity('51')}</section><section><h2>Gravity B</h2>${gravity('52')}</section>
<script>
document.querySelectorAll('form.wpforms-form').forEach(function (f) {
  f.addEventListener('submit', async function (e) {
    e.preventDefault();
    var id = f.getAttribute('data-formid');
    await fetch('/submit?form=' + id + '&name=' + encodeURIComponent(f.querySelector('[name="wpforms[fields][1]"]').value) + '&email=' + encodeURIComponent(f.querySelector('[name="wpforms[fields][2]"]').value), { method: 'POST', body: 'x' });
    document.getElementById('confirm-' + id).style.display = 'block';
  });
});
document.querySelectorAll('.mf-form-wrapper').forEach(function (w) {
  var f = w.querySelector('form');
  f.addEventListener('submit', async function (e) {
    e.preventDefault();
    var r = await fetch('/wp-json/metform/v1/entries/insert/' + w.getAttribute('data-form-id'), { method: 'POST', body: 'x' });
    var j = await r.json();
    var box = document.createElement('div');
    box.className = 'mf-main-response-wrap mf-response-msg-wrap';
    box.textContent = j.status === 1 ? 'Thank you' : 'Something went wrong.';
    f.prepend(box);
    if (j.status === 1) f.reset();
  });
});
</script></body></html>`;

// Mirrors real MetForm: the reply always starts with a default error text, and a successful
// submission sets status 1 without clearing it.
let metformReply: any = { status: 1, error: ['Something went wrong.'], data: { message: 'Thank you' } };

const submissions: string[] = [];
const server = http
  .createServer((req, res) => {
    if (req.method === 'POST' && (req.url || '').includes('/metform/v1/entries/insert/')) {
      res.setHeader('content-type', 'application/json');
      return res.end(JSON.stringify(metformReply));
    }
    if (req.method === 'POST') {
      submissions.push(req.url || '');
      res.setHeader('content-type', 'application/json');
      return res.end('{"ok":true}');
    }
    if (req.url === '/') {
      res.setHeader('content-type', 'text/html');
      return res.end(page);
    }
    res.statusCode = 404;
    res.end('not found');
  })
  .listen(PORT);

let failed = 0;
const check = (label: string, ok: boolean, detail = '') => {
  if (!ok) failed++;
  console.log(`${ok ? '  PASS' : '  FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
};

try {
  console.log('\nForm discovery');
  const res: any = await POST({ json: async () => ({ url: BASE, deepScan: false }) } as any);
  const data = await res.json();
  const forms: any[] = data.forms || [];
  const ids = forms.map((f) => f.fingerprint).sort();

  check('scan succeeds', data.success === true, data.error || '');
  check(
    'finds 10 distinct forms (2 per plugin, identical fields are NOT merged)',
    forms.length === 10,
    `got ${forms.length}: ${ids.join(', ')}`
  );
  for (const expected of ['metform-11', 'metform-12', 'cf7-21', 'cf7-22', 'elementor-aa31', 'elementor-bb32', 'wpforms-41', 'wpforms-42', 'gravity-51', 'gravity-52']) {
    check(`has ${expected}`, ids.includes(expected));
  }
  check('same form shown twice on a page is still one form', ids.filter((i) => i === 'metform-11').length === 1);
  check('every form has a scope selector', forms.every((f) => !!f.scopeSelector));
  check(
    'plugins are detected correctly',
    forms.every((f) => {
      const prefix = String(f.fingerprint).split('-')[0];
      return { metform: 'MetForm', cf7: 'Contact Form 7', elementor: 'Elementor Pro', wpforms: 'WPForms', gravity: 'Gravity Forms' }[prefix] === f.formPluginType;
    }),
    forms.map((f) => `${f.fingerprint}=${f.formPluginType}`).join(', ')
  );

  const allSelectors = forms.flatMap((f) => f.fields.map((x: any) => String(x.selector)));
  check('no hidden system fields imported', !allSelectors.some((s) => /wpforms\[id\]|time_token|page_url|recaptcha|_wpcf7|form_id|post_id/.test(s)));
  check('no honeypot field imported', !allSelectors.some((s) => s.includes('wpforms[fields][99]')));
  const wpf = forms.find((f) => f.fingerprint === 'wpforms-42');
  check('WPForms form has exactly its 3 real fields', wpf?.fields.length === 3, `got ${wpf?.fields.length}`);
  const numberField = wpf?.fields.find((x: any) => String(x.selector).includes('wpforms[fields][3]'));
  check('number input gets a digits-only test value', /^\d+$/.test(numberField?.testValue || ''), numberField?.testValue);

  console.log('\nForm targeting (tester fills the right look-alike form)');
  const result = await runFormTest({
    url: BASE,
    name: 'Fixture — WPForms B',
    fields: wpf.fields.map((x: any) => (String(x.selector).includes('[1]') ? { ...x, testValue: 'SecondForm' } : x)),
    scopeSelector: wpf.scopeSelector,
    submitButtonSelector: wpf.submitButtonSelector,
    verificationMethod: 'selector_visible',
    expectedSuccessValue: '#confirm-42',
  });
  check('test passes', result.status === 'passed', result.errorMessage || '');
  check('submitted form 42, not the first look-alike (41)', submissions.length === 1 && submissions[0].includes('form=42') && submissions[0].includes('name=SecondForm'), submissions.join(' | '));

  const missing = await runFormTest({
    url: BASE,
    name: 'Fixture — removed form',
    fields: wpf.fields,
    scopeSelector: 'form[data-formid="999"]',
    submitButtonSelector: wpf.submitButtonSelector,
    verificationMethod: 'selector_visible',
    expectedSuccessValue: '#confirm-42',
  });
  check('a removed form is reported as "Form not found"', missing.status === 'failed' && /Form not found/.test(missing.errorMessage || ''), missing.errorMessage || '');

  console.log('\nEach form is tested once per run');
  submissions.length = 0;
  const wpfItem = {
    id: 'a',
    name: 'WPForms B',
    pageUrl: BASE,
    fields: wpf.fields,
    scopeSelector: wpf.scopeSelector,
    submitButtonSelector: wpf.submitButtonSelector,
    verificationMethod: 'selector_visible',
    expectedSuccessValue: '#confirm-42',
    isActive: true,
  };
  const siteRun = await runSiteTest({
    name: 'Fixture site',
    url: BASE,
    // The same form saved three times (as if it had been imported from three pages).
    forms: [wpfItem, { ...wpfItem, id: 'b', name: 'WPForms B (other page)' }, { ...wpfItem, id: 'c', name: 'WPForms B (third page)' }],
  });
  check('same form saved on 3 pages is tested only once', siteRun.formResults.length === 1 && submissions.length === 1, `tested ${siteRun.formResults.length}, submitted ${submissions.length}`);
  check('one click on Submit sends exactly one submission', !siteRun.consoleErrors.some((l: string) => l.includes('submission requests')), siteRun.consoleErrors.join(' || '));

  console.log('\nTest submission email (Settings)');
  submissions.length = 0;
  const emailRun = await runSiteTest(
    { name: 'Fixture site', url: BASE, forms: [wpfItem] },
    { testEmail: 'formguard-tests@agency.example' }
  );
  check('test passes with the global test email', emailRun.status === 'passed', emailRun.errorMessage || '');
  check(
    'the global test email is typed into the email field',
    submissions.length === 1 && submissions[0].includes('email=formguard-tests%40agency.example'),
    submissions.join(' | ')
  );
  submissions.length = 0;
  await runSiteTest({ name: 'Fixture site', url: BASE, forms: [wpfItem] });
  check(
    'without a global test email, the saved field value is used',
    submissions.length === 1 && submissions[0].includes('email=') && !submissions[0].includes('agency.example'),
    submissions.join(' | ')
  );

  console.log('\nNo overlapping runs of the same site');
  check('first run acquires the lock', tryAcquireSiteRun('site-x') === true);
  check('a second run of the same site is refused while the first is running', tryAcquireSiteRun('site-x') === false);
  check('a different site is not affected', tryAcquireSiteRun('site-y') === true);
  releaseSiteRun('site-x');
  releaseSiteRun('site-y');
  check('the site can be tested again after the run finishes', tryAcquireSiteRun('site-x') === true);
  releaseSiteRun('site-x');

  console.log('\nMetForm server reply (status decides, not the default error text)');
  const mf = forms.find((f) => f.fingerprint === 'metform-12');
  const mfConfig = {
    url: BASE,
    name: 'Fixture — MetForm B',
    fields: mf.fields,
    scopeSelector: mf.scopeSelector,
    submitButtonSelector: mf.submitButtonSelector,
    verificationMethod: mf.verificationMethod,
    expectedSuccessValue: mf.expectedSuccessValue,
  };
  const mfOk = await runFormTest(mfConfig);
  check('status 1 with leftover "Something went wrong." default counts as PASSED', mfOk.status === 'passed', mfOk.errorMessage || '');

  metformReply = { status: 0, error: ['Please solve the captcha.'], data: { message: '' } };
  const mfBad = await runFormTest(mfConfig);
  check('status 0 is reported as FAILED with MetForm\'s reason', mfBad.status === 'failed' && /Please solve the captcha/.test(mfBad.errorMessage || ''), mfBad.errorMessage || '');
  check('raw server reply is saved in the failure log', (mfBad.consoleErrors || []).some((l) => l.startsWith('[FormResponse] MetForm HTTP 200')), (mfBad.consoleErrors || []).join(' || '));
} finally {
  server.close();
}

console.log(failed === 0 ? '\nAll checks passed.\n' : `\n${failed} check(s) FAILED.\n`);
process.exit(failed === 0 ? 0 : 1);
