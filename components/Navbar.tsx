'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Play, Plus, Clock, ExternalLink, ShieldAlert } from 'lucide-react';
import RunAllModal from '@/components/RunAllModal';

export default function Navbar() {
  const [isRunModalOpen, setIsRunModalOpen] = useState(false);

  return (
    <>
      <header className="h-16 bg-navy-800 border-b border-surface-border px-8 flex items-center justify-between shrink-0 sticky top-0 z-40">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium text-slate-300 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
            FormGuard Pro Active Monitor
          </span>
          <span className="text-xs text-slate-500 hidden sm:inline">|</span>
          <span className="text-xs text-slate-400 hidden sm:inline flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            Daily Automated Schedule: 04:00 UTC (9:00 AM PKT)
          </span>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRunModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-surface hover:bg-surface-hover border border-surface-border transition-all shadow-sm"
          >
            <Play className="w-3.5 h-3.5 text-sky-accent fill-current" />
            Run All Tests
          </button>

          <Link
            href="/sites/new"
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold text-navy-900 bg-gradient-to-r from-sky-accent to-teal-light hover:brightness-110 transition-all shadow-md shadow-sky-accent/20"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            Add Website
          </Link>
        </div>
      </header>

      <RunAllModal
        isOpen={isRunModalOpen}
        onClose={() => setIsRunModalOpen(false)}
        onComplete={() => {
          // Trigger a window custom event so pages can re-fetch
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new Event('formguard:refetch'));
          }
        }}
      />
    </>
  );
}

