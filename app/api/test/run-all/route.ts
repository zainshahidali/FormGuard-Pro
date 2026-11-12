import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Site from '@/models/Site';
import Settings from '@/models/Settings';
import TestLog from '@/models/TestLog';
import { runSiteTest } from '@/lib/tester';
import { dispatchAlerts } from '@/lib/notifier';
import { tryAcquireSiteRun, releaseSiteRun } from '@/lib/run-lock';
import { AUTH_COOKIE_NAME, verifySessionToken } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow sufficient runtime for automated multi-site batch testing

export async function POST(req: NextRequest) {
  try {
    // 1. Verify authorization: allow logged-in admin session OR valid CRON_SECRET
    const cronSecret = process.env.CRON_SECRET;
    const authHeader = req.headers.get('authorization');
    const customSecretHeader = req.headers.get('x-cron-secret');
    const urlSecret = req.nextUrl.searchParams.get('secret');

    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
    const providedSecret = bearerToken || customSecretHeader || urlSecret;

    const hasValidCronSecret = Boolean(cronSecret && providedSecret === cronSecret);

    const sessionCookie = req.cookies.get(AUTH_COOKIE_NAME)?.value;
    const validSession = await verifySessionToken(sessionCookie);

    if (!hasValidCronSecret && !validSession) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized: Admin login or valid CRON_SECRET required.' },
        { status: 401 }
      );
    }

    await connectToDatabase();
    const settings = await Settings.findOne();

    // Check if daily automated testing is globally paused in settings (unless triggered manually from UI)
    const body = await req.json().catch(() => ({}));
    const isManual =
      body?.manual === true ||
      req.headers.get('x-manual-trigger') === 'true' ||
      Boolean(validSession);

    if (settings && settings.isDailyTestingEnabled === false && !isManual) {
      console.log('[FormGuard Cron] Daily automated testing is currently turned OFF in settings. Skipping run.');
      return NextResponse.json({
        success: true,
        message: 'Daily automated testing is currently turned OFF in settings. Scheduled run skipped.',
        skipped: true,
        total: 0,
        passed: 0,
        failed: 0,
        results: [],
      });
    }

    // 2. Fetch all active sites
    const activeSites = await Site.find({ isActive: true });

    if (activeSites.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No active sites configured for testing.',
        total: 0,
        passed: 0,
        failed: 0,
        results: [],
      });
    }

    const testResults: any[] = [];
    let passedCount = 0;
    let failedCount = 0;

    // 3. Run sequentially to ensure stable headless Chromium resource usage
    for (const site of activeSites) {
      try {
        console.log(`[FormGuard Cron] Testing site: ${site.name} (${site.url})`);
        // Skip a site that is already being tested elsewhere (e.g. a manual "Test Now" is in progress).
        const lockId = String(site._id);
        if (!tryAcquireSiteRun(lockId)) {
          console.log(`[FormGuard Cron] Skipping ${site.name}: a test is already running for it.`);
          testResults.push({
            siteId: site._id,
            siteName: site.name,
            status: 'skipped',
            durationMs: 0,
            errorMessage: 'Skipped: this site is already being tested.',
          });
          continue;
        }
        let result;
        try {
          result = await runSiteTest(site, { testEmail: settings?.testBotEmail });
        } finally {
          releaseSiteRun(lockId);
        }

        if (result.status === 'passed') {
          passedCount++;
        } else {
          failedCount++;
        }

        // Save test log
        const log = await TestLog.create({
          siteId: site._id,
          status: result.status,
          durationMs: result.durationMs,
          errorMessage: result.errorMessage || '',
          consoleErrors: result.consoleErrors || [],
          screenshotBase64: result.screenshotBase64 || '',
          formResults: result.formResults || [],
          notificationsSent: { email: false, slack: false },
          executedAt: new Date(),
        });

        // Update individual sub-forms statuses if site has forms array
        if (site.forms && site.forms.length > 0 && result.formResults) {
          for (const formItem of site.forms) {
            const matchingResult = result.formResults.find(
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

        // Update site status
        site.lastStatus = result.status === 'passed' ? 'healthy' : 'failing';
        site.lastCheckedAt = new Date();
        await site.save();

        // Dispatch alert if needed
        const notificationRes = await dispatchAlerts(site, result, settings);
        log.notificationsSent = notificationRes;
        await log.save();

        testResults.push({
          siteId: site._id,
          siteName: site.name,
          status: result.status,
          durationMs: result.durationMs,
          errorMessage: result.errorMessage,
          notificationsSent: notificationRes,
        });
      } catch (siteErr: any) {
        console.error(`[FormGuard Cron] Error testing ${site.name}:`, siteErr);
        failedCount++;
        testResults.push({
          siteId: site._id,
          siteName: site.name,
          status: 'failed',
          errorMessage: siteErr.message || 'Fatal execution error',
        });
      }
    }

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      total: activeSites.length,
      passed: passedCount,
      failed: failedCount,
      results: testResults,
    });
  } catch (error: any) {
    console.error('Error running all form tests:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Batch test execution failed' },
      { status: 500 }
    );
  }
}

