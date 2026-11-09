import nodemailer from 'nodemailer';
import { ISite } from '@/models/Site';
import { ISettings } from '@/models/Settings';
import { TestResult } from '@/lib/tester';

export interface NotificationResult {
  email: boolean;
  slack: boolean;
}

export async function sendSlackWebhook(
  webhookUrl: string,
  payload: any
): Promise<boolean> {
  try {
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

export function buildSlackBlocks(site: ISite | any, result: TestResult, appUrl: string = 'http://localhost:3000') {
  const isFailed = result.status === 'failed';
  const statusEmoji = isFailed ? '🚨' : '✅';
  const statusText = isFailed ? 'FORM SUBMISSION FAILED' : 'FORM SUBMISSION PASSED';
  const formattedTime = new Date().toUTCString();

  const blocks: any[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `${statusEmoji} [FormGuard Pro] ${statusText}`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Site Name:*\n${site.name}`,
        },
        {
          type: 'mrkdwn',
          text: `*Plugin Type:*\n${site.formPluginType || 'Elementor Pro'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Target URL:*\n<${site.url}|${site.url}>`,
        },
        {
          type: 'mrkdwn',
          text: `*Response Duration:*\n${result.durationMs}ms`,
        },
      ],
    },
  ];

  if (isFailed && result.errorMessage) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Failure Reason:*\n\`\`\`${result.errorMessage}\`\`\``,
      },
    });
  }

  if (result.consoleErrors && result.consoleErrors.length > 0) {
    const errorSnippet = result.consoleErrors.slice(0, 3).join('\n');
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Detected JS / Console Errors:*\n\`\`\`${errorSnippet}\`\`\``,
      },
    });
  }

  blocks.push(
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: `Executed at: ${formattedTime} | <${appUrl}/logs|View Log & Screenshot in Dashboard>`,
        },
      ],
    },
    {
      type: 'divider',
    }
  );

  return {
    text: `${statusEmoji} [FormGuard Pro] ${site.name}: ${statusText}`,
    blocks,
  };
}

export async function sendEmailNotification(
  smtpConfig: any,
  toEmails: string[],
  site: ISite | any,
  result: TestResult,
  appUrl: string = 'http://localhost:3000'
): Promise<boolean> {
  if (!toEmails || toEmails.length === 0) return false;

  const host = smtpConfig?.host || process.env.SMTP_HOST;
  const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 587);
  const user = smtpConfig?.user || process.env.SMTP_USER;
  const pass = smtpConfig?.pass || process.env.SMTP_PASS;
  const fromEmail = smtpConfig?.fromEmail || process.env.SMTP_FROM || 'alerts@formguardpro.com';

  if (!host || !user || !pass) {
    console.warn('SMTP credentials not configured. Skipping email dispatch.');
    return false;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  const isFailed = result.status === 'failed';
  const subject = `${isFailed ? '🚨 [FAILED]' : '✅ [PASSED]'} Form Monitoring Alert: ${site.name}`;

  const attachments: any[] = [];
  let screenshotHtml = '';

  if (result.screenshotBase64) {
    attachments.push({
      filename: `failure-${site.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}.png`,
      content: Buffer.from(result.screenshotBase64, 'base64'),
      cid: 'failure-screenshot',
    });

    screenshotHtml = `
      <div style="margin-top: 24px; padding: 16px; background-color: #0F172A; border: 1px solid #1E293B; border-radius: 8px;">
        <h3 style="color: #F8FAFC; margin-top: 0; font-size: 15px;">Captured Failure Viewport:</h3>
        <img src="cid:failure-screenshot" alt="Failure Screenshot" style="max-width: 100%; height: auto; border-radius: 6px; border: 1px solid #334155;" />
      </div>
    `;
  }

  const consoleErrorsHtml =
    result.consoleErrors && result.consoleErrors.length > 0
      ? `
        <div style="margin-top: 16px; padding: 12px; background-color: #0F172A; border-radius: 6px; border: 1px solid #1E293B;">
          <h4 style="color: #F87171; margin: 0 0 8px 0; font-size: 14px;">Browser JS Console Errors:</h4>
          <pre style="color: #CBD5E1; font-size: 12px; white-space: pre-wrap; margin: 0;">${result.consoleErrors
            .slice(0, 5)
            .join('\n')}</pre>
        </div>
      `
      : '';

  const html = `
    <!DOCTYPE html>
    <html>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #090D16; color: #F8FAFC; padding: 24px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #12263A; border: 1px solid #1E3A5F; border-radius: 12px; overflow: hidden;">
          <div style="padding: 20px 24px; background-color: ${isFailed ? '#7F1D1D' : '#0B6E77'}; color: #FFFFFF;">
            <h2 style="margin: 0; font-size: 20px; font-weight: 700;">
              ${isFailed ? '🚨 Form Health Check Alert: FAILED' : '✅ Form Health Check Alert: PASSED'}
            </h2>
            <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px;">FormGuard Pro Automated Monitor</p>
          </div>

          <div style="padding: 24px;">
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #94A3B8; width: 140px;"><strong>Site:</strong></td>
                <td style="padding: 8px 0; color: #F8FAFC;">${site.name}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #94A3B8;"><strong>URL:</strong></td>
                <td style="padding: 8px 0;"><a href="${site.url}" style="color: #0EA5E9; text-decoration: underline;">${site.url}</a></td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #94A3B8;"><strong>Form Plugin:</strong></td>
                <td style="padding: 8px 0; color: #F8FAFC;">${site.formPluginType || 'Elementor Pro'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #94A3B8;"><strong>Execution Time:</strong></td>
                <td style="padding: 8px 0; color: #F8FAFC;">${result.durationMs}ms</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #94A3B8;"><strong>Checked At:</strong></td>
                <td style="padding: 8px 0; color: #F8FAFC;">${new Date().toUTCString()}</td>
              </tr>
            </table>

            ${
              isFailed
                ? `
              <div style="margin-top: 20px; padding: 14px; background-color: #450A0A; border: 1px solid #991B1B; border-radius: 6px;">
                <h4 style="color: #FCA5A5; margin: 0 0 6px 0; font-size: 14px;">Error Details:</h4>
                <p style="color: #FEE2E2; margin: 0; font-family: monospace; font-size: 13px;">${result.errorMessage || 'Unknown error'}</p>
              </div>
            `
                : ''
            }

            ${consoleErrorsHtml}
            ${screenshotHtml}

            <div style="margin-top: 28px; text-align: center;">
              <a href="${appUrl}/logs" style="background-color: #0EA5E9; color: #0F172A; font-weight: 600; padding: 12px 24px; border-radius: 6px; text-decoration: none; display: inline-block;">
                View Dashboard Logs
              </a>
            </div>
          </div>
        </div>
      </body>
    </html>
  `;

  try {
    await transporter.sendMail({
      from: `"FormGuard Pro" <${fromEmail}>`,
      to: toEmails.join(', '),
      subject,
      html,
      attachments,
    });
    return true;
  } catch (emailErr) {
    console.error('Error sending email notification:', emailErr);
    return false;
  }
}

