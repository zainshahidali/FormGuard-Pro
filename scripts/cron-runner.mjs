import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';
import { chromium } from 'playwright';
import nodemailer from 'nodemailer';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Simple .env parser to avoid extra dependency issues in standalone runner
function loadEnv() {
  const envPaths = [
    path.resolve(__dirname, '../.env.local'),
    path.resolve(__dirname, '../.env'),
  ];

  for (const envPath of envPaths) {
    if (fs.existsSync(envPath)) {
      console.log(`[FormGuard Cron] Loading environment variables from ${path.basename(envPath)}`);
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const equalIdx = trimmed.indexOf('=');
        if (equalIdx > 0) {
          const key = trimmed.slice(0, equalIdx).trim();
          let value = trimmed.slice(equalIdx + 1).trim();
          if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
            value = value.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = value;
          }
        }
      }
    }
  }
}

loadEnv();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/formguard_pro';

// Mongoose Schemas for Runner
const FormFieldSchema = new mongoose.Schema(
  {
    label: { type: String, required: true },
    selector: { type: String, required: true },
    type: { type: String, default: 'text' },
    testValue: { type: String, default: '' },
  },
  { _id: false }
);

const NotificationPreferencesSchema = new mongoose.Schema(
  {
    useGlobalDefaults: { type: Boolean, default: true },
    enableEmail: { type: Boolean, default: true },
    customEmails: { type: [String], default: [] },
    enableSlack: { type: Boolean, default: true },
    customSlackWebhookUrl: { type: String, default: '' },
    notifyOnSuccess: { type: Boolean, default: false },
  },
  { _id: false }
);

const SiteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    forms: [mongoose.Schema.Types.Mixed],
    formPluginType: { type: String, default: 'Elementor Pro' },
    fields: [FormFieldSchema],
    submitButtonSelector: { type: String, required: true },
    verificationMethod: { type: String, default: 'text_visible' },
    expectedSuccessValue: { type: String, required: true },
    notificationPreferences: { type: NotificationPreferencesSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
    lastStatus: { type: String, default: 'pending' },
    lastCheckedAt: { type: Date },
  },
  { timestamps: true }
);

const SettingsSchema = new mongoose.Schema(
  {
    defaultNotificationEmails: [String],
    defaultSlackWebhookUrl: String,
    defaultSlackChannelName: String,
    smtpConfig: {
      host: String,
      port: Number,
      user: String,
      pass: String,
      fromEmail: String,
    },
    testBotEmail: String,
  },
  { timestamps: true }
);

