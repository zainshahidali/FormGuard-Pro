import React from 'react';
import SiteForm from '@/components/SiteForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { connectToDatabase } from '@/lib/mongodb';
import Site from '@/models/Site';
import { notFound } from 'next/navigation';

export const dynamic = 'force-dynamic';

interface EditSitePageProps {
  params: {
    id: string;
  };
}

export default async function EditSitePage({ params }: EditSitePageProps) {
  await connectToDatabase();
  let site: any = null;

  try {
    const rawSite = await Site.findById(params.id);
    if (!rawSite) {
      notFound();
    }
    site = JSON.parse(JSON.stringify(rawSite));
  } catch {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link
          href="/"
          className="p-2 rounded-lg bg-surface hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Edit Site Configuration</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Modify form selectors, verification conditions, or notification channels for {site.name}.
          </p>
        </div>
      </div>

      <SiteForm initialData={site} isEditing={true} />
    </div>
  );
}

