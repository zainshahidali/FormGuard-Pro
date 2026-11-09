import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Site from '@/models/Site';
import Settings from '@/models/Settings';
import TestLog from '@/models/TestLog';
import { runFormTest } from '@/lib/tester';
import { dispatchAlerts } from '@/lib/notifier';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const body = await req.json();
    const { siteId } = body;

    if (!siteId) {
      return NextResponse.json(
        { success: false, error: 'siteId is required' },
        { status: 400 }
      );
    }

    const site = await Site.findById(siteId);
    if (!site) {
      return NextResponse.json(
        { success: false, error: 'Site not found' },
        { status: 404 }
      );
    }

    const settings = await Settings.findOne();

    // Run Playwright form test
    const testResult = await runFormTest(site);

    // Save test log
    const testLog = await TestLog.create({
      siteId: site._id,
      status: testResult.status,
      durationMs: testResult.durationMs,
      errorMessage: testResult.errorMessage || '',
      consoleErrors: testResult.consoleErrors || [],
      screenshotBase64: testResult.screenshotBase64 || '',
      notificationsSent: { email: false, slack: false },
      executedAt: new Date(),
    });

    // Update site status
    site.lastStatus = testResult.status === 'passed' ? 'healthy' : 'failing';
    site.lastCheckedAt = new Date();
    await site.save();

    // Dispatch Slack / Email alerts according to notificationPreferences
    const alertResult = await dispatchAlerts(site, testResult, settings);

    // Update log with sent status
    testLog.notificationsSent = alertResult;
    await testLog.save();

    return NextResponse.json({
      success: true,
      result: testResult,
      logId: testLog._id,
      notificationsSent: alertResult,
      site: {
        _id: site._id,
        name: site.name,
        lastStatus: site.lastStatus,
        lastCheckedAt: site.lastCheckedAt,
      },
    });
  } catch (error: any) {
    console.error('Error in run-single test:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Form test execution failed' },
      { status: 500 }
    );
  }
}

