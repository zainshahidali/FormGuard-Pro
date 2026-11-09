import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import TestLog from '@/models/TestLog';
import Site from '@/models/Site';

void Site;
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    await connectToDatabase();
    const searchParams = req.nextUrl.searchParams;
    const siteId = searchParams.get('siteId');
    const status = searchParams.get('status');

    const query: any = {};
    if (siteId && siteId !== 'all') {
      query.siteId = siteId;
    }
    if (status && (status === 'passed' || status === 'failed')) {
      query.status = status;
    }

    const logs = await TestLog.find(query)
      .sort({ executedAt: -1 })
      .limit(500)
      .populate('siteId', 'name url formPluginType');

    // Generate CSV Header
    const headers = [
      'Execution Date (UTC)',
      'Execution Time (UTC)',
      'Site Name',
      'Plugin Type',
      'Form URL',
      'Status',
      'Duration (ms)',
      'Error Message',
      'Email Alert Sent',
      'Slack Alert Sent',
    ];

    const escapeCsv = (str: any) => {
      if (str === null || str === undefined) return '""';
      const s = String(str).replace(/"/g, '""');
      return `"${s}"`;
    };

    const rows = logs.map((log) => {
      const site: any = log.siteId || {};
      const dateObj = new Date(log.executedAt);
      return [
        escapeCsv(dateObj.toISOString().split('T')[0]),
        escapeCsv(dateObj.toISOString().split('T')[1].replace('Z', '')),
        escapeCsv(site.name || 'Unknown Site'),
        escapeCsv(site.formPluginType || 'N/A'),
        escapeCsv(site.url || ''),
        escapeCsv(log.status.toUpperCase()),
        escapeCsv(log.durationMs || 0),
        escapeCsv(log.errorMessage || ''),
        escapeCsv(log.notificationsSent?.email ? 'YES' : 'NO'),
        escapeCsv(log.notificationsSent?.slack ? 'YES' : 'NO'),
      ].join(',');
    });

    const csvContent = [headers.join(','), ...rows].join('\r\n');

    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="formguard-report-${new Date().toISOString().split('T')[0]}.csv"`,
      },
    });
  } catch (error: any) {
    console.error('Error generating CSV export:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to export logs' },
      { status: 500 }
    );
  }
}

