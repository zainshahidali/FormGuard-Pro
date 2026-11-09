'use client';

import React, { useState } from 'react';
import { Play, CheckCircle2, XCircle, Loader2, AlertTriangle, ShieldCheck, X } from 'lucide-react';

interface RunAllModalProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
}

export default function RunAllModal({ isOpen, onClose, onComplete }: RunAllModalProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [results, setResults] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleRunAll = async () => {
    setIsRunning(true);
    setError(null);
    setResults(null);

    try {
      const res = await fetch('/api/test/run-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to complete batch form tests.');
      }

      setResults(data);
      if (onComplete) onComplete();
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred during batch testing.');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-surface-border rounded-xl shadow-2xl max-w-xl w-full overflow-hidden text-slate-100">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-navy-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-sky-accent/10 border border-sky-accent/20 text-sky-accent">
              <Play className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-white">Execute All Active Form Tests</h3>
              <p className="text-xs text-slate-400">Headless Playwright automated verification runner</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isRunning}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-border/50 transition-colors disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          {!results && !isRunning && !error && (
            <div className="text-sm text-slate-300 space-y-3">
              <p>
                This will spin up headless Chromium instances to sequentially navigate to all enabled WordPress sites, fill test data, click submission buttons, and verify success indicators.
              </p>
              <div className="bg-navy-800 p-4 rounded-lg border border-surface-border text-xs text-slate-300 space-y-2">
                <div className="flex items-center gap-2 font-medium text-sky-accent">
                  <ShieldCheck className="w-4 h-4" /> Real-time Alert Routing
                </div>
                <p>
                  Any forms failing to submit or verify will immediately capture a full viewport screenshot and dispatch real-time alerts to configured Slack webhooks and SMTP email recipients.
                </p>
              </div>
            </div>
          )}

          {isRunning && (
            <div className="py-8 text-center space-y-4">
              <Loader2 className="w-10 h-10 text-sky-accent animate-spin mx-auto" />
              <div>
                <h4 className="text-base font-semibold text-white">Testing In Progress...</h4>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  Running automated Playwright browser tests across your monitored sites. Please wait a few moments...
                </p>
              </div>
            </div>
          )}

          {error && (
            <div className="p-4 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-sm flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Execution Error</span>
                <span className="text-xs opacity-90">{error}</span>
              </div>
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-navy-800 p-3 rounded-lg border border-surface-border text-center">
                  <div className="text-xs text-slate-400 font-medium">Total Tested</div>
                  <div className="text-xl font-bold text-white mt-0.5">{results.total}</div>
                </div>
                <div className="bg-navy-800 p-3 rounded-lg border border-surface-border text-center">
                  <div className="text-xs text-emerald-400 font-medium">Passed</div>
                  <div className="text-xl font-bold text-emerald-400 mt-0.5">{results.passed}</div>
                </div>
                <div className="bg-navy-800 p-3 rounded-lg border border-surface-border text-center">
                  <div className="text-xs text-red-400 font-medium">Failed</div>
                  <div className="text-xl font-bold text-red-400 mt-0.5">{results.failed}</div>
                </div>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-2 pr-1">
                {results.results?.map((item: any, idx: number) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg bg-navy-800 border border-surface-border text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {item.status === 'passed' ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-semibold text-slate-200">{item.siteName}</span>
                        {item.errorMessage && (
                          <p className="text-[11px] text-red-300 truncate max-w-sm">
                            {item.errorMessage}
                          </p>
                        )}
                      </div>
                    </div>
                    <span className="text-slate-400 font-mono text-[11px]">
                      {item.durationMs ? `${item.durationMs}ms` : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-surface-border bg-navy-800">
          <button
            type="button"
            onClick={onClose}
            disabled={isRunning}
            className="px-4 py-2 rounded-lg text-sm text-slate-300 hover:text-white hover:bg-surface transition-colors disabled:opacity-50"
          >
            {results ? 'Close' : 'Cancel'}
          </button>

          {!results && (
            <button
              type="button"
              onClick={handleRunAll}
              disabled={isRunning}
              className="flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-semibold text-navy-900 bg-gradient-to-r from-sky-accent to-teal-light hover:brightness-110 transition-all shadow-md shadow-sky-accent/20 disabled:opacity-50"
            >
              {isRunning ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" /> Running Tests...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4 fill-current" /> Start All Tests
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