const TestLogSchema = new mongoose.Schema(
  {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site', required: true },
    status: { type: String, required: true },
    durationMs: { type: Number, default: 0 },
    errorMessage: { type: String, default: '' },
    consoleErrors: [String],
    screenshotBase64: { type: String, default: '' },
    notificationsSent: {
      email: { type: Boolean, default: false },
      slack: { type: Boolean, default: false },
    },
    executedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

const Site = mongoose.models.Site || mongoose.model('Site', SiteSchema);
const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);
const TestLog = mongoose.models.TestLog || mongoose.model('TestLog', TestLogSchema);

// Runner Logic
async function runFormTest(site) {
  const startTime = Date.now();
  const consoleErrors = [];
  let browser = null;
  let page = null;

  try {
    browser = await chromium.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
    });

    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 FormGuardPro/1.0',
    });

    page = await context.newPage();

    page.on('pageerror', (err) => {
      consoleErrors.push(`[PageError] ${err.message || String(err)}`);
    });

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(`[ConsoleError] ${msg.text()}`);
      }
    });

    try {
      await page.goto(site.url, { waitUntil: 'networkidle', timeout: 30000 });
    } catch {
      await page.waitForLoadState('domcontentloaded', { timeout: 15000 }).catch(() => {});
    }

    await page.waitForTimeout(1000);

    // Fill fields
    if (site.fields && Array.isArray(site.fields)) {
      for (const field of site.fields) {
        if (!field.selector) continue;
        const locator = page.locator(field.selector).first();
        await locator.waitFor({ state: 'attached', timeout: 10000 });
        await locator.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});

        const type = (field.type || 'text').toLowerCase();
        const testVal = field.testValue || 'Test Value';
        const wantsRandom = !testVal || testVal === '[Random Option]' || testVal.toLowerCase().includes('random');

        const inputTypeAttr = await locator.getAttribute('type').catch(() => null);
        const isHidden = inputTypeAttr === 'hidden';
        const isSelectType = type === 'select';

        const customControl = locator.locator('xpath=..').locator('.mf_select__control, .mf-input-select, [class*="select__control"], [class*="custom-select"]').first();
        const hasCustomControl = (await customControl.count().catch(() => 0)) > 0;

        if (hasCustomControl || (isSelectType && isHidden)) {
          try {
            const clickTarget = hasCustomControl ? customControl : page.locator('.mf_select__control, .mf-input-select').first();
            await clickTarget.click({ timeout: 4000 });
            await page.waitForTimeout(300);

            const optionLocators = page.locator('[class*="option"], [id*="react-select"][id*="option"], .select-options li');
            const optCount = await optionLocators.count();

            if (optCount > 0) {
              let chosenIdx = Math.floor(Math.random() * optCount);
              if (!wantsRandom) {
                for (let i = 0; i < optCount; i++) {
                  const optText = (await optionLocators.nth(i).textContent()) || '';
                  if (optText.toLowerCase().includes(testVal.trim().toLowerCase())) {
                    chosenIdx = i;
                    break;
                  }
                }
              }
              await optionLocators.nth(chosenIdx).click({ timeout: 4000 });
            }
          } catch {
            await locator.evaluate((el, val) => {
              el.value = val === '[Random Option]' ? 'General Inquiry' : val;
              el.dispatchEvent(new Event('input', { bubbles: true }));
              el.dispatchEvent(new Event('change', { bubbles: true }));
            }, testVal);
          }
        } else if (isSelectType) {
          try {
            const options = await locator.locator('option').all();
            const validIndices = [];
            for (let i = 0; i < options.length; i++) {
              const optText = ((await options[i].textContent()) || '').trim();
              const optVal = ((await options[i].getAttribute('value')) || '').trim();
              const isDis = await options[i].isDisabled();
              const isPlaceholder = optText.toLowerCase().includes('select') || optText.toLowerCase().includes('choose') || !optText;
              if (!isDis && (optVal || optText) && !isPlaceholder) {
                validIndices.push(i);
              }
            }
            if (wantsRandom && validIndices.length > 0) {
              const rIdx = validIndices[Math.floor(Math.random() * validIndices.length)];
              await locator.selectOption({ index: rIdx });
            } else {
              await locator.selectOption(testVal).catch(async () => {
                await locator.selectOption({ index: validIndices[0] || 1 });
              });
            }
          } catch {
            await locator.selectOption({ index: 1 }).catch(() => {});
          }
        } else if (isHidden) {
          await locator.evaluate((el, val) => {
            el.value = val;
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
          }, testVal);
        } else if (type === 'checkbox') {
          if (testVal === 'true' || testVal === '1' || testVal === 'checked' || !testVal) {
            await locator.check({ force: true });
          } else {
            await locator.uncheck({ force: true });
          }
        } else {
          await locator.fill(testVal, { timeout: 8000 });
        }
      }
    }

    // Submit
    const submitBtn = page.locator(site.submitButtonSelector).first();
    await submitBtn.waitFor({ state: 'visible', timeout: 10000 });
    await submitBtn.scrollIntoViewIfNeeded({ timeout: 5000 }).catch(() => {});
    await submitBtn.click({ timeout: 8000 });

    // Verify
    const verifyMethod = site.verificationMethod || 'text_visible';
    const expectedVal = site.expectedSuccessValue?.trim();

    if (verifyMethod === 'text_visible') {
      const textLoc = page.getByText(expectedVal, { exact: false }).first();
      await textLoc.waitFor({ state: 'visible', timeout: 15000 });
    } else if (verifyMethod === 'selector_visible') {
      const selLoc = page.locator(expectedVal).first();
      await selLoc.waitFor({ state: 'visible', timeout: 15000 });
    } else if (verifyMethod === 'url_redirect') {
      await page.waitForURL((url) => url.href.includes(expectedVal), { timeout: 15000 });
    }

    const durationMs = Date.now() - startTime;
    return {
      status: 'passed',
      durationMs,
      consoleErrors: consoleErrors.slice(-10),
      screenshotBase64: '',
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    let screenshotBase64 = '';
    if (page) {
      try {
        const buffer = await page.screenshot({ fullPage: false, timeout: 5000 });
        screenshotBase64 = buffer.toString('base64');
      } catch (sErr) {
        console.error('Failed to capture failure screenshot:', sErr);
      }
    }
    return {
      status: 'failed',
      durationMs,
      errorMessage: err.message || 'Unknown test failure',
      consoleErrors: consoleErrors.slice(-10),
      screenshotBase64,
    };
  } finally {
    if (browser) {
      try {
        await browser.close();
      } catch (cErr) {
        console.error('Error closing browser:', cErr);
      }
    }
  }
}

