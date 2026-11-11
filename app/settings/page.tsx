'use client';

import React, { useState, useEffect } from 'react';
import {
  CalendarClock,
  Bell,
  Mail,
  Webhook,
  Settings2,
  Timer,
  Check,
  Zap,
  ShieldCheck,
  Activity,
  Database,
  Sparkles,
  ArrowRight,
  Send,
  LoaderCircle,
  RefreshCw,
  MessageSquare,
} from 'lucide-react';
import { Toggle, Toast, type Notice } from '@/components/ui';

export default function SettingsPage() {
  const [schedule, setSchedule] = useState('04:00');
  const [timezone, setTimezone] = useState('UTC (09:00 AM PKT)');
  const [emails, setEmails] = useState('');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [slackChannelName, setSlackChannelName] = useState('');
  const [testBotEmail, setTestBotEmail] = useState('test@gmail.com');
  const [isDailyEnabled, setIsDailyEnabled] = useState(true);

  // SMTP Settings
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');

  // Toggles
  const [screenshots, setScreenshots] = useState(true);
  const [retries, setRetries] = useState(true);
  const [channels, setChannels] = useState({
    email: true,
    slack: true,
    webhook: false,
  });

  // Loading & Testing states
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingSlack, setIsTestingSlack] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const notify = (message: string, tone: 'success' | 'info' | 'error' = 'success') => {
    setNotice({ id: Date.now(), message, tone });
  };

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.success && data.settings) {
          const s = data.settings;
          setEmails(s.defaultNotificationEmails?.join(', ') || 'zanshahidali@gmail.com');
          setSlackWebhookUrl(s.defaultSlackWebhookUrl || '');
          setSlackChannelName(s.defaultSlackChannelName || '#alerts');
          setTestBotEmail(s.testBotEmail || 'test@gmail.com');
          setIsDailyEnabled(s.isDailyTestingEnabled !== false);

          if (s.smtpConfig) {
            setSmtpHost(s.smtpConfig.host || '');
            setSmtpPort(String(s.smtpConfig.port || 587));
            setSmtpUser(s.smtpConfig.user || '');
            setSmtpPass(s.smtpConfig.pass || '');
            setSmtpFromEmail(s.smtpConfig.fromEmail || 'alerts@formguardpro.com');
          }
        }
      } catch (err) {
        console.error('Failed to load settings:', err);
      } finally {
        setIsLoading(false);
      }
    }
    loadSettings();
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        defaultNotificationEmails: emails
          .split(',')
          .map((e) => e.trim())
          .filter(Boolean),
        defaultSlackWebhookUrl: slackWebhookUrl.trim(),
        defaultSlackChannelName: slackChannelName.trim(),
        testBotEmail: testBotEmail.trim(),
        isDailyTestingEnabled: isDailyEnabled,
        smtpConfig: {
          host: smtpHost.trim(),
          port: Number(smtpPort) || 587,
          user: smtpUser.trim(),
          pass: smtpPass.trim(),
          fromEmail: smtpFromEmail.trim(),
        },
      };

      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save settings.');
      }

      notify('Global settings & notification credentials saved.', 'success');
      window.dispatchEvent(
        new CustomEvent('formguard:daily-testing-toggled', { detail: { enabled: isDailyEnabled } })
      );
    } catch (err: any) {
      notify(err.message || 'Error saving settings.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  // Test Slack
  const handleTestSlack = async () => {
    if (!slackWebhookUrl.trim()) {
      notify('Please enter a Slack Webhook URL first.', 'error');
      return;
    }

    setIsTestingSlack(true);
    try {
      const res = await fetch('/api/settings/test-slack', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: slackWebhookUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Slack webhook dispatch failed.');
      }
      notify('✅ Test notification sent to Slack successfully!', 'success');
    } catch (err: any) {
      notify(err.message || 'Failed to send Slack test.', 'error');
    } finally {
      setIsTestingSlack(false);
    }
  };

  // Test Email
  const handleTestEmail = async () => {
    if (!emails.trim()) {
      notify('Please enter at least one recipient email address.', 'error');
      return;
    }

    setIsTestingEmail(true);
    try {
      const res = await fetch('/api/settings/test-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: emails.split(',')[0].trim(),
          smtpConfig: {
            host: smtpHost.trim(),
            port: Number(smtpPort) || 587,
            user: smtpUser.trim(),
            pass: smtpPass.trim(),
            fromEmail: smtpFromEmail.trim(),
          },
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'SMTP email dispatch failed.');
      }
      notify(`✅ Test alert email sent to ${emails.split(',')[0].trim()}!`, 'success');
    } catch (err: any) {
      notify(err.message || 'Failed to send test email.', 'error');
    } finally {
      setIsTestingEmail(false);
    }
  };

  return (
    <div className="canvas-glow min-h-full">
      <div className="mx-auto w-full max-w-[1130px] px-4 py-7 sm:px-7 lg:px-9">
        {/* Page Heading */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-display text-[10px] font-extrabold tracking-[.17em] text-cobalt">
              PREFERENCES
            </p>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-.035em] text-ink sm:text-[32px]">
              Settings & alerts
            </h1>
            <p className="mt-1.5 text-[13px] text-muted">
              Global defaults inherited by every website unless custom routing is configured.
            </p>
          </div>
          <button className="btn btn-primary btn-lg" onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <RefreshCw size={14} className="animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Check size={15} strokeWidth={2.5} /> Save changes
              </>
            )}
          </button>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.35fr_1fr]">
          {/* Left Column */}
          <div className="space-y-5">
            {/* Automated Schedule Card */}
            <section className="panel animate-rise p-5 sm:p-6">
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef1ff] text-cobalt">
                        <CalendarClock size={17} />
                      </span>
                      <div>
                        <h2 className="font-display text-[14px] font-bold text-ink">Automated schedule</h2>
                        <p className="text-[11.5px] text-muted">When the daily monitoring cron job executes.</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 rounded-xl border border-line bg-[#f8faff] px-3 py-1.5">
                      <span className="text-[12px] font-semibold text-ink">
                        {isDailyEnabled ? 'Daily auto-test enabled' : 'Daily auto-test paused'}
                      </span>
                      <Toggle checked={isDailyEnabled} onChange={setIsDailyEnabled} label="Enable daily automated testing" />
                    </div>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <label className="field-label">Run time</label>
                      <input
                        className="field"
                        type="time"
                        value={schedule}
                        onChange={(e) => setSchedule(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="field-label">Timezone</label>
                      <select
                        className="field"
                        value={timezone}
                        onChange={(e) => setTimezone(e.target.value)}
                      >
                        <option>UTC (09:00 AM PKT)</option>
                        <option>America/New_York</option>
                        <option>Europe/London</option>
                        <option>Asia/Dubai</option>
                      </select>
                    </div>
                  </div>
                  <div className="mt-4 flex items-start gap-2 rounded-xl bg-[#f7f9fc] px-3.5 py-3 text-[11.5px] text-[#6b7b95]">
                    <Zap size={14} className="mt-0.5 shrink-0 text-[#d79b2d]" />
                    <span>
                      Next automated run is scheduled for{' '}
                      <strong className="text-ink">daily at {schedule} UTC (09:00 AM PKT)</strong>. Manual tests can be triggered anytime from the dashboard.
                    </span>
                  </div>
                </section>

                {/* Test Submission Email Card */}
                <section className="panel animate-rise p-5 sm:p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fff4e0] text-[#d79b2d]">
                      <Mail size={17} />
                    </span>
                    <div>
                      <h2 className="font-display text-[14px] font-bold text-ink">Test submission email</h2>
                      <p className="text-[11.5px] text-muted">
                        The email address typed into every email field when a form is tested.
                      </p>
                    </div>
                  </div>
                  <label className="field-label">Email address used in tests</label>
                  <input
                    className="field"
                    type="email"
                    value={testBotEmail}
                    onChange={(e) => setTestBotEmail(e.target.value)}
                    placeholder="formguard-tests@youragency.com"
                  />
                  <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#f7f9fc] px-3.5 py-3 text-[11.5px] text-[#6b7b95]">
                    <Zap size={14} className="mt-0.5 shrink-0 text-[#d79b2d]" />
                    <span>
                      Many forms email a confirmation copy to this address. Use a mailbox <strong className="text-ink">you
                        own</strong> (for example a shared test inbox on your agency domain) so those copies come to you instead
                      of a stranger&apos;s inbox, and so the client can filter tests by this sender. It replaces the email
                      value in <strong className="text-ink">every</strong> email field, for manual and daily tests.
                    </span>
                  </div>
                </section>

                {/* Notification Channels Card */}
                <section className="panel animate-rise p-5 sm:p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e7f8f2] text-mint">
                      <Bell size={17} />
                    </span>
                    <div>
                      <h2 className="font-display text-[14px] font-bold text-ink">
                        Notification channels
                      </h2>
                      <p className="text-[11.5px] text-muted">
                        Where failure alerts and screenshots are dispatched.
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2.5">
                    {/* Email Channel */}
                    <div className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f2f5fa] text-[#71809a]">
                        <Mail size={14} />
                      </span>
                      <div className="flex-1">
                        <p className="text-[12.5px] font-semibold text-ink">Email alerts (SMTP)</p>
                        <p className="text-[11px] text-muted">Include failure screenshots & step logs</p>
                      </div>
                      <Toggle
                        checked={channels.email}
                        onChange={(v) => setChannels({ ...channels, email: v })}
                        label="Email alerts"
                      />
                    </div>

                    {/* Slack Channel */}
                    <div className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f2f5fa] text-[#71809a]">
                        <MessageSquare size={14} />
                      </span>
                      <div className="flex-1">
                        <p className="text-[12.5px] font-semibold text-ink">Slack incoming webhooks</p>
                        <p className="text-[11px] text-muted">Instant message with breakdown to Slack</p>
                      </div>
                      <Toggle
                        checked={channels.slack}
                        onChange={(v) => setChannels({ ...channels, slack: v })}
                        label="Slack notifications"
                      />
                    </div>

                    {/* Webhook API */}
                    <div className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-3">
                      <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#f2f5fa] text-[#71809a]">
                        <Webhook size={14} />
                      </span>
                      <div className="flex-1">
                        <p className="text-[12.5px] font-semibold text-ink">Custom API webhook</p>
                        <p className="text-[11px] text-muted">POST raw payload to endpoint</p>
                      </div>
                      <Toggle
                        checked={channels.webhook}
                        onChange={(v) => setChannels({ ...channels, webhook: v })}
                        label="Custom webhook"
                      />
                    </div>
                  </div>

                  {/* Default Recipients & Test */}
                  <div className="mt-5 space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="field-label">Default email recipients</label>
                        <button
                          type="button"
                          onClick={handleTestEmail}
                          disabled={isTestingEmail}
                          className="text-[11px] font-semibold text-cobalt hover:underline"
                        >
                          {isTestingEmail ? 'Sending test…' : 'Send test email →'}
                        </button>
                      </div>
                      <input
                        className="field"
                        value={emails}
                        onChange={(e) => setEmails(e.target.value)}
                        placeholder="email@company.com, team@agency.com"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between">
                        <label className="field-label">Slack incoming webhook URL</label>
                        <button
                          type="button"
                          onClick={handleTestSlack}
                          disabled={isTestingSlack}
                          className="text-[11px] font-semibold text-cobalt hover:underline"
                        >
                          {isTestingSlack ? 'Sending test…' : 'Send test Slack alert →'}
                        </button>
                      </div>
                      <input
                        className="field"
                        value={slackWebhookUrl}
                        onChange={(e) => setSlackWebhookUrl(e.target.value)}
                        placeholder="https://hooks.slack.com/services/..."
                      />
                    </div>
                  </div>
                </section>
              </div>

              {/* Right Column */}
              <div className="space-y-5">
                {/* Test Behaviour Card */}
                <section className="panel animate-rise p-5 sm:p-6">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f0ecff] text-[#7655d8]">
                      <Settings2 size={17} />
                    </span>
                    <div>
                      <h2 className="font-display text-[14px] font-bold text-ink">Test behaviour</h2>
                      <p className="text-[11.5px] text-muted">Fine-tune how Playwright validates forms.</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[12.5px] font-semibold text-ink">Capture screenshots</p>
                        <p className="text-[11px] text-muted">Attach full-page images on failure</p>
                      </div>
                      <Toggle checked={screenshots} onChange={setScreenshots} label="Capture screenshots" />
                    </div>
                    <div className="border-t border-line" />
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[12.5px] font-semibold text-ink">Retry failed tests once</p>
                        <p className="text-[11px] text-muted">Prevents false alarms on network blips</p>
                      </div>
                      <Toggle checked={retries} onChange={setRetries} label="Retry failed tests" />
                    </div>
                    <div className="border-t border-line" />
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[12.5px] font-semibold text-ink">Page load timeout</p>
                        <p className="text-[11px] text-muted">Maximum wait per form verification</p>
                      </div>
                      <span className="pill bg-[#f0f3f8] text-[#5d6c86]">
                        <Timer size={11} /> 30 seconds
                      </span>
                    </div>
                  </div>
                </section>

                {/* Workspace Status Card */}
                <section className="sidebar-grain rounded-[20px] bg-ink p-5 text-white shadow-[0_16px_40px_rgba(16,28,46,.18)]">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck size={18} className="text-[#8fa6ff]" />
                    <h2 className="font-display text-[14px] font-bold">Workspace status</h2>
                  </div>
                  <div className="mt-5 space-y-3">
                    <div className="flex items-center gap-3 rounded-xl bg-white/[.07] px-3.5 py-2.5 text-[11.5px]">
                      <Activity size={14} className="text-[#9fb0cc]" />
                      <span className="flex-1 text-[#b7c6de]">Monitoring engine</span>
                      <span className="font-semibold text-[#64dfba]">Online</span>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-white/[.07] px-3.5 py-2.5 text-[11.5px]">
                      <Database size={14} className="text-[#9fb0cc]" />
                      <span className="flex-1 text-[#b7c6de]">Database (MongoDB)</span>
                      <span className="font-semibold text-[#64dfba]">Connected</span>
                    </div>
                    <div className="flex items-center gap-3 rounded-xl bg-white/[.07] px-3.5 py-2.5 text-[11.5px]">
                      <Sparkles size={14} className="text-[#9fb0cc]" />
                      <span className="flex-1 text-[#b7c6de]">Plan</span>
                      <span className="font-semibold text-[#64dfba]">Pro · Multi-Site</span>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => notify('All engine modules & database connections are healthy.', 'success')}
                    className="mt-5 flex items-center gap-1.5 text-[11.5px] font-semibold text-[#9db4ff] hover:text-white transition"
                  >
                    Check system status <ArrowRight size={13} />
                  </button>
                </section>
              </div>
          </div>
        </div>

        {/* Toast */}
        <Toast notice={notice} onClose={() => setNotice(null)} />
      </div>
      );
}
