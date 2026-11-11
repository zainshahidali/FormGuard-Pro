const fs = require('fs');
const rep = (s, a, b) => { if (!s.includes(a)) throw new Error('missing: ' + a.slice(0, 70)); return s.replace(a, b); };
let m = fs.readFileSync('components/RunAllModal.tsx', 'utf8');
m = rep(m, "                  const passed = item.status === 'passed';\n", "                  const passed = item.status === 'passed';\n                  const skipped = item.status === 'skipped';\n");
m = rep(m, `                          passed
                            ? 'bg-[#e7f8f2] text-mint'
                            : 'bg-[#ffeded] text-[#dc5262]'`, `                          passed
                            ? 'bg-[#e7f8f2] text-mint'
                            : skipped
                            ? 'bg-[#fff4e0] text-[#d79b2d]'
                            : 'bg-[#ffeded] text-[#dc5262]'`);
m = rep(m, `                          <p className="truncate text-[10.5px] text-[#dc5262]">
                            {item.errorMessage}`, `                          <p className={\`truncate text-[10.5px] \${skipped ? 'text-[#d79b2d]' : 'text-[#dc5262]'}\`}>
                            {item.errorMessage}`);
fs.writeFileSync('components/RunAllModal.tsx', m);

// regression test additions
let t = fs.readFileSync('scripts/test-form-discovery.mts', 'utf8');
t = rep(t, "'/submit?form=' + id + '&name=' + encodeURIComponent(f.querySelector('[name=\"wpforms[fields][1]\"]').value)", "'/submit?form=' + id + '&name=' + encodeURIComponent(f.querySelector('[name=\"wpforms[fields][1]\"]').value) + '&email=' + encodeURIComponent(f.querySelector('[name=\"wpforms[fields][2]\"]').value)");
t = rep(t, "\n  console.log('\nMetForm server reply (status decides, not the default error text)');", `
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
  check('without a global test email, the saved field value is used', submissions.length === 1 && submissions[0].includes('email=test%40gmail.com'), submissions.join(' | '));

  console.log('\nNo overlapping runs of the same site');
  check('first run acquires the lock', tryAcquireSiteRun('site-x') === true);
  check('a second run of the same site is refused while the first is running', tryAcquireSiteRun('site-x') === false);
  check('a different site is not affected', tryAcquireSiteRun('site-y') === true);
  releaseSiteRun('site-x');
  releaseSiteRun('site-y');
  check('the site can be tested again after the run finishes', tryAcquireSiteRun('site-x') === true);
  releaseSiteRun('site-x');

  console.log('\nMetForm server reply (status decides, not the default error text)');`);
t = rep(t, "const { runFormTest, runSiteTest } = await import('../lib/tester.ts');", "const { runFormTest, runSiteTest } = await import('../lib/tester.ts');\nconst { tryAcquireSiteRun, releaseSiteRun } = await import('../lib/run-lock.ts');");
fs.writeFileSync('scripts/test-form-discovery.mts', t);
console.log('ok');
