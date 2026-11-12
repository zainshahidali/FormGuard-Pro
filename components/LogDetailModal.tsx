'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  CircleCheck,
  CircleAlert,
  Clock,
  Terminal,
  Image as ImageIcon,
  Mail,
  MessageSquare,
  AlertOctagon,
  ExternalLink,
  Download,
} from 'lucide-react';
import { StatusPill } from '@/components/ui';

interface LogDetailModalProps {
  log: any;
  onClose: () => void;
}

export default function LogDetailModal({ log, onClose }: LogDetailModalProps) {
  const [currentLog, setCurrentLog] = useState<any>(log);
  const [loadingDetails, setLoadingDetails] = useState<boolean>(false);

  useEffect(() => {
    setCurrentLog(log);
    // On-demand fetch of heavy screenshots only when modal opens for a failed log
    if (log?._id && log.status === 'failed' && !log.screenshotBase64) {
      setLoadingDetails(true);
      fetch(`/api/logs/${log._id}`)
        .then((res) => res.json())
        .then((data) => {
          if (data.success && data.log) {
            setCurrentLog(data.log);
          }
        })
        .catch((err) => console.error('Failed to load log details:', err))
        .finally(() => setLoadingDetails(false));
    }
  }, [log]);

  if (!log) return null;

  const activeLog = currentLog || log;
  const isPassed = activeLog.status === 'passed';
  const site = activeLog.siteId || {};

  return (
    <div className="fixed inset-0 z-[75] grid place-items-center bg-ink/55 px-4 backdrop-blur-sm animate-fade-in">
      <div className="animate-toast w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden rounded-[22px] bg-white shadow-[0_30px_90px_rgba(12,24,45,.3)] text-ink">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-line px-6 py-4 bg-[#fbfcfe] shrink-0">
          <div className="flex items-center gap-3">
            <span
              className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${
                isPassed ? 'bg-[#e7f8f2] text-mint' : 'bg-[#ffeded] text-[#dc5262]'
              }`}
            >
              {isPassed ? <CircleCheck size={20} /> : <CircleAlert size={20} />}
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-display text-[15.5px] font-bold text-ink">
                  {site.name || 'Test Execution Report'}
                </h3>
                <StatusPill tone={isPassed ? 'green' : 'red'}>
                  {log.status.toUpperCase()}
                </StatusPill>
              </div>
              {site.url && (
                <a
                  href={site.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-0.5 flex items-center gap-1 text-[11px] text-cobalt hover:underline"
                >
                  {site.url} <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="rounded-lg p-1 text-[#9aa6b9] hover:bg-[#f0f3f9] hover:text-ink transition-colors"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="soft-scroll overflow-y-auto p-6 space-y-6">
          {/* Metadata Row */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-line bg-[#f8fafd] p-3">
              <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#8292aa]">
                <Clock size={12} className="text-[#8292aa]" /> Duration
              </span>
              <p className="mt-1 font-display text-[15px] font-extrabold text-ink">
                {log.durationMs ? `${log.durationMs}ms` : 'N/A'}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-[#f8fafd] p-3">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#8292aa]">
                Executed At
              </span>
              <p className="mt-1 text-[12px] font-semibold text-ink">
                {log.executedAt ? new Date(log.executedAt).toLocaleString() : 'Just now'}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-[#f8fafd] p-3">
              <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#8292aa]">
                <Mail size={12} className="text-cobalt" /> Email Alert
              </span>
              <p className="mt-1 text-[12px] font-semibold">
                {log.notificationsSent?.email ? (
                  <span className="text-mint">Dispatched</span>
                ) : (
                  <span className="text-[#9aa6b9]">Not Sent</span>
                )}
              </p>
            </div>

            <div className="rounded-xl border border-line bg-[#f8fafd] p-3">
              <span className="flex items-center gap-1.5 text-[10.5px] font-bold uppercase tracking-wider text-[#8292aa]">
                <MessageSquare size={12} className="text-[#d79b2d]" /> Slack Alert
              </span>
              <p className="mt-1 text-[12px] font-semibold">
                {log.notificationsSent?.slack ? (
                  <span className="text-mint">Dispatched</span>
                ) : (
                  <span className="text-[#9aa6b9]">Not Sent</span>
                )}
              </p>
            </div>
          </div>

          {/* Multi-Form Test Results Breakdown */}
          {log.formResults && log.formResults.length > 0 && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-cobalt">
                  Forms Tested on this Website ({log.formResults.length})
                </span>
                <span className="text-[11px] text-muted">
                  {log.formResults.filter((f: any) => f.status === 'passed').length}/
                  {log.formResults.length} passed
                </span>
              </div>
              <div className="space-y-2">
                {log.formResults.map((fr: any, idx: number) => {
                  const frPassed = fr.status === 'passed';
                  return (
                    <div
                      key={fr.formId || idx}
                      className={`rounded-xl border p-3.5 text-xs flex flex-col gap-1.5 ${
                        frPassed
                          ? 'border-[#c6ebde] bg-[#f2fbf7]'
                          : 'border-[#ffccd2] bg-[#fff4f6]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <StatusPill tone={frPassed ? 'green' : 'red'}>
                            {fr.status.toUpperCase()}
                          </StatusPill>
                          <span className="font-semibold text-ink">{fr.formName}</span>
                        </div>
                        <span className="font-mono text-[11px] text-[#8492a6]">{fr.durationMs}ms</span>
                      </div>
                      <div className="truncate text-[11px] text-[#6b7c96]">
                        🔗 {fr.pageUrl}
                      </div>
                      {fr.errorMessage && (
                        <div className="mt-1 rounded-lg bg-[#ffe8ec] p-2.5 font-mono text-[11px] text-[#c93448]">
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
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#d23f53]">
                <AlertOctagon size={13} /> Failure Step & Reason
              </span>
              <div className="break-words rounded-xl border border-[#ffccd2] bg-[#fff2f4] p-4 font-mono text-[11.5px] leading-relaxed text-[#c93448]">
                {log.errorMessage}
              </div>
            </div>
          )}

          {/* Captured Browser Console Errors */}
          {log.consoleErrors && log.consoleErrors.length > 0 && (
            <div className="space-y-2">
              <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink">
                <Terminal size={13} className="text-cobalt" /> Captured Browser Console Errors
              </span>
              <div className="soft-scroll max-h-44 space-y-1 overflow-y-auto rounded-xl border border-line bg-[#f8fafd] p-3.5 font-mono text-[11px] text-[#556783]">
                {log.consoleErrors.map((err: string, i: number) => (
                  <div key={i} className="leading-tight text-[#c25026]">
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Failure Screenshot */}
          {activeLog.screenshotBase64 ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-ink">
                  <ImageIcon size={13} className="text-cobalt" /> Failure Viewport Screenshot
                </span>
                <a
                  href={`data:image/png;base64,${activeLog.screenshotBase64}`}
                  download={`failure-${site.name || 'test'}.png`}
                  className="flex items-center gap-1 text-[11.5px] font-semibold text-cobalt hover:underline"
                >
                  <Download size={12} /> Download image
                </a>
              </div>
              <div className="overflow-hidden rounded-xl border border-line bg-[#fbfcfe] p-2">
                <img
                  src={`data:image/png;base64,${activeLog.screenshotBase64}`}
                  alt="Failure Viewport Screenshot"
                  className="h-auto w-full rounded-lg border border-line shadow-sm"
                />
              </div>
            </div>
          ) : loadingDetails ? (
            <div className="flex items-center justify-center gap-2 rounded-xl border border-line bg-[#fbfcfe] p-6 text-[12px] text-muted">
              <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-cobalt border-t-transparent" />
              Loading high-resolution failure screenshot…
            </div>
          ) : !isPassed ? (
            <div className="rounded-xl border border-line bg-[#fbfcfe] p-4 text-center text-[11.5px] italic text-muted">
              No screenshot captured for this test run.
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-line bg-[#fbfcfe] px-6 py-4 shrink-0">
          <button onClick={onClose} className="btn btn-secondary btn-sm">
            Close details
          </button>
        </div>
      </div>
    </div>
  );
}
