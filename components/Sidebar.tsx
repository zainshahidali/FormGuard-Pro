'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  ShieldCheck,
  LayoutDashboard,
  Globe,
  FileText,
  Settings2,
  Zap,
  Plus,
  Bell,
  ChevronRight,
  Database,
  Activity,
  X,
} from 'lucide-react';

const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { id: 'add', label: 'Add Website', href: '/sites/new', icon: Globe },
  { id: 'logs', label: 'Test Logs', href: '/logs', icon: FileText },
  { id: 'settings', label: 'Settings & Alerts', href: '/settings', icon: Settings2 },
];

export default function Sidebar({
  isOpen = false,
  onClose,
}: {
  isOpen?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [dbStatus, setDbStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  const [failedLogsCount, setFailedLogsCount] = useState<number>(0);

  useEffect(() => {
    fetch('/api/health')
      .then((res) => res.json())
      .then((data) => {
        if (data.database?.connected) {
          setDbStatus('connected');
        } else {
          setDbStatus('disconnected');
        }
      })
      .catch(() => setDbStatus('disconnected'));

    // Fetch recent failed count for badge
    fetch('/api/logs?limit=50')
      .then((res) => res.json())
      .then((data) => {
        if (data.logs) {
          const fails = data.logs.filter((l: any) => l.status === 'failed').length;
          setFailedLogsCount(fails);
        }
      })
      .catch(() => {});
  }, []);

  const triggerRunAll = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('formguard:open-run-all'));
    }
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-ink/45 backdrop-blur-sm lg:hidden cursor-pointer"
          aria-label="Close menu"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`sidebar-grain fixed inset-y-0 left-0 z-50 flex w-[248px] flex-col bg-ink transition-transform duration-300 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Brand Header */}
        <div className="relative flex h-[72px] shrink-0 items-center gap-3 border-b border-white/[.07] px-5">
          <Link href="/" className="flex items-center gap-3 group">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-[#4c6bff] to-[#16c4a4] shadow-[0_6px_18px_rgba(60,86,232,.35)] group-hover:scale-105 transition-transform">
              <ShieldCheck size={19} className="text-white" />
            </span>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-display text-[15px] font-extrabold tracking-tight text-white">
                  FormGuard
                </span>
                <span className="rounded bg-[#3c56e8] px-1.5 py-0.5 text-[9px] font-extrabold tracking-wider text-white">
                  PRO
                </span>
              </div>
              <p className="text-[10px] text-[#8ba0c3]">Multi-Site Form Monitor</p>
            </div>
          </Link>
          {onClose && (
            <button
              onClick={onClose}
              className="ml-auto text-[#8ba0c3] hover:text-white lg:hidden"
              aria-label="Close menu"
            >
              <X size={17} />
            </button>
          )}
        </div>

        {/* Navigation */}
        <nav className="relative flex-1 px-3 py-6 overflow-y-auto soft-scroll">
          <p className="mb-3 px-3 font-display text-[10px] font-extrabold tracking-[.16em] text-[#6d83a8]">
            MENU
          </p>
          <div className="space-y-1">
            {NAV_ITEMS.map((item) => {
              const active =
                item.href === '/'
                  ? pathname === '/'
                  : pathname?.startsWith(item.href);

              return (
                <Link
                  key={item.id}
                  href={item.href}
                  onClick={onClose}
                  className={`relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-[12.5px] font-semibold transition ${
                    active
                      ? 'bg-white/[.09] text-white'
                      : 'text-[#93a5c2] hover:bg-white/[.05] hover:text-white'
                  }`}
                >
                  {active && (
                    <span className="absolute -left-3 top-1/2 h-6 w-1 -translate-y-1/2 rounded-r-full bg-[#61a2ff]" />
                  )}
                  <item.icon size={16} className={active ? 'text-[#83a8ff]' : ''} />
                  <span className="flex-1">{item.label}</span>
                  {item.id === 'logs' && failedLogsCount > 0 && (
                    <span className="rounded-md bg-[#ff6b79]/20 px-1.5 py-0.5 text-[10px] font-bold text-[#ff8f9a]">
                      {failedLogsCount}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          <p className="mb-3 mt-8 px-3 font-display text-[10px] font-extrabold tracking-[.16em] text-[#6d83a8]">
            QUICK ACTIONS
          </p>
          <div className="space-y-1">
            <button
              onClick={triggerRunAll}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12.5px] font-semibold text-[#93a5c2] transition hover:bg-white/[.05] hover:text-white text-left"
            >
              <Zap size={16} className="text-[#83a8ff]" /> Run All Tests
            </button>
            <Link
              href="/sites/new"
              onClick={onClose}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[12.5px] font-semibold text-[#93a5c2] transition hover:bg-white/[.05] hover:text-white text-left"
            >
              <Plus size={16} /> New Website
            </Link>
          </div>

          <div className="mx-1 mt-8 rounded-2xl border border-white/[.08] bg-white/[.04] p-4">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-[#83a8ff]" />
              <span className="text-[11.5px] font-bold text-white">Stay ahead of failures</span>
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-[#91a5c5]">
              Your forms are checked every day. Failures trigger instant alerts.
            </p>
            <Link
              href="/settings"
              onClick={onClose}
              className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#9db4ff] hover:text-white"
            >
              Alert settings <ChevronRight size={12} />
            </Link>
          </div>
        </nav>

        {/* System Status Footer */}
        <div className="relative border-t border-white/[.07] px-5 py-4">
          <div className="mb-3 flex items-center justify-between text-[10px] font-bold uppercase tracking-[.12em] text-[#6d83a8]">
            <span>System status</span>
            <span className="text-[#64dfba]">99.99% uptime</span>
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-[#a1b3cf]">
              <Database size={13} />
              <span className="flex-1">Database</span>
              <span
                className={`font-semibold ${
                  dbStatus === 'connected'
                    ? 'text-[#64dfba]'
                    : dbStatus === 'checking'
                    ? 'text-amber-400'
                    : 'text-rose-400'
                }`}
              >
                {dbStatus === 'connected' ? 'Connected' : dbStatus === 'checking' ? 'Checking…' : 'Offline'}
              </span>
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#a1b3cf]">
              <Activity size={13} />
              <span className="flex-1">Engine</span>
              <span className="font-semibold text-[#64dfba]">Online</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