async function sendSlackNotification(webhookUrl, site, result) {
  try {
    const isFailed = result.status === 'failed';
    const payload = {
      text: `${isFailed ? '🚨' : '✅'} [FormGuard Pro] ${site.name}: ${
        isFailed ? 'FORM SUBMISSION FAILED' : 'FORM SUBMISSION PASSED'
      }`,
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${isFailed ? '🚨' : '✅'} [FormGuard Pro] ${
              isFailed ? 'FORM SUBMISSION FAILED' : 'FORM SUBMISSION PASSED'
            }`,
            emoji: true,
          },
        },
        {
          type: 'section',
          fields: [
            { type: 'mrkdwn', text: `*Site:*\n${site.name}` },
            { type: 'mrkdwn', text: `*Plugin:*\n${site.formPluginType || 'Elementor Pro'}` },
            { type: 'mrkdwn', text: `*URL:*\n<${site.url}|${site.url}>` },
            { type: 'mrkdwn', text: `*Duration:*\n${result.durationMs}ms` },
          ],
        },
      ],
    };

    if (isFailed && result.errorMessage) {
      payload.blocks.push({
        type: 'section',
        text: { type: 'mrkdwn', text: `*Failure Reason:*\n\`\`\`${result.errorMessage}\`\`\`` },
      });
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    return res.ok;
  } catch (err) {
    console.error('Error sending Slack alert:', err);
    return false;
  }
}

async function sendEmailNotification(smtpConfig, toEmails, site, result) {
  if (!toEmails || toEmails.length === 0) return false;
  const host = smtpConfig?.host || process.env.SMTP_HOST;
  const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 587);
  const user = smtpConfig?.user || process.env.SMTP_USER;
  const pass = smtpConfig?.pass || process.env.SMTP_PASS;
  const fromEmail = smtpConfig?.fromEmail || process.env.SMTP_FROM || 'alerts@formguardpro.com';

  if (!host || !user || !pass) return false;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const isFailed = result.status === 'failed';
  const attachments = [];
  let screenshotHtml = '';

  if (result.screenshotBase64) {
    attachments.push({
      filename: `failure-${site.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`,
      content: Buffer.from(result.screenshotBase64, 'base64'),
      cid: 'failure-screenshot',
    });
    screenshotHtml = `
      <div style="margin-top: 20px; padding: 12px; background: #0F172A; border-radius: 8px;">
        <h4 style="color: #F8FAFC; margin-top: 0;">Captured Failure Viewport:</h4>
        <img src="cid:failure-screenshot" alt="Failure Screenshot" style="max-width: 100%; border-radius: 6px;" />
      </div>
    `;
  }

  const html = `
    <div style="font-family: sans-serif; background: #090D16; color: #F8FAFC; padding: 20px;">
      <div style="max-width: 600px; margin: 0 auto; background: #12263A; padding: 24px; border-radius: 8px;">
        <h2 style="color: ${isFailed ? '#EF4444' : '#10B981'}; margin-top: 0;">
          ${isFailed ? '🚨 Form Health Check Alert: FAILED' : '✅ Form Health Check Alert: PASSED'}
        </h2>
        <p><strong>Site:</strong> ${site.name}</p>
        <p><strong>URL:</strong> <a href="${site.url}" style="color: #0EA5E9;">${site.url}</a></p>
        <p><strong>Plugin:</strong> ${site.formPluginType}</p>
        <p><strong>Response Time:</strong> ${result.durationMs}ms</p>
        ${isFailed ? `<p style="color: #F87171;"><strong>Error:</strong> ${result.errorMessage}</p>` : ''}
        ${screenshotHtml}
      </div>
    </div>
  `;

  try {
    await transporter.sendMail({
      from: `"FormGuard Pro" <${fromEmail}>`,
      to: toEmails.join(', '),
      subject: `${isFailed ? '🚨 [FAILED]' : '✅ [PASSED]'} Form Monitoring: ${site.name}`,
      html,
      attachments,
    });
    return true;
  } catch (err) {
    console.error('Error sending Email alert:', err);
    return false;
  }
}

