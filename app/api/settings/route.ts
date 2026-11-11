import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Settings from '@/models/Settings';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({
        defaultNotificationEmails: ['zanshahidali@gmail.com'],
        defaultSlackWebhookUrl: '',
        defaultSlackChannelName: '',
        smtpConfig: {
          host: '',
          port: 587,
          user: '',
          pass: '',
          fromEmail: 'alerts@formguardpro.com',
        },
        testBotEmail: 'test@gmail.com',
        isDailyTestingEnabled: true,
      });
    }
    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error('Error fetching settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch settings' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }

    if (body.defaultNotificationEmails) {
      settings.defaultNotificationEmails = Array.isArray(body.defaultNotificationEmails)
        ? body.defaultNotificationEmails
        : body.defaultNotificationEmails
            .split(',')
            .map((e: string) => e.trim())
            .filter(Boolean);
    }

    if (body.defaultSlackWebhookUrl !== undefined) {
      settings.defaultSlackWebhookUrl = body.defaultSlackWebhookUrl;
    }

    if (body.defaultSlackChannelName !== undefined) {
      settings.defaultSlackChannelName = body.defaultSlackChannelName;
    }

    if (body.testBotEmail !== undefined) {
      const testEmail = String(body.testBotEmail).trim();
      if (testEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testEmail)) {
        return NextResponse.json(
          { success: false, error: 'Test submission email is not a valid email address.' },
          { status: 400 }
        );
      }
      settings.testBotEmail = testEmail || 'test@gmail.com';
    }

    if (body.smtpConfig) {
      settings.smtpConfig = {
        host: body.smtpConfig.host || '',
        port: Number(body.smtpConfig.port) || 587,
        user: body.smtpConfig.user || '',
        pass: body.smtpConfig.pass || '',
        fromEmail: body.smtpConfig.fromEmail || 'alerts@formguardpro.com',
      };
    }

    if (body.isDailyTestingEnabled !== undefined) {
      settings.isDailyTestingEnabled = Boolean(body.isDailyTestingEnabled);
    }

    await settings.save();

    return NextResponse.json({ success: true, settings });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}

