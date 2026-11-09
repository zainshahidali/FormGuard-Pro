'use client';

import React from 'react';
import Link from 'next/link';
import { Menu, Clock, Play, Plus } from 'lucide-react';

interface NavbarProps {
  onOpenMenu?: () => void;
  onRunAll?: () => void;
}

export default function Navbar({ onOpenMenu, onRunAll }: NavbarProps) {
  const handleRunAll = () => {
    if (onRunAll) {
      onRunAll();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('formguard:open-run-all'));
    }
  };

  return (
    <header className="sticky top-0 z-40 flex h-[72px] shrink-0 items-center justify-between gap-3 border-b border-line bg-white/90 px-4 backdrop-blur-xl sm:px-6 lg:px-8">
      {/* Left: Mobile Toggle & System Health status */}
      <div className="flex min-w-0 items-center gap-3">
        {onOpenMenu && (
          <button
            onClick={onOpenMenu}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line text-[#5d6c86] hover:text-ink lg:hidden transition-colors"
            aria-label="Open navigation menu"
          >
            <Menu size={18} />
          </button>
        )}
        <span className="dot-live hidden sm:block" />
        <div className="min-w-0">
          <p className="truncate text-[12.5px] font-bold text-ink sm:text-[13px]">
            FormGuard Pro <span className="hidden font-medium text-[#8491a7] sm:inline">Active Monitor</span>
          </p>
          <p className="hidden text-[10.5px] text-[#9aa6b9] sm:block">
            All systems operational
          </p>
        </div>
      </div>

      {/* Center: Daily Automated Schedule badge */}
      <div className="hidden items-center gap-2 rounded-xl border border-line bg-[#fafbfe] px-3.5 py-2 text-[11.5px] text-[#6b7b95] xl:flex">
        <Clock size={13} className="text-cobalt shrink-0" />
        <span>
          Daily automated schedule: <strong className="font-semibold text-ink">04:00 UTC (09:00 AM PKT)</strong>
        </span>
      </div>

      {/* Right: Quick actions */}
      <div className="flex shrink-0 items-center gap-2">
        <button
          onClick={handleRunAll}
          className="btn btn-secondary !h-9 px-3 sm:px-4 text-[12px]"
        >
          <Play size={13} className="text-cobalt fill-current" />
          <span className="hidden sm:inline">Run All Tests</span>
        </button>
        <Link
          href="/sites/new"
          className="btn btn-primary !h-9 px-3 sm:px-4 text-[12px]"
        >
          <Plus size={14} strokeWidth={2.5} />
          <span className="hidden sm:inline">Add Website</span>
        </Link>
      </div>
    </header>
  );
}
