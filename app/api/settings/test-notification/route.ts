import { NextRequest, NextResponse } from 'next/server';
import nodemailer from 'nodemailer';
import { sendSlackWebhook } from '@/lib/notifier';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { type, webhookUrl, smtpConfig, toEmail } = body;

    if (type === 'slack') {
      if (!webhookUrl) {
        return NextResponse.json(
          { success: false, error: 'Slack webhook URL is required' },
          { status: 400 }
        );
      }

      const payload = {
        text: '🔔 [FormGuard Pro] Test Alert: Slack Webhook is working correctly!',
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: '🔔 FormGuard Pro — Slack Webhook Test',
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: `*Status:* Connected successfully!\n*Timestamp:* ${new Date().toUTCString()}\n*Environment:* FormGuard Pro Monitoring Dashboard`,
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: 'Your Slack notifications for WordPress contact forms are configured and ready to receive real-time failure alerts.',
              },
            ],
          },
        ],
      };

      const ok = await sendSlackWebhook(webhookUrl, payload);
      if (!ok) {
        return NextResponse.json(
          { success: false, error: 'Failed to send message to Slack webhook. Verify the URL is valid.' },
          { status: 400 }
        );
      }

      return NextResponse.json({ success: true, message: 'Test message delivered to Slack successfully!' });
    }

    if (type === 'email') {
      if (!toEmail) {
        return NextResponse.json(
          { success: false, error: 'Recipient email address is required' },
          { status: 400 }
        );
      }

      const host = smtpConfig?.host || process.env.SMTP_HOST;
      const port = Number(smtpConfig?.port || process.env.SMTP_PORT || 587);
      const user = smtpConfig?.user || process.env.SMTP_USER;
      const pass = smtpConfig?.pass || process.env.SMTP_PASS;
      const fromEmail = smtpConfig?.fromEmail || process.env.SMTP_FROM || 'alerts@formguardpro.com';

      if (!host || !user || !pass) {
        return NextResponse.json(
          { success: false, error: 'Incomplete SMTP configuration (Host, Username, or Password missing).' },
          { status: 400 }
        );
      }

      const transporter = nodemailer.createTransport({
        host,
        port,
        secure: port === 465,
        auth: { user, pass },
      });

      // Verify connection configuration
      await transporter.verify();

      // Send test email
      await transporter.sendMail({
        from: `"FormGuard Pro" <${fromEmail}>`,
        to: toEmail,
        subject: '🔔 [FormGuard Pro] Test Alert: SMTP Email Configured Successfully',
        html: `
          <div style="font-family: sans-serif; background: #0F172A; color: #F8FAFC; padding: 24px; border-radius: 8px;">
            <h2 style="color: #0EA5E9; margin-top: 0;">FormGuard Pro Notification Test</h2>
            <p>Your SMTP email configuration is active and successfully authenticated.</p>
            <p style="color: #94A3B8;">Sent at: ${new Date().toUTCString()}</p>
          </div>
        `,
      });

      return NextResponse.json({
        success: true,
        message: `Test email successfully dispatched to ${toEmail}!`,
      });
    }

    return NextResponse.json({ success: false, error: 'Invalid notification type' }, { status: 400 });
  } catch (error: any) {
    console.error('Error sending test notification:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Notification test failed' },
      { status: 500 }
    );
  }
}

