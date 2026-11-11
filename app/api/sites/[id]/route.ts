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

    const forms = Array.isArray(body.forms) ? body.forms : undefined;
    const firstForm = forms && forms.length > 0 ? forms[0] : undefined;

    const updateData: any = {
      name: body.name,
      url: body.url,
      notificationPreferences: body.notificationPreferences,
      isActive: body.isActive,
    };

    if (typeof body.captchaBypassKey === 'string') {
      updateData.captchaBypassKey = body.captchaBypassKey.trim();
    }

    if (forms !== undefined) {
      updateData.forms = forms;
      if (firstForm) {
        updateData.formPluginType = firstForm.formPluginType;
        updateData.fields = firstForm.fields;
        updateData.submitButtonSelector = firstForm.submitButtonSelector;
        updateData.verificationMethod = firstForm.verificationMethod;
        updateData.expectedSuccessValue = firstForm.expectedSuccessValue;
      }
    } else {
      if (body.formPluginType !== undefined) updateData.formPluginType = body.formPluginType;
      if (body.fields !== undefined) updateData.fields = body.fields;
      if (body.submitButtonSelector !== undefined) updateData.submitButtonSelector = body.submitButtonSelector;
      if (body.verificationMethod !== undefined) updateData.verificationMethod = body.verificationMethod;
      if (body.expectedSuccessValue !== undefined) updateData.expectedSuccessValue = body.expectedSuccessValue;
    }

    const updatedSite = await Site.findByIdAndUpdate(
      params.id,
      { $set: updateData },
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

