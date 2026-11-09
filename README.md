# FormGuard Pro 🛡️

**Automated Multi-Site WordPress Contact Form Monitoring SaaS & Internal Tool**

FormGuard Pro monitors WordPress contact forms across multiple client websites daily. It launches real headless Chromium browsers via **Playwright**, navigates to form pages, fills inputs using predefined test credentials, submits the forms, verifies success messages or redirects, captures viewport screenshots on failures, and immediately dispatches alerts to **Slack** and **Email (SMTP)** with inline failure screenshots.

---

## 🚀 Key Features

- **Real Playwright Browser Automation**: Dispatches headless Chromium instances to interact with real DOM elements, testing forms just like real users.
- **Client Lead Inbox Isolation**: Forms use a standard bot email (`qa-bot@formguardpro.com`). By applying simple conditional logic in your client's WordPress form builder (Elementor, WPForms, CF7, etc.), submissions bypass client inboxes with **zero WordPress plugins required**.
- **1-Click Form Presets**: Auto-populates selectors and verification rules for:
  - **Elementor Pro Form Widget**
  - **Contact Form 7 (CF7)**
  - **MetForm (Elementor Addon)**
  - **WPForms**
  - **Gravity Forms**
  - **Custom / Generic HTML5 Forms**
- **Dynamic Form Field Builder**: Easily customize, add, or remove text, email, phone, textarea, dropdown select, and checkbox fields.
- **Interactive Verification Engine**: Supports `text_visible`, `selector_visible` (CSS selector check), and `url_redirect` confirmation checks.
- **Failure Screenshot Capture**: Automatically captures a full viewport Base64 screenshot upon failure and logs all browser JS console errors to diagnose minification or caching conflicts (LiteSpeed / WP Rocket / Cloudflare).
- **Flexible Notification Routing**:
  - Global agency defaults (central Slack channel & agency emails).
  - Per-site routing overrides to alert specific client teams or individual Slack channels.
  - Rich **Slack Block Kit** notifications with direct dashboard inspection links.
  - HTML emails sent via **Nodemailer / SMTP** with the failure screenshot embedded as an inline attachment.
  - Instant verification buttons: *"Test Slack Webhook"* & *"Send Test Email"*.
- **Automated Scheduling**:
  - Pre-configured GitHub Actions workflow (`.github/workflows/daily-form-monitor.yml`) running daily at 04:00 UTC (9:00 AM PKT).
  - Standalone runner script (`scripts/cron-runner.mjs`) for servers, VPS, or CI/CD runners without serverless timeout limits.
  - Authenticated cron endpoint (`POST /api/test/run-all`) with `CRON_SECRET` protection.
  - Instant manual trigger in the dashboard ("Test Now" for single sites or "Run All Tests").

---

## 🎨 UI & Design Palette

Built with Next.js 14 App Router and styled with Tailwind CSS in a high-contrast professional dark palette:
- **Primary Background / Sidebar**: Navy Blue (`#0F172A`)
- **Secondary Dark Surface**: Dark Blue (`#12263A`)
- **Accent & Primary Buttons**: Sky Blue (`#0EA5E9`) & Teal (`#0B6E77`)
- **Borders & Dividers**: Slate Deep (`#1E3A5F` / `#1E293B`)
- **Status Indicators**: Emerald Green (`#10B981` Healthy), Red (`#EF4444` Failing), Amber (`#F59E0B` Pending)

---

## 📁 Project Structure

