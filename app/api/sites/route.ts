import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Site from '@/models/Site';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    await connectToDatabase();
    const sites = await Site.find().sort({ createdAt: -1 });
    return NextResponse.json({ success: true, sites });
  } catch (error: any) {
    console.error('Error fetching sites:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch sites' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();

    if (!body.name || !body.url) {
      return NextResponse.json(
        { success: false, error: 'Site name and URL are required' },
        { status: 400 }
      );
    }

    const newSite = await Site.create({
      name: body.name,
      url: body.url,
      formPluginType: body.formPluginType || 'Elementor Pro',
      fields: body.fields || [],
      submitButtonSelector: body.submitButtonSelector || 'button[type="submit"]',
      verificationMethod: body.verificationMethod || 'text_visible',
      expectedSuccessValue: body.expectedSuccessValue || 'Thank you',
      notificationPreferences: {
        useGlobalDefaults: body.notificationPreferences?.useGlobalDefaults ?? true,
        enableEmail: body.notificationPreferences?.enableEmail ?? true,
        customEmails: body.notificationPreferences?.customEmails || [],
        enableSlack: body.notificationPreferences?.enableSlack ?? true,
        customSlackWebhookUrl: body.notificationPreferences?.customSlackWebhookUrl || '',
        notifyOnSuccess: body.notificationPreferences?.notifyOnSuccess ?? false,
      },
      isActive: body.isActive ?? true,
      lastStatus: 'pending',
    });

    return NextResponse.json({ success: true, site: newSite }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating site:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create site' },
      { status: 500 }
    );
  }
}