async function main() {
  console.log('=====================================================');
  console.log('  FormGuard Pro — Automated Daily Form Monitor Cron  ');
  console.log('=====================================================');

  try {
    console.log(`[FormGuard Cron] Connecting to MongoDB Atlas: ${MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//***:***@')}`);
    await mongoose.connect(MONGODB_URI, { serverSelectionTimeoutMS: 8000 });
    console.log('[FormGuard Cron] MongoDB Connected successfully.');

    const settings = await Settings.findOne();
    const activeSites = await Site.find({ isActive: true });

    console.log(`[FormGuard Cron] Found ${activeSites.length} active site(s) to monitor.`);

    let passedTotal = 0;
    let failedTotal = 0;

    for (const site of activeSites) {
      console.log(`\n--> Testing [${site.name}] (${site.url})...`);

      const formsToTest =
        site.forms && site.forms.length > 0
          ? site.forms.filter((f) => f.isActive !== false)
          : [site];

      console.log(`    Testing ${formsToTest.length} form(s) for ${site.name}...`);
      let siteStatus = 'passed';
      let siteError = '';
      let siteScreenshot = '';
      const allConsoleErrors = [];
      let totalDuration = 0;
      const formResults = [];

      for (const formItem of formsToTest) {
        const formPayload = {
          url: formItem.pageUrl || site.url,
          fields: formItem.fields || [],
          submitButtonSelector: formItem.submitButtonSelector,
          verificationMethod: formItem.verificationMethod,
          expectedSuccessValue: formItem.expectedSuccessValue,
          name: `${site.name} — ${formItem.name || 'Form'}`,
        };

        const formRes = await runFormTest(formPayload);
        totalDuration += formRes.durationMs;
        if (formRes.consoleErrors) allConsoleErrors.push(...formRes.consoleErrors);

        formResults.push({
          formName: formItem.name || 'Form',
          pageUrl: formItem.pageUrl || site.url,
          status: formRes.status,
          durationMs: formRes.durationMs,
          errorMessage: formRes.errorMessage || '',
          screenshotBase64: formRes.screenshotBase64 || '',
        });

        if (formRes.status === 'failed') {
          siteStatus = 'failed';
          if (!siteError) {
            siteError = `Form "${formItem.name}" failed: ${formRes.errorMessage}`;
            siteScreenshot = formRes.screenshotBase64 || '';
          }
          console.log(`    ❌ [${formItem.name}] FAILED in ${formRes.durationMs}ms: ${formRes.errorMessage}`);
        } else {
          console.log(`    ✅ [${formItem.name}] PASSED in ${formRes.durationMs}ms`);
        }
      }

      if (siteStatus === 'passed') {
        passedTotal++;
        console.log(`    ✅ SITE PASSED (All ${formsToTest.length} forms verified)`);
      } else {
        failedTotal++;
        console.log(`    ❌ SITE FAILED (${siteError})`);
      }

      // Save log
      const log = await TestLog.create({
        siteId: site._id,
        status: siteStatus,
        durationMs: totalDuration,
        errorMessage: siteError,
        consoleErrors: Array.from(new Set(allConsoleErrors)).slice(-10),
        screenshotBase64: siteScreenshot,
        formResults,
        notificationsSent: { email: false, slack: false },
        executedAt: new Date(),
      });

      // Update site
      site.lastStatus = siteStatus === 'passed' ? 'healthy' : 'failing';
      site.lastCheckedAt = new Date();
      await site.save();

      // Dispatch Notifications
      const isFailed = siteStatus === 'failed';
      const prefs = site.notificationPreferences || {};
      const shouldNotify = isFailed || Boolean(prefs.notifyOnSuccess);

      let emailSent = false;
      let slackSent = false;

      if (shouldNotify) {
        // Slack
        if (prefs.enableSlack !== false) {
          const slackWebhook =
            (!prefs.useGlobalDefaults && prefs.customSlackWebhookUrl) ||
            settings?.defaultSlackWebhookUrl ||
            process.env.SLACK_WEBHOOK_URL;

          if (slackWebhook) {
            slackSent = await sendSlackNotification(slackWebhook, site, result);
            console.log(`    Slack notification: ${slackSent ? 'Delivered' : 'Failed'}`);
          }
        }

        // Email
        if (prefs.enableEmail !== false) {
          const emails =
            (!prefs.useGlobalDefaults && prefs.customEmails?.length)
              ? prefs.customEmails
              : (settings?.defaultNotificationEmails || (process.env.NOTIFICATION_EMAIL ? [process.env.NOTIFICATION_EMAIL] : []));

          if (emails.length > 0) {
            emailSent = await sendEmailNotification(settings?.smtpConfig, emails, site, result);
            console.log(`    Email notification: ${emailSent ? 'Delivered' : 'Failed'}`);
          }
        }
      }

      log.notificationsSent = { email: emailSent, slack: slackSent };
      await log.save();
    }

    console.log('\n=====================================================');
    console.log(`Execution Summary: Total: ${activeSites.length} | Passed: ${passedTotal} | Failed: ${failedTotal}`);
    console.log('=====================================================');

    await mongoose.disconnect();
    process.exit(failedTotal > 0 ? 1 : 0);
  } catch (err) {
    console.error('Fatal Cron Execution Error:', err);
    process.exit(1);
  }
}

main();

