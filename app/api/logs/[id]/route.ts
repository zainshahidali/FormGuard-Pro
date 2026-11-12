import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import TestLog from '@/models/TestLog';
import Site from '@/models/Site';

void Site;

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    await connectToDatabase();
    const log = await TestLog.findById(params.id)
      .populate('siteId', 'name url formPluginType')
      .lean();

    if (!log) {
      return NextResponse.json(
        { success: false, error: 'Test log not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, log });
  } catch (error: any) {
    console.error('Error fetching log details:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch log details' },
      { status: 500 }
    );
  }
}

