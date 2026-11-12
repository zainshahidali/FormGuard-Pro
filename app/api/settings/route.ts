import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Settings from '@/models/Settings';
import {
  verifyPassword,
  hashPassword,
  generateSalt,
  DEFAULT_ADMIN_PASSWORD,
  DEFAULT_ADMIN_USERNAME,
} from '@/lib/auth';

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
        adminAuth: {
          username: DEFAULT_ADMIN_USERNAME,
          passwordHash: '',
          salt: '',
          updatedAt: new Date(),
        },
        testBotEmail: 'test@gmail.com',
        isDailyTestingEnabled: true,
      });
    }

    const safeSettings = settings.toObject ? settings.toObject() : { ...settings };
    // Redact password hash & salt before returning to client
    if (safeSettings.adminAuth) {
      safeSettings.adminAuth = {
        username: safeSettings.adminAuth.username || DEFAULT_ADMIN_USERNAME,
        updatedAt: safeSettings.adminAuth.updatedAt,
      };
    } else {
      safeSettings.adminAuth = {
        username: DEFAULT_ADMIN_USERNAME,
      };
    }

    return NextResponse.json({ success: true, settings: safeSettings });
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

    if (body.adminAuth) {
      const { currentPassword, newUsername, newPassword } = body.adminAuth;

      if (!currentPassword) {
        return NextResponse.json(
          { success: false, error: 'Current password is required to update admin credentials.' },
          { status: 400 }
        );
      }

      const storedAuth = settings.adminAuth;
      let isCurrentValid = false;

      if (storedAuth?.passwordHash && storedAuth?.salt) {
        isCurrentValid = await verifyPassword(
          currentPassword,
          storedAuth.passwordHash,
          storedAuth.salt
        );
      } else {
        isCurrentValid = currentPassword === DEFAULT_ADMIN_PASSWORD;
      }

      if (!isCurrentValid) {
        return NextResponse.json(
          { success: false, error: 'Current password does not match.' },
          { status: 400 }
        );
      }

      const updatedUser = (newUsername || storedAuth?.username || DEFAULT_ADMIN_USERNAME).trim();
      if (!updatedUser) {
        return NextResponse.json(
          { success: false, error: 'Username cannot be blank.' },
          { status: 400 }
        );
      }

      let passwordHash = storedAuth?.passwordHash;
      let salt = storedAuth?.salt;

      if (newPassword && String(newPassword).trim()) {
        if (String(newPassword).length < 6) {
          return NextResponse.json(
            { success: false, error: 'New password must be at least 6 characters.' },
            { status: 400 }
          );
        }
        salt = generateSalt();
        passwordHash = await hashPassword(String(newPassword), salt);
      } else if (!passwordHash) {
        salt = generateSalt();
        passwordHash = await hashPassword(DEFAULT_ADMIN_PASSWORD, salt);
      }

      settings.adminAuth = {
        username: updatedUser,
        passwordHash: passwordHash || '',
        salt: salt || '',
        updatedAt: new Date(),
      };
    }

    await settings.save();

    const safeSettings = settings.toObject ? settings.toObject() : { ...settings };
    if (safeSettings.adminAuth) {
      safeSettings.adminAuth = {
        username: safeSettings.adminAuth.username || DEFAULT_ADMIN_USERNAME,
        updatedAt: safeSettings.adminAuth.updatedAt,
      };
    }

    return NextResponse.json({ success: true, settings: safeSettings });
  } catch (error: any) {
    console.error('Error updating settings:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update settings' },
      { status: 500 }
    );
  }
}

