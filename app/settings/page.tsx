'use client';

import React, { useState, useEffect } from 'react';
import {
  Settings as SettingsIcon,
  Save,
  Mail,
  MessageSquare,
  Bot,
  Send,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Server,
  HelpCircle,
} from 'lucide-react';

export default function SettingsPage() {
  const [emails, setEmails] = useState('');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState('');
  const [slackChannelName, setSlackChannelName] = useState('');
  const [testBotEmail, setTestBotEmail] = useState('');

  // SMTP Settings
  const [smtpHost, setSmtpHost] = useState('');
  const [smtpPort, setSmtpPort] = useState('587');
  const [smtpUser, setSmtpUser] = useState('');
  const [smtpPass, setSmtpPass] = useState('');
  const [smtpFromEmail, setSmtpFromEmail] = useState('');

  // State management
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingSlack, setIsTestingSlack] = useState(false);
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [slackTestResult, setSlackTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [emailTestResult, setEmailTestResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (data.success && data.settings) {
          const s = data.settings;
          setEmails(s.defaultNotificationEmails?.join(', ') || 'zanshahidali@gmail.com');
          setSlackWebhookUrl(s.defaultSlackWebhookUrl || '');
          setSlackChannelName(s.defaultSlackChannelName || '');
          setTestBotEmail(s.testBotEmail || 'qa-bot@formguardpro.com');

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

  // Save Settings
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);

    try {
      const payload = {
        defaultNotificationEmails: emails
          .split(',')
          .map((emailStr: string) => emailStr.trim())
          .filter(Boolean),
        defaultSlackWebhookUrl: slackWebhookUrl.trim(),
        defaultSlackChannelName: slackChannelName.trim(),
        testBotEmail: testBotEmail.trim(),
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
        throw new Error(data.error || 'Failed to update settings.');
      }

      setSaveStatus('Global settings saved successfully!');
      setTimeout(() => setSaveStatus(null), 4000);
    } catch (err: any) {
      alert(err.message || 'Error saving settings.');
    } finally {
      setIsSaving(false);
    }
  };

  // Test Slack Webhook
  const handleTestSlack = async () => {
    if (!slackWebhookUrl.trim()) {
      alert('Please enter a Slack incoming webhook URL first.');
      return;
    }

    setIsTestingSlack(true);
    setSlackTestResult(null);

    try {
      const res = await fetch('/api/settings/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'slack',
          webhookUrl: slackWebhookUrl.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        setSlackTestResult({ success: true, msg: data.message });
      } else {
        setSlackTestResult({ success: false, msg: data.error || 'Failed to trigger Slack.' });
      }
    } catch (err: any) {
      setSlackTestResult({ success: false, msg: err.message || 'Network error triggering Slack.' });
    } finally {
      setIsTestingSlack(false);
    }
  };

  // Test Email
  const handleTestEmail = async () => {
    const firstEmail = emails.split(',')[0]?.trim();
    if (!firstEmail) {
      alert('Please enter at least one recipient email address first.');
      return;
    }

    setIsTestingEmail(true);
    setEmailTestResult(null);

    try {
      const res = await fetch('/api/settings/test-notification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'email',
          toEmail: firstEmail,
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
      if (data.success) {
        setEmailTestResult({ success: true, msg: data.message });
      } else {
        setEmailTestResult({ success: false, msg: data.error || 'Failed to send test email.' });
      }
    } catch (err: any) {
      setEmailTestResult({ success: false, msg: err.message || 'Network error sending test email.' });
    } finally {
      setIsTestingEmail(false);
    }
  };

  if (isLoading) {
    return (
      <div className="py-24 text-center">
        <Loader2 className="w-8 h-8 text-sky-accent animate-spin mx-auto" />
        <p className="text-xs text-slate-400 mt-2">Loading configuration settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto pb-16">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
          <SettingsIcon className="w-6 h-6 text-sky-accent" /> Notification & Global Settings
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          Configure default alerting destinations, test bot email for conditional logic routing, and SMTP email credentials.
        </p>
      </div>

      {saveStatus && (
        <div className="bg-emerald-950/60 border border-emerald-700 p-4 rounded-xl text-emerald-200 text-sm flex items-center gap-3 animate-in fade-in duration-200">
          <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          <span>{saveStatus}</span>
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* SECTION 1: Test Bot Email & Isolation Note */}
        <div className="bg-surface border border-surface-border rounded-xl p-6 space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Bot className="w-5 h-5 text-sky-accent" /> Global Test Bot Identity
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              The standardized email address populated during daily form runs.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Default Test Bot Email</label>
            <input
              type="email"
              required
              value={testBotEmail}
              onChange={(e) => setTestBotEmail(e.target.value)}
              className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent"
            />
          </div>

          <div className="bg-navy-800 p-4 rounded-lg border border-surface-border text-xs text-slate-300 space-y-1.5">
            <div className="flex items-center gap-1.5 font-medium text-sky-accent">
              <ShieldCheck className="w-4 h-4" /> Client Inbox Protection Strategy:
            </div>
            <p className="leading-relaxed">
              In your client WordPress form builder (Elementor, CF7, WPForms, etc.), add a conditional logic routing rule:
              <br />
              <code className="text-amber-300 bg-navy-900 px-1.5 py-0.5 rounded text-[11px] mt-1 inline-block">
                If Email contains &quot;{testBotEmail || 'qa-bot@formguardpro.com'}&quot; -&gt; Route to Dev / Junk / Silent action
              </code>
              <br />
              This ensures daily automated test submissions never clutter client lead inboxes.
            </p>
          </div>
        </div>

        {/* SECTION 2: Slack Alert Configuration */}
        <div className="bg-surface border border-surface-border rounded-xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <MessageSquare className="w-5 h-5 text-amber-400" /> Default Slack Webhook Alert
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Incoming webhook that receives real-time failure alerts and Block Kit formatted status updates.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Incoming Webhook URL</label>
              <input
                type="url"
                placeholder="https://hooks.slack.com/services/T00/B00/XXXX"
                value={slackWebhookUrl}
                onChange={(e) => setSlackWebhookUrl(e.target.value)}
                className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">Channel Display Name</label>
              <input
                type="text"
                placeholder="#alerts-website-forms"
                value={slackChannelName}
                onChange={(e) => setSlackChannelName(e.target.value)}
                className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent"
              />
            </div>
          </div>

          <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleTestSlack}
              disabled={isTestingSlack || !slackWebhookUrl}
              className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-amber-300 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-all disabled:opacity-50"
            >
              {isTestingSlack ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying Slack Delivery...
                </>
              ) : (
                <>
                  <Send className="w-3.5 h-3.5" /> Test Slack Webhook
                </>
              )}
            </button>

            {slackTestResult && (
              <span
                className={`text-xs flex items-center gap-1.5 font-medium ${
                  slackTestResult.success ? 'text-emerald-400' : 'text-red-400'
                }`}
              >
                {slackTestResult.success ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 shrink-0" />
                )}
                {slackTestResult.msg}
              </span>
            )}
          </div>
        </div>

        {/* SECTION 3: Default Notification Recipients & SMTP Server Settings */}
        <div className="bg-surface border border-surface-border rounded-xl p-6 space-y-6">
          <div>
            <h2 className="text-base font-semibold text-white flex items-center gap-2">
              <Mail className="w-5 h-5 text-sky-accent" /> Default Email Alerts & SMTP Dispatcher
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Configure agency recipient emails and custom SMTP server authentication for inline screenshot delivery.
            </p>
          </div>

          {/* Default Recipients */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Default Recipient Emails (comma-separated)
            </label>
            <input
              type="text"
              required
              placeholder="zanshahidali@gmail.com, agency-leads@domain.com"
              value={emails}
              onChange={(e) => setEmails(e.target.value)}
              className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent"
            />
            <p className="text-[11px] text-slate-400">
              Sites using &quot;Global Defaults&quot; will send failure reports to these addresses.
            </p>
          </div>

          {/* SMTP Server Details */}
          <div className="pt-4 border-t border-surface-border space-y-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-300">
              <Server className="w-4 h-4 text-sky-accent" /> SMTP Server Credentials
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="sm:col-span-2 space-y-1.5">
                <label className="text-xs font-medium text-slate-300">SMTP Host</label>
                <input
                  type="text"
                  placeholder="smtp.gmail.com or smtp.mailgun.org"
                  value={smtpHost}
                  onChange={(e) => setSmtpHost(e.target.value)}
                  className="w-full bg-navy-800 border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">SMTP Port</label>
                <input
                  type="number"
                  placeholder="587"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(e.target.value)}
                  className="w-full bg-navy-800 border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">SMTP Username / Email</label>
                <input
                  type="text"
                  placeholder="username@domain.com"
                  value={smtpUser}
                  onChange={(e) => setSmtpUser(e.target.value)}
                  className="w-full bg-navy-800 border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">SMTP Password</label>
                <input
                  type="password"
                  placeholder="App password or secret"
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="w-full bg-navy-800 border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">Sender From Email</label>
                <input
                  type="email"
                  placeholder="alerts@formguardpro.com"
                  value={smtpFromEmail}
                  onChange={(e) => setSmtpFromEmail(e.target.value)}
                  className="w-full bg-navy-800 border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent"
                />
              </div>
            </div>

            {/* Test Email Button */}
            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={isTestingEmail || !emails}
                className="flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold text-sky-accent bg-sky-accent/10 hover:bg-sky-accent/20 border border-sky-accent/30 transition-all disabled:opacity-50"
              >
                {isTestingEmail ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" /> Verifying SMTP Authentication...
                  </>
                ) : (
                  <>
                    <Send className="w-3.5 h-3.5" /> Send Test Email
                  </>
                )}
              </button>

              {emailTestResult && (
                <span
                  className={`text-xs flex items-center gap-1.5 font-medium ${
                    emailTestResult.success ? 'text-emerald-400' : 'text-red-400'
                  }`}
                >
                  {emailTestResult.success ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0" />
                  )}
                  {emailTestResult.msg}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex items-center justify-end pt-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-navy-900 bg-gradient-to-r from-sky-accent to-teal-light hover:brightness-110 transition-all shadow-md shadow-sky-accent/20 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving Settings...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> Save Global Settings
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

