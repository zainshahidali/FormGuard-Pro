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

    const query: any = {};
    if (siteId && siteId !== 'all') {
      query.siteId = siteId;
    }
    if (status && (status === 'passed' || status === 'failed')) {
      query.status = status;
    }

    const logs = await TestLog.find(query)
      .sort({ executedAt: -1 })
      .limit(limit)
      .populate('siteId', 'name url formPluginType');

    return NextResponse.json({ success: true, logs });
  } catch (error: any) {
    console.error('Error fetching logs:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch logs' },
      { status: 500 }
    );
  }
}

