import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/mongodb';
import Site from '@/models/Site';
import TestLog from '@/models/TestLog';

export const dynamic = 'force-dynamic';

interface Params {
  params: {
    id: string;
  };
}

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const site = await Site.findById(params.id);
    if (!site) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
    }
    return NextResponse.json({ success: true, site });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch site' },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const body = await req.json();

    const updatedSite = await Site.findByIdAndUpdate(
      params.id,
      {
        $set: {
          name: body.name,
          url: body.url,
          formPluginType: body.formPluginType,
          fields: body.fields,
          submitButtonSelector: body.submitButtonSelector,
          verificationMethod: body.verificationMethod,
          expectedSuccessValue: body.expectedSuccessValue,
          notificationPreferences: body.notificationPreferences,
          isActive: body.isActive,
        },
      },
      { new: true, runValidators: true }
    );

    if (!updatedSite) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, site: updatedSite });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update site' },
      { status: 500 }
    );
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    await connectToDatabase();
    const site = await Site.findByIdAndDelete(params.id);
    if (!site) {
      return NextResponse.json({ success: false, error: 'Site not found' }, { status: 404 });
    }

    // Optionally clean up associated test logs
    await TestLog.deleteMany({ siteId: params.id });

    return NextResponse.json({ success: true, message: 'Site deleted successfully' });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete site' },
      { status: 500 }
    );
  }
}

