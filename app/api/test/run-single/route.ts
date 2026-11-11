import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Site from '@/models/Site';
import Settings from '@/models/Settings';
import TestLog from '@/models/TestLog';
import { runSiteTest } from '@/lib/tester';
import { dispatchAlerts } from '@/lib/notifier';
import { tryAcquireSiteRun, releaseSiteRun } from '@/lib/run-lock';

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

    // Never run the same site twice at once: every run submits real forms and sends real emails.
    const lockId = String(site._id);
    if (!tryAcquireSiteRun(lockId)) {
      return NextResponse.json(
        { success: false, error: `"${site.name}" is already being tested. Please wait for the current test to finish.` },
        { status: 409 }
      );
    }

    // Run Playwright site test across all active forms
    let testResult;
    try {
      testResult = await runSiteTest(site, { testEmail: settings?.testBotEmail });
    } finally {
      releaseSiteRun(lockId);
    }

    // Save test log with formResults breakdown
    const testLog = await TestLog.create({
      siteId: site._id,
      status: testResult.status,
      durationMs: testResult.durationMs,
      errorMessage: testResult.errorMessage || '',
      consoleErrors: testResult.consoleErrors || [],
      screenshotBase64: testResult.screenshotBase64 || '',
      formResults: testResult.formResults || [],
      notificationsSent: { email: false, slack: false },
      executedAt: new Date(),
    });

    // Update individual sub-forms statuses if site has forms array
    if (site.forms && site.forms.length > 0 && testResult.formResults) {
      for (const formItem of site.forms) {
        const matchingResult = testResult.formResults.find(
          (fr) => (fr.formId && fr.formId === formItem.id) || fr.formName === formItem.name
        );
        if (matchingResult) {
          formItem.lastStatus = matchingResult.status === 'passed' ? 'healthy' : 'failing';
          formItem.lastCheckedAt = new Date();
          formItem.lastErrorMessage = matchingResult.errorMessage || '';
          formItem.lastScreenshotBase64 = matchingResult.screenshotBase64 || '';
        }
      }
    }

    // Update overall site status
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
        forms: site.forms,
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

