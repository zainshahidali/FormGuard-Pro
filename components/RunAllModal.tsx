'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Play,
  Check,
  CircleAlert,
  CircleCheck,
  Clock,
  LoaderCircle,
  ShieldCheck,
  X,
  ArrowRight,
  Zap,
} from 'lucide-react';

interface RunAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function RunAllModal({ isOpen, onClose, onComplete }: RunAllModalProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isRunning) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isRunning, onClose]);

  // Reset state when modal opens
  useEffect(() => {
    if (isOpen && !isRunning) {
      setProgress(0);
      setResults(null);
      setError(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleRunAll = async () => {
    setIsRunning(true);
    setError(null);
    setResults(null);
    setProgress(15);

    // Simulated progress increment while server-side Playwright executes
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 90) return prev + 5;
        return prev;
      });
    }, 400);

    try {
      const res = await fetch('/api/test/run-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ manual: true }),
      });

      const data = await res.json();
      clearInterval(interval);

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete batch form tests.');
      }

      setProgress(100);
      setResults(data);
      if (onComplete) onComplete();
    } catch (err: any) {
      clearInterval(interval);
      setError(err.message || 'An unexpected error occurred during batch testing.');
      setProgress(0);
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] grid place-items-center bg-ink/55 px-4 backdrop-blur-sm animate-fade-in">
      <div className="animate-toast w-full max-w-[560px] overflow-hidden rounded-[22px] bg-white shadow-[0_30px_90px_rgba(12,24,45,.3)]">
        {/* Header */}
        <div className="flex items-start justify-between gap-4 border-b border-line px-6 py-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-[#eef1ff] text-cobalt">
              {isRunning ? (
                <LoaderCircle size={20} className="animate-spin" />
              ) : results ? (
                <CircleCheck size={20} className="text-mint" />
              ) : (
                <Zap size={20} />
              )}
            </span>
            <div>
              <h2 className="font-display text-[16px] font-bold text-ink">
                {isRunning
                  ? 'Running all tests'
                  : results
                  ? 'Batch test run complete'
                  : 'Execute all form tests'}
              </h2>
              <p className="mt-0.5 text-[11.5px] text-muted">
                {isRunning
                  ? 'Filling forms and verifying submission responses…'
                  : results
                  ? `Completed ${results.total || 0} form tests across active websites.`
                  : 'Automated headless Playwright verification runner'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="text-[#9aa6b9] hover:text-ink disabled:opacity-40 p-1 rounded-lg transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-6 py-5">
          {/* Initial State / Before Run */}
          {!isRunning && !results && !error && (
            <div className="space-y-4">
              <p className="text-[12.5px] leading-relaxed text-[#55657e]">
                This will spin up headless Chromium instances to sequentially navigate to all enabled WordPress sites, fill dummy form inputs, click submission buttons, and verify success indicators.
              </p>

              <div className="rounded-xl border border-line bg-[#f8fafd] p-4 text-[12px] text-[#4d5d77]">
                <div className="flex items-center gap-2 font-bold text-cobalt">
                  <ShieldCheck size={16} /> Real-time Alert Routing
                </div>
                <p className="mt-1 text-[11.5px] leading-relaxed text-[#687892]">
                  Any forms failing to submit will immediately capture a full-page viewport screenshot and dispatch alerts to your configured Slack webhooks and SMTP email inboxes.
                </p>
              </div>

              <div className="mt-6 flex items-center justify-end gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary !h-10 px-4 text-[12.5px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleRunAll}
                  className="btn btn-primary !h-10 px-5 text-[12.5px]"
                >
                  <Play size={14} className="fill-current" /> Start All Tests
                </button>
              </div>
            </div>
          )}

          {/* Running State */}
          {isRunning && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-[11.5px] font-semibold">
                <span className="text-[#5d6c86]">Running Playwright tests…</span>
                <span className="text-cobalt">{progress}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-[#e9edf6]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[#3c56e8] to-[#16c4a4] transition-[width] duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>

              <div className="py-6 text-center">
                <p className="text-[12.5px] font-medium text-[#4a5870]">
                  Headless browser is currently filling inputs & verifying responses across your sites...
                </p>
                <p className="mt-1 text-[11px] text-[#8fa0ba]">Please do not close this window.</p>
              </div>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="space-y-4">
              <div className="flex items-start gap-3 rounded-xl border border-[#ffccd2] bg-[#fff2f4] p-4 text-[12.5px] text-[#c93448]">
                <CircleAlert size={18} className="shrink-0 mt-0.5" />
                <div>
                  <strong className="block font-semibold">Test Execution Failed</strong>
                  <p className="mt-0.5 text-[11.5px] opacity-90">{error}</p>
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="btn btn-secondary !h-10 px-4 text-[12.5px]"
                >
                  Close
                </button>
                <button
                  type="button"
                  onClick={handleRunAll}
                  className="btn btn-primary !h-10 px-4 text-[12.5px]"
                >
                  Try Again
                </button>
              </div>
            </div>
          )}

          {/* Results State */}
          {results && (
            <div className="space-y-4">
              {/* Summary stat counters */}
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border border-line bg-[#f8fafd] p-3 text-center">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#8292aa]">Total</p>
                  <p className="mt-1 font-display text-[20px] font-extrabold text-ink">{results.total}</p>
                </div>
                <div className="rounded-xl border border-[#bce8db] bg-[#edfbf6] p-3 text-center">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#0e8b74]">Passed</p>
                  <p className="mt-1 font-display text-[20px] font-extrabold text-[#0e8b74]">{results.passed}</p>
                </div>
                <div className="rounded-xl border border-[#ffd2d8] bg-[#fff4f6] p-3 text-center">
                  <p className="text-[10.5px] font-bold uppercase tracking-wider text-[#d23f53]">Failed</p>
                  <p className="mt-1 font-display text-[20px] font-extrabold text-[#d23f53]">{results.failed}</p>
                </div>
              </div>

              {/* Form Results list */}
              <div className="soft-scroll max-h-[240px] space-y-2 overflow-y-auto pr-1">
                {results.results?.map((item: any, idx: number) => {
                  const passed = item.status === 'passed';
                  const skipped = item.status === 'skipped';
                  return (
                    <div
                      key={idx}
                      className="flex items-center gap-3 rounded-xl border border-line px-3.5 py-2.5 hover:bg-[#fafbfe] transition"
                    >
                      <span
                        className={`grid h-7 w-7 shrink-0 place-items-center rounded-lg ${
                          passed
                            ? 'bg-[#e7f8f2] text-mint'
                            : skipped
                            ? 'bg-[#fff4e0] text-[#d79b2d]'
                            : 'bg-[#ffeded] text-[#dc5262]'
                        }`}
                      >
                        {passed ? (
                          <Check size={14} strokeWidth={3} />
                        ) : (
                          <CircleAlert size={14} />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[12px] font-semibold text-ink">
                          {item.siteName}
                        </p>
                        {item.errorMessage ? (
                          <p className={`truncate text-[10.5px] ${skipped ? 'text-[#d79b2d]' : 'text-[#dc5262]'}`}>
                            {item.errorMessage}
                          </p>
                        ) : (
                          <p className="truncate text-[10.5px] text-muted">
                            All inputs submitted & verified
                          </p>
                        )}
                      </div>
                      <span className="shrink-0 text-[11px] font-mono text-[#8a99b0]">
                        {item.durationMs ? `${item.durationMs}ms` : ''}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Completion Banner */}
              <div className="animate-rise flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[#f7f9fc] border border-line px-4 py-3">
                <div>
                  <p className="text-[12.5px] font-bold text-ink">
                    {results.passed} passed · {results.failed} {results.failed === 1 ? 'failure' : 'failures'}
                  </p>
                  <p className="text-[11px] text-muted">
                    Screenshots and execution details are stored in Test Logs.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={onClose}
                    className="btn btn-secondary btn-sm"
                  >
                    Done
                  </button>
                  <Link
                    href="/logs"
                    onClick={onClose}
                    className="btn btn-primary btn-sm"
                  >
                    View logs <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