```
├── .github/
│   └── workflows/
│       └── daily-form-monitor.yml   # GitHub Actions automated daily cron workflow
├── app/
│   ├── api/
│   │   ├── logs/route.ts            # Fetch execution logs with filtering & pagination
│   │   ├── settings/
│   │   │   ├── route.ts             # Get and update global alert/SMTP settings
│   │   │   └── test-notification/   # Send instant test Slack or Email alert
│   │   ├── sites/
│   │   │   ├── route.ts             # List all sites / create new site
│   │   │   └── [id]/route.ts        # Get, update, delete specific site
│   │   └── test/
│   │       ├── run-all/route.ts     # Batch runner endpoint (secured by CRON_SECRET)
│   │       └── run-single/route.ts  # Immediate single site test endpoint
│   ├── logs/page.tsx                # Execution logs table with modal failure screenshot viewer
│   ├── settings/page.tsx            # Global notification & SMTP credentials configuration
│   ├── sites/
│   │   ├── new/page.tsx             # Add new website form monitor
│   │   └── [id]/page.tsx            # Edit site form configuration
│   ├── globals.css                  # Custom Tailwind dark styling & scrollbars
│   ├── layout.tsx                   # Main layout with persistent Sidebar & Navbar
│   └── page.tsx                     # Dashboard overview: KPIs & monitored sites table
├── components/
│   ├── LogDetailModal.tsx           # Interactive failure inspect modal with screenshot zoom/download
│   ├── Navbar.tsx                   # Top bar with status and "Run All Tests" trigger
│   ├── RunAllModal.tsx              # Live batch execution modal with status counters
│   ├── Sidebar.tsx                  # Brand sidebar navigation
│   └── SiteForm.tsx                 # Dynamic field builder & preset auto-populator
├── lib/
│   ├── mongodb.ts                   # Mongoose connection pool with hot-reload cache
│   ├── notifier.ts                  # Slack Block Kit & Nodemailer SMTP alert dispatcher
│   ├── presets.ts                   # Pre-configured selector presets for WordPress form plugins
│   └── tester.ts                    # Playwright Chromium headless form testing engine
├── models/
│   ├── Settings.ts                  # Global notification defaults & SMTP credentials
│   ├── Site.ts                      # Monitored WordPress sites & selector configurations
│   └── TestLog.ts                   # Execution history, console errors & Base64 screenshots
├── scripts/
│   ├── cron-runner.mjs              # Standalone Node/Playwright daily runner for CI/CD & VPS
│   └── test-playwright.mjs          # Local test verification suite with mock form server
├── .env.example                     # Environment variables template
├── package.json
└── tailwind.config.ts
```

---

## ⚙️ Environment Configuration

Create a `.env.local` file in the project root:

```env
# MongoDB Atlas Connection String
MONGODB_URI=mongodb+srv://<username>:<password>@cluster0.mongodb.net/formguard_pro?retryWrites=true&w=majority

# Base Application URL (for links in alerts)
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Automated Cron Execution Secret (Used for authenticating /api/test/run-all)
CRON_SECRET=formguard_super_secret_cron_token_12345

# Fallback Notification Defaults
NOTIFICATION_EMAIL=zanshahidali@gmail.com
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/T00/B00/XXXX

# SMTP Server Credentials (for inline failure screenshot email alerts)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_smtp_app_password
SMTP_FROM=alerts@formguardpro.com
```

---

## 🛠️ Installation & Setup

1. **Clone and install dependencies**:
   ```bash
   git clone <repo-url>
   cd "FormGuard Pro"
   npm install
   ```

2. **Install Playwright Chromium**:
   ```bash
   npx playwright install chromium
   ```

3. **Verify Playwright Engine with the built-in mock test**:
   ```bash
   npm run test:playwright
   ```
   *This will run a local mock form server, verify successful submission, and verify failure screenshot capture.*

4. **Run development server**:
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view your dashboard.

5. **Build for production**:
   ```bash
   npm run build
   npm run start
   ```

---

## 🛡️ Client Inbox Protection (Conditional Logic Setup)

To ensure daily automated test submissions do not clutter your client's lead inbox:
1. In the client's WordPress form builder (e.g. Elementor Pro Form Actions, WPForms Conditional Logic, CF7 redirect rules), add a condition:
   - **Condition**: If `Email` contains `qa-bot@formguardpro.com` (or your configured `testBotEmail`).
   - **Action**: Do not send email notification to client / Route to a dev inbox or junk folder.
2. The form will still execute its normal submission lifecycle and display the success confirmation, validating the form is functioning correctly without notifying the client.

---

## ⏰ Automated Daily Monitoring Setup

### Option A: GitHub Actions (Recommended)
Add the following secrets to your GitHub repository (**Settings -> Secrets and variables -> Actions**):
- `MONGODB_URI`
- `SLACK_WEBHOOK_URL`
- `NOTIFICATION_EMAIL`
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`
- `NEXT_PUBLIC_APP_URL`

The workflow in `.github/workflows/daily-form-monitor.yml` runs daily at 04:00 UTC (9:00 AM PKT) using the native Ubuntu Playwright runner, preventing serverless timeouts.

### Option B: Standalone Script on VPS or Cron Job
Run the standalone runner anytime:
```bash
npm run cron:run
# or
node scripts/cron-runner.mjs
```

### Option C: HTTP Webhook / Vercel Cron
Send a POST request to:
```bash
curl -X POST "https://your-domain.com/api/test/run-all" \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## 📄 License
MIT License. Built for modern digital marketing and web agencies managing multi-client WordPress portfolios.

