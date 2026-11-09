'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  PlusCircle,
  FileText,
  Settings,
  Activity,
  Globe,
} from 'lucide-react';

const NAV_ITEMS = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Add Website', href: '/sites/new', icon: PlusCircle },
  { name: 'Test Logs', href: '/logs', icon: FileText },
  { name: 'Settings & Alerts', href: '/settings', icon: Settings },
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-64 bg-navy-800 border-r border-surface-border flex flex-col justify-between shrink-0 min-h-screen">
      <div>
        {/* Brand Header */}
        <div className="h-16 flex items-center px-6 border-b border-surface-border">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-tr from-teal-accent to-sky-accent flex items-center justify-center text-navy-900 shadow-lg shadow-sky-accent/20 group-hover:scale-105 transition-transform">
              <ShieldCheck className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <span className="font-bold text-lg text-slate-100 tracking-tight flex items-center gap-1.5">
                FormGuard <span className="text-sky-accent text-xs font-semibold px-1.5 py-0.5 rounded bg-sky-accent/10 border border-sky-accent/20">PRO</span>
              </span>
              <p className="text-[11px] text-slate-400">Multi-Site Form Monitor</p>
            </div>
          </Link>
        </div>

        {/* Navigation Menu */}
        <nav className="p-4 space-y-1.5">
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Menu
          </div>
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center gap-3 px-3.5 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-sky-accent/15 text-sky-accent border border-sky-accent/30 font-semibold shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-surface'
                }`}
              >
                <Icon className={`w-4 h-4 ${isActive ? 'text-sky-accent' : 'text-slate-400'}`} />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>

      {/* Footer Info Card */}
      <div className="p-4 border-t border-surface-border">
        <div className="bg-surface rounded-lg p-3.5 border border-surface-border text-xs">
          <div className="flex items-center justify-between mb-2">
            <span className="text-slate-400 flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
              Engine Status
            </span>
            <span className="text-emerald-400 font-semibold text-[11px] bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
              Online
            </span>
          </div>
          <div className="text-slate-400 text-[11px] leading-relaxed">
            Headless Chromium runner ready. Alerts routed to Slack & SMTP.
          </div>
        </div>
      </div>
    </aside>
  );
}

