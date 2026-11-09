import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Site from '@/models/Site';
import Settings from '@/models/Settings';
import TestLog from '@/models/TestLog';
import { runFormTest } from '@/lib/tester';
import { dispatchAlerts } from '@/lib/notifier';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // Allow sufficient runtime for automated multi-site batch testing

export async function POST(req: NextRequest) {
  try {
    // 1. Verify authorization secret if CRON_SECRET is configured in environment
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = req.headers.get('authorization');
      const customSecretHeader = req.headers.get('x-cron-secret');
      const urlSecret = req.nextUrl.searchParams.get('secret');

      const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;
      const providedSecret = bearerToken || customSecretHeader || urlSecret;

      if (providedSecret !== cronSecret) {
        return NextResponse.json(
          { success: false, error: 'Unauthorized: Invalid CRON_SECRET' },
          { status: 401 }
        );
      }
    }

    await connectToDatabase();
    const settings = await Settings.findOne();

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
        const result = await runFormTest(site);

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
          notificationsSent: { email: false, slack: false },
          executedAt: new Date(),
        });

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