export async function dispatchAlerts(
  site: ISite | any,
  testResult: TestResult,
  globalSettings?: ISettings | any
): Promise<NotificationResult> {
  const isFailed = testResult.status === 'failed';
  const prefs = site.notificationPreferences || {};
  const notifyOnSuccess = Boolean(prefs.notifyOnSuccess);

  // 1. Should we fire notifications?
  // Always fire on 'failed'. Fire on 'passed' only if notifyOnSuccess is true.
  if (!isFailed && !notifyOnSuccess) {
    return { email: false, slack: false };
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  let emailSent = false;
  let slackSent = false;

  // 2. Email alert dispatch
  const enableEmail = prefs.enableEmail !== false;
  if (enableEmail) {
    let targetEmails: string[] = [];
    if (!prefs.useGlobalDefaults && prefs.customEmails && prefs.customEmails.length > 0) {
      targetEmails = prefs.customEmails.map((e: string) => e.trim()).filter(Boolean);
    } else if (globalSettings?.defaultNotificationEmails && globalSettings.defaultNotificationEmails.length > 0) {
      targetEmails = globalSettings.defaultNotificationEmails;
    } else if (process.env.NOTIFICATION_EMAIL) {
      targetEmails = [process.env.NOTIFICATION_EMAIL];
    }

    if (targetEmails.length > 0) {
      emailSent = await sendEmailNotification(
        globalSettings?.smtpConfig,
        targetEmails,
        site,
        testResult,
        appUrl
      );
    }
  }

  // 3. Slack alert dispatch
  const enableSlack = prefs.enableSlack !== false;
  if (enableSlack) {
    let webhookUrl: string | undefined = undefined;
    if (!prefs.useGlobalDefaults && prefs.customSlackWebhookUrl) {
      webhookUrl = prefs.customSlackWebhookUrl.trim();
    } else if (globalSettings?.defaultSlackWebhookUrl) {
      webhookUrl = globalSettings.defaultSlackWebhookUrl.trim();
    } else if (process.env.SLACK_WEBHOOK_URL) {
      webhookUrl = process.env.SLACK_WEBHOOK_URL.trim();
    }

    if (webhookUrl) {
      const payload = buildSlackBlocks(site, testResult, appUrl);
      slackSent = await sendSlackWebhook(webhookUrl, payload);
    }
  }

  return { email: emailSent, slack: slackSent };
}

