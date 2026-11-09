import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import mongoose from 'mongoose';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function loadEnv() {
  const envFiles = [
    path.resolve(__dirname, '../.env.local'),
    path.resolve(__dirname, '../.env'),
  ];
  for (const envPath of envFiles) {
    if (fs.existsSync(envPath)) {
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

const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/formguard_pro';

// Schemas
const SiteSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    url: { type: String, required: true },
    formPluginType: { type: String, default: 'Elementor Pro' },
    fields: Array,
    submitButtonSelector: String,
    verificationMethod: String,
    expectedSuccessValue: String,
    notificationPreferences: Object,
    isActive: Boolean,
    lastStatus: String,
    lastCheckedAt: Date,
  },
  { timestamps: true }
);

const TestLogSchema = new mongoose.Schema(
  {
    siteId: { type: mongoose.Schema.Types.ObjectId, ref: 'Site' },
    status: String,
    durationMs: Number,
    errorMessage: String,
    consoleErrors: [String],
    screenshotBase64: String,
    notificationsSent: Object,
    executedAt: Date,
  },
  { timestamps: true }
);

const SettingsSchema = new mongoose.Schema(
  {
    defaultNotificationEmails: [String],
    defaultSlackWebhookUrl: String,
    defaultSlackChannelName: String,
    smtpConfig: Object,
    testBotEmail: String,
  },
  { timestamps: true }
);

const Site = mongoose.models.Site || mongoose.model('Site', SiteSchema);
const TestLog = mongoose.models.TestLog || mongoose.model('TestLog', TestLogSchema);
const Settings = mongoose.models.Settings || mongoose.model('Settings', SettingsSchema);

async function seed() {
  console.log('========================================================');
  console.log('       FormGuard Pro — Demo Data Seeder                 ');
  console.log('========================================================\n');

  try {
    console.log(`Connecting to MongoDB...`);
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 5000 });
    console.log('Connected successfully.\n');

    // Ensure Settings exist
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        defaultNotificationEmails: ['zanshahidali@gmail.com'],
        defaultSlackWebhookUrl: 'https://hooks.slack.com/services/DEMO/WEBHOOK/SAMPLE',
        defaultSlackChannelName: '#agency-alerts',
        smtpConfig: {
          host: 'smtp.gmail.com',
          port: 587,
          user: 'alerts@demo.com',
          pass: '',
          fromEmail: 'alerts@formguardpro.com',
        },
        testBotEmail: 'qa-bot@formguardpro.com',
      });
      console.log('✅ Seeded default global Settings.');
    }

    // Demo Sites Data
    const demoSites = [
      {
        name: 'Stow Line Roofing',
        url: 'https://stowlineroofing.com/contact-us',
        formPluginType: 'Elementor Pro',
        fields: [
          { label: 'Name', selector: 'input[name="form_fields[name]"]', type: 'text', testValue: 'FormGuard QA Bot' },
          { label: 'Email', selector: 'input[name="form_fields[email]"]', type: 'email', testValue: 'qa-bot@formguardpro.com' },
          { label: 'Phone', selector: 'input[name="form_fields[field_phone]"]', type: 'tel', testValue: '+1 555-019-2834' },
          { label: 'Message', selector: 'textarea[name="form_fields[message]"]', type: 'textarea', testValue: 'Daily form health check test entry.' },
        ],
        submitButtonSelector: 'button.elementor-button[type="submit"]',
        verificationMethod: 'selector_visible',
        expectedSuccessValue: '.elementor-message-success',
        notificationPreferences: {
          useGlobalDefaults: true,
          enableEmail: true,
          customEmails: [],
          enableSlack: true,
          customSlackWebhookUrl: '',
          notifyOnSuccess: false,
        },
        isActive: true,
        lastStatus: 'healthy',
        lastCheckedAt: new Date(Date.now() - 1000 * 60 * 35),
      },
      {
        name: 'Urban Dental Clinic',
        url: 'https://urbandentalclinic.com/book-appointment',
        formPluginType: 'Contact Form 7',
        fields: [
          { label: 'Your Name', selector: 'input[name="your-name"]', type: 'text', testValue: 'FormGuard QA Bot' },
          { label: 'Your Email', selector: 'input[name="your-email"]', type: 'email', testValue: 'qa-bot@formguardpro.com' },
          { label: 'Your Phone', selector: 'input[name="your-tel"]', type: 'tel', testValue: '+1 555-019-2834' },
          { label: 'Message', selector: 'textarea[name="your-message"]', type: 'textarea', testValue: 'Daily form health check test entry.' },
        ],
        submitButtonSelector: 'input.wpcf7-submit',
        verificationMethod: 'selector_visible',
        expectedSuccessValue: '.wpcf7-mail-sent-ok',
        notificationPreferences: {
          useGlobalDefaults: true,
          enableEmail: true,
          customEmails: [],
          enableSlack: true,
          customSlackWebhookUrl: '',
          notifyOnSuccess: false,
        },
        isActive: true,
        lastStatus: 'healthy',
        lastCheckedAt: new Date(Date.now() - 1000 * 60 * 95),
      },
      {
        name: 'Apex Legal Partners',
        url: 'https://apexlegalpartners.com/free-consultation',
        formPluginType: 'WPForms',
        fields: [
          { label: 'First Name', selector: 'input.wpforms-field-name-first', type: 'text', testValue: 'FormGuard QA Bot' },
          { label: 'Email', selector: 'input[type="email"].wpforms-field-email', type: 'email', testValue: 'qa-bot@formguardpro.com' },
          { label: 'Message', selector: 'textarea.wpforms-field-medium', type: 'textarea', testValue: 'Consultation request test.' },
        ],
        submitButtonSelector: 'button.wpforms-submit[type="submit"]',
        verificationMethod: 'selector_visible',
        expectedSuccessValue: 'div.wpforms-confirmation-container-full',
        notificationPreferences: {
          useGlobalDefaults: false,
          enableEmail: true,
          customEmails: ['apex-leads@partnerfirm.com'],
          enableSlack: true,
          customSlackWebhookUrl: 'https://hooks.slack.com/services/DEMO/APEX/CLIENT',
          notifyOnSuccess: false,
        },
        isActive: true,
        lastStatus: 'failing',
        lastCheckedAt: new Date(Date.now() - 1000 * 60 * 15),
      },
    ];

    console.log('Seeding sample client WordPress sites...');
    for (const siteData of demoSites) {
      const existing = await Site.findOne({ name: siteData.name });
      let siteDoc = existing;
      if (!existing) {
        siteDoc = await Site.create(siteData);
        console.log(`  + Created site: ${siteData.name}`);
      } else {
        console.log(`  * Site already exists: ${siteData.name}`);
      }

      // Seed realistic logs for this site
      const existingLogsCount = await TestLog.countDocuments({ siteId: siteDoc._id });
      if (existingLogsCount === 0) {
        if (siteData.lastStatus === 'healthy') {
          await TestLog.create({
            siteId: siteDoc._id,
            status: 'passed',
            durationMs: 3842,
            errorMessage: '',
            consoleErrors: [],
            screenshotBase64: '',
            notificationsSent: { email: false, slack: false },
            executedAt: new Date(Date.now() - 1000 * 60 * 35),
          });
          await TestLog.create({
            siteId: siteDoc._id,
            status: 'passed',
            durationMs: 4120,
            errorMessage: '',
            consoleErrors: [],
            screenshotBase64: '',
            notificationsSent: { email: false, slack: false },
            executedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
          });
        } else {
          // 1x1 red pixel PNG base64 for demo screenshot representation
          const sampleBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

          await TestLog.create({
            siteId: siteDoc._id,
            status: 'failed',
            durationMs: 16420,
            errorMessage: 'Verification failed: Confirmation message was not visible within 15 seconds after submission.',
            consoleErrors: [
              '[ConsoleError] Uncaught TypeError: Cannot read properties of undefined (reading "ajax_url")',
              '[PageError] LiteSpeed Cache minification parse error on scripts.bundle.js:142',
            ],
            screenshotBase64: sampleBase64,
            notificationsSent: { email: true, slack: true },
            executedAt: new Date(Date.now() - 1000 * 60 * 15),
          });
        }
      }
    }

    console.log('\n🎉 Demo seeding completed successfully!');
    console.log('You can now open http://localhost:3000 to see populated sites, KPIs, and failure logs.');
    console.log('========================================================');
    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error('Seeding failed:', err.message || err);
    process.exit(1);
  }
}

seed();

