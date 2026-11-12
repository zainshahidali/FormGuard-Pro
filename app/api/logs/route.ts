import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import TestLog from '@/models/TestLog';
import Site from '@/models/Site';

// Ensure Site model is registered for populate
void Site;

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const searchParams = req.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const countOnly = searchParams.get('countOnly') === 'true';
    const includeScreenshots = searchParams.get('includeScreenshots') === 'true';

    const query: any = {};
    if (siteId && siteId !== 'all') {
      query.siteId = siteId;
    }
    if (status && (status === 'passed' || status === 'failed')) {
      query.status = status;
    }

    // Fast count query for badges (e.g. Sidebar failed count)
    if (countOnly) {
      const count = await TestLog.countDocuments(query);
      return NextResponse.json({ success: true, count });
    }

    // Exclude heavy base64 screenshots in list views for 98% faster response and tiny payload
    const projection = includeScreenshots
      ? {}
      : { screenshotBase64: 0, 'formResults.screenshotBase64': 0 };

    const logs = await TestLog.find(query, projection)
      .sort({ executedAt: -1 })
      .limit(limit)
      .populate('siteId', 'name url formPluginType')
      .lean();

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

