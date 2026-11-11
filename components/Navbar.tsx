'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, Clock, Play, Plus } from 'lucide-react';

interface NavbarProps {
  onOpenMenu?: () => void;
  onRunAll?: () => void;
}

export default function Navbar({ onOpenMenu, onRunAll }: NavbarProps) {
  const [isDailyEnabled, setIsDailyEnabled] = useState(true);
  const [isToggling, setIsToggling] = useState(false);

  useEffect(() => {
    let mounted = true;
    const fetchSettings = async () => {
      try {
        const res = await fetch('/api/settings');
        const data = await res.json();
        if (mounted && data.success && data.settings) {
          setIsDailyEnabled(data.settings.isDailyTestingEnabled !== false);
        }
      } catch (err) {
        console.error('Failed to fetch settings in Navbar:', err);
      }
    };

    fetchSettings();

    // Listen for custom toggle events dispatched elsewhere in the app
    const handleSync = (e: any) => {
      if (e.detail?.enabled !== undefined) {
        setIsDailyEnabled(e.detail.enabled);
      } else {
        fetchSettings();
      }
    };

    window.addEventListener('formguard:daily-testing-toggled', handleSync);
    window.addEventListener('formguard:settings-updated', handleSync);

    return () => {
      mounted = false;
      window.removeEventListener('formguard:daily-testing-toggled', handleSync);
      window.removeEventListener('formguard:settings-updated', handleSync);
    };
  }, []);

  const handleToggleDaily = async () => {
    if (isToggling) return;
    const nextState = !isDailyEnabled;
    setIsDailyEnabled(nextState); // Optimistic UI
    setIsToggling(true);

    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isDailyTestingEnabled: nextState }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update daily testing setting');
      }

      // Notify the rest of the application
      window.dispatchEvent(
        new CustomEvent('formguard:daily-testing-toggled', { detail: { enabled: nextState } })
      );
    } catch (err: any) {
      console.error('Error toggling daily tests:', err);
      setIsDailyEnabled(!nextState); // Rollback on failure
    } finally {
      setIsToggling(false);
    }
  };

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

        {/* Center: Daily Automated Schedule badge with Toggle Switch */}
        <div
          className={`hidden items-center gap-3 rounded-xl border px-3.5 py-1.5 transition-all duration-200 md:flex ${isDailyEnabled
              ? 'border-[#dbe4f8] bg-[#f8faff]'
              : 'border-[#e6eaf1] bg-[#fbfcfe]'
            }`}
        >
          <div className="flex items-center gap-2.5">
            <span
              className={`grid h-7 w-7 place-items-center rounded-lg transition-colors ${isDailyEnabled ? 'bg-[#eef1ff] text-cobalt' : 'bg-[#f0f3f8] text-[#8fa0b5]'
                }`}
            >
              <Clock size={14} />
            </span>
            <div className="flex flex-col text-left">
              <div className="flex items-center gap-1.5 leading-none">
                <span className="text-[12px] font-bold text-ink">Daily auto-test</span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[9.5px] font-extrabold uppercase tracking-wide transition-colors ${isDailyEnabled
                      ? 'bg-[#e7f8f2] text-[#0b8d73]'
                      : 'bg-[#ffeded] text-[#c23b48]'
                    }`}
                >
                  {isDailyEnabled ? 'Active' : 'Off'}
                </span>
              </div>
              <span className="mt-0.5 text-[10px] text-[#71809a]">
                {isDailyEnabled ? '04:00 UTC (09:00 AM PKT)' : 'Daily automated run is paused'}
              </span>
            </div>
          </div>

          {/* Toggle Switch */}
          <div className="flex items-center pl-2.5 border-l border-line/80">
            <button
              type="button"
              role="switch"
              aria-checked={isDailyEnabled}
              aria-label="Toggle daily automated testing for all sites"
              title={isDailyEnabled ? 'Click to turn OFF daily auto testing' : 'Click to turn ON daily auto testing'}
              onClick={handleToggleDaily}
              disabled={isToggling}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-cobalt/30 ${isDailyEnabled ? 'bg-cobalt' : 'bg-[#c8d3e2]'
                } ${isToggling ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out ${isDailyEnabled ? 'translate-x-4' : 'translate-x-0'
                  }`}
              />
            </button>
          </div>
        </div>

        {/* Right: Quick actions */}
        <div className="flex shrink-0 items-center gap-2">
          {/* Mobile-only compact toggle */}
          <button
            type="button"
            onClick={handleToggleDaily}
            title={isDailyEnabled ? 'Daily auto-test: ON (Tap to turn OFF)' : 'Daily auto-test: OFF (Tap to turn ON)'}
            className={`grid h-9 w-9 place-items-center rounded-xl border text-[11px] md:hidden transition-colors ${isDailyEnabled
                ? 'border-[#c7d8f9] bg-[#eef3ff] text-cobalt'
                : 'border-line bg-white text-[#9aa6b9]'
              }`}
          >
            <Clock size={15} />
          </button>

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
