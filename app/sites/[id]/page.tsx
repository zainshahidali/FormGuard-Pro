import React from 'react';
import SiteForm from '@/components/SiteForm';
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

  return <SiteForm initialData={site} isEditing={true} />;
}
