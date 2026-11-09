import http from 'http';
import { runFormTest } from '../lib/tester.ts';

// 1. Create a lightweight local HTTP server serving a test form mimicking an Elementor Pro form
const server = http.createServer((req, res) => {
  if (req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
          <body>
            <h2>Submission Received</h2>
            <div class="elementor-message elementor-message-success">The form was sent successfully.</div>
          </body>
        </html>
      `);
    });
    return;
  }

  res.writeHead(200, { 'Content-Type': 'text/html' });
  res.end(`
    <!DOCTYPE html>
    <html>
      <head><title>Test WordPress Elementor Form</title></head>
      <body>
        <form id="contact-form" class="elementor-form" method="POST" action="/">
          <div>
            <label>Name</label>
            <input type="text" name="form_fields[name]" required />
          </div>
          <div>
            <label>Email</label>
            <input type="email" name="form_fields[email]" required />
          </div>
          <div>
            <label>Phone</label>
            <input type="tel" name="form_fields[field_phone]" />
          </div>
          <div>
            <label>Message</label>
            <textarea name="form_fields[message]"></textarea>
          </div>
          <button type="submit" class="elementor-button">Send Message</button>
        </form>
      </body>
    </html>
  `);
});

server.listen(4892, async () => {
  console.log('Local test mock server running at http://localhost:4892');

  const siteConfig = {
    name: 'Mock Test Site',
    url: 'http://localhost:4892',
    formPluginType: 'Elementor Pro',
    fields: [
      { label: 'Name', selector: 'input[name="form_fields[name]"]', type: 'text', testValue: 'FormGuard QA Bot' },
      { label: 'Email', selector: 'input[name="form_fields[email]"]', type: 'email', testValue: 'qa-bot@formguardpro.com' },
      { label: 'Phone', selector: 'input[name="form_fields[field_phone]"]', type: 'tel', testValue: '+1 555-019-2834' },
      { label: 'Message', selector: 'textarea[name="form_fields[message]"]', type: 'textarea', testValue: 'Automated test verification.' },
    ],
    submitButtonSelector: 'form.elementor-form button[type="submit"]',
    verificationMethod: 'selector_visible',
    expectedSuccessValue: '.elementor-message-success',
  };

  try {
    console.log('\n--- 1. Testing Successful Submission Scenario ---');
    const result = await runFormTest(siteConfig);
    console.log('Test Result:', {
      status: result.status,
      durationMs: result.durationMs,
      consoleErrors: result.consoleErrors,
      hasScreenshot: Boolean(result.screenshotBase64),
    });

    if (result.status !== 'passed') {
      console.error('Expected test to pass, but got:', result);
      process.exit(1);
    }
    console.log('✅ Passing test verified successfully!');

    console.log('\n--- 2. Testing Failure Scenario & Base64 Screenshot Capture ---');
    const failingConfig = {
      ...siteConfig,
      expectedSuccessValue: '.non-existent-selector-that-fails-verification',
    };
    const failResult = await runFormTest(failingConfig);
    console.log('Failure Test Result:', {
      status: failResult.status,
      errorMessage: failResult.errorMessage,
      durationMs: failResult.durationMs,
      hasScreenshot: Boolean(failResult.screenshotBase64),
      screenshotLength: failResult.screenshotBase64 ? failResult.screenshotBase64.length : 0,
    });

    if (failResult.status !== 'failed' || !failResult.screenshotBase64) {
      console.error('Expected failure with screenshot, but got:', failResult);
      process.exit(1);
    }
    console.log('✅ Failure capture and Base64 screenshot verified successfully!');

    server.close(() => {
      console.log('\n🎉 ALL PLAYWRIGHT FORM TESTING VERIFICATIONS PASSED!\n');
      process.exit(0);
    });
  } catch (err) {
    console.error('Test execution failed:', err);
    server.close();
    process.exit(1);
  }
});

