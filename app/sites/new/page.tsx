import React from 'react';
import SiteForm from '@/components/SiteForm';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewSitePage() {
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
          <h1 className="text-2xl font-bold text-white tracking-tight">Add WordPress Site to Monitor</h1>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure contact form selectors, submission triggers, and dedicated notification routing.
          </p>
        </div>
      </div>

      <SiteForm />
    </div>
  );
}

