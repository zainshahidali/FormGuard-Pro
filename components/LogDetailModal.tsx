'use client';

import React from 'react';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  Terminal,
  Image as ImageIcon,
  Mail,
  MessageSquare,
  AlertOctagon,
  ExternalLink,
} from 'lucide-react';

interface LogDetailModalProps {
  log: any;
  onClose: () => void;
}

export default function LogDetailModal({ log, onClose }: LogDetailModalProps) {
  if (!log) return null;

  const isPassed = log.status === 'passed';
  const site = log.siteId || {};

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-navy-900/85 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-surface border border-surface-border rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col text-slate-100 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-surface-border bg-navy-800 shrink-0">
          <div className="flex items-center gap-3">
            {isPassed ? (
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
                <XCircle className="w-5 h-5" />
              </div>
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-base text-white">
                  {site.name || 'Monitored Form Test'}
                </h3>
                <span
                  className={`text-xs font-semibold px-2 py-0.5 rounded uppercase tracking-wider ${
                    isPassed
                      ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                      : 'bg-red-500/15 text-red-400 border border-red-500/30'
                  }`}
                >
                  {log.status}
                </span>
              </div>
              {site.url && (
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-sky-accent hover:underline flex items-center gap-1 mt-0.5"
                >
                  {site.url} <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-surface-border/50 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="p-6 space-y-6 overflow-y-auto">
          {/* Metadata Row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-navy-800 p-3 rounded-lg border border-surface-border">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                <Clock className="w-3.5 h-3.5 text-slate-400" /> Duration
              </span>
              <p className="text-sm font-semibold text-white mt-1">
                {log.durationMs ? `${log.durationMs}ms` : 'N/A'}
              </p>
            </div>

            <div className="bg-navy-800 p-3 rounded-lg border border-surface-border">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                Executed At
              </span>
              <p className="text-xs font-semibold text-white mt-1">
                {log.executedAt ? new Date(log.executedAt).toLocaleString() : 'Just now'}
              </p>
            </div>

            <div className="bg-navy-800 p-3 rounded-lg border border-surface-border">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                <Mail className="w-3.5 h-3.5 text-sky-accent" /> Email Alert
              </span>
              <p className="text-xs font-semibold mt-1">
                {log.notificationsSent?.email ? (
                  <span className="text-emerald-400">Dispatched</span>
                ) : (
                  <span className="text-slate-400">Not Sent</span>
                )}
              </p>
            </div>

            <div className="bg-navy-800 p-3 rounded-lg border border-surface-border">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" /> Slack Alert
              </span>
              <p className="text-xs font-semibold mt-1">
                {log.notificationsSent?.slack ? (
                  <span className="text-emerald-400">Dispatched</span>
                ) : (
                  <span className="text-slate-400">Not Sent</span>
                )}
              </p>
            </div>
          </div>

          {/* Multi-Form Test Results Breakdown */}
          {log.formResults && log.formResults.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-sky-accent flex items-center justify-between">
                <span>Forms Tested on this Website ({log.formResults.length})</span>
                <span className="text-[11px] text-slate-400 font-normal">
                  {log.formResults.filter((f: any) => f.status === 'passed').length}/{log.formResults.length} passed
                </span>
              </label>
              <div className="space-y-2">
                {log.formResults.map((fr: any, idx: number) => {
                  const frPassed = fr.status === 'passed';
                  return (
                    <div
                      key={fr.formId || idx}
                      className={`p-3 rounded-lg border text-xs flex flex-col gap-1.5 ${
                        frPassed
                          ? 'bg-emerald-950/20 border-emerald-900/50 text-emerald-200'
                          : 'bg-red-950/30 border-red-900/60 text-red-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              frPassed ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}
                          >
                            {fr.status.toUpperCase()}
                          </span>
                          <span className="font-semibold text-white">{fr.formName}</span>
                        </div>
                        <span className="text-slate-400 font-mono text-[11px]">{fr.durationMs}ms</span>
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        🔗 {fr.pageUrl}
                      </div>
                      {fr.errorMessage && (
                        <div className="text-[11px] text-red-300 font-mono bg-red-950/60 p-2 rounded mt-1">
                          {fr.errorMessage}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Failure Error Message */}
          {!isPassed && log.errorMessage && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-red-400 flex items-center gap-1.5">
                <AlertOctagon className="w-4 h-4" /> Failure Step & Reason
              </label>
              <div className="p-4 rounded-lg bg-red-950/40 border border-red-900/60 text-red-200 text-sm font-mono leading-relaxed break-words">
                {log.errorMessage}
              </div>
            </div>
          )}

          {/* Captured Browser Console Errors */}
          {log.consoleErrors && log.consoleErrors.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-sky-accent" /> Captured Browser Console Errors
              </label>
              <div className="p-4 rounded-lg bg-navy-800 border border-surface-border text-xs font-mono text-slate-300 space-y-1.5 max-h-48 overflow-y-auto">
                {log.consoleErrors.map((err: string, i: number) => (
                  <div key={i} className="text-amber-300/90 leading-tight">
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failure Screenshot */}
          {log.screenshotBase64 ? (
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <ImageIcon className="w-4 h-4 text-sky-accent" /> Failure Viewport Screenshot
                </span>
                <a
                  href={`data:image/png;base64,${log.screenshotBase64}`}
                  download={`failure-${site.name || 'log'}.png`}
                  className="text-xs text-sky-accent hover:underline lowercase font-normal"
                >
                  Download image
                </a>
              </label>
              <div className="border border-surface-border rounded-lg overflow-hidden bg-navy-800 p-2">
                <img
                  src={`data:image/png;base64,${log.screenshotBase64}`}
                  alt="Failure Viewport Screenshot"
                  className="w-full h-auto rounded border border-surface-border shadow"
                />
              </div>
            </div>
          ) : !isPassed ? (
            <div className="text-xs text-slate-500 italic p-4 bg-navy-800 rounded-lg border border-surface-border text-center">
              No screenshot captured for this test run.
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-surface-border bg-navy-800 shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-xs font-medium text-slate-300 hover:text-white bg-surface hover:bg-surface-hover border border-surface-border transition-colors"
          >
            Close Details
          </button>
        </div>
      </div>
    </div>
  );
}

