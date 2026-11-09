'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Download,
  RefreshCw,
  Search,
  Filter,
  CircleCheck,
  CircleAlert,
  ChevronRight,
  Clock,
  Play,
  FileText,
  ExternalLink,
  Layers,
  Globe,
} from 'lucide-react';
import { StatusPill, Toast, type Notice } from '@/components/ui';
import LogDetailModal from '@/components/LogDetailModal';

export const dynamic = 'force-dynamic';

function LogsContent() {
  const searchParams = useSearchParams();
  const initialSiteId = searchParams.get('siteId') || 'all';

  const [logs, setLogs] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(initialSiteId);
  const [filter, setFilter] = useState<'All' | 'Passed' | 'Failed'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeModalLog, setActiveModalLog] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [notice, setNotice] = useState<Notice | null>(null);

  const notify = (message: string, tone: 'success' | 'info' | 'error' = 'success') => {
    setNotice({ id: Date.now(), message, tone });
  };

  const fetchSites = async () => {
    try {
      const res = await fetch('/api/sites');
      const data = await res.json();
      if (data.success) {
        setSites(data.sites || []);
      }
    } catch (err) {
      console.error('Failed to fetch sites:', err);
    }
  };

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      if (selectedSiteId && selectedSiteId !== 'all') {
        query.set('siteId', selectedSiteId);
      }
      query.set('limit', '100');

      const res = await fetch(`/api/logs?${query.toString()}`);
      const data = await res.json();
      if (data.success) {
        setLogs(data.logs || []);
      }
    } catch (err) {
      console.error('Failed to fetch logs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [selectedSiteId]);

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Filter logs by Status and Query
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const isPassed = log.status === 'passed';
      const matchesStatus =
        filter === 'All' ? true : filter === 'Passed' ? isPassed : !isPassed;

      const siteName = log.siteId?.name || '';
      const siteUrl = log.siteId?.url || '';
      const formsText = log.formResults?.map((f: any) => f.formName).join(' ') || '';
      const errorText = log.errorMessage || '';

      const fullHaystack = `${siteName} ${siteUrl} ${formsText} ${errorText}`.toLowerCase();
      const matchesQuery = fullHaystack.includes(searchQuery.toLowerCase());

      return matchesStatus && matchesQuery;
    });
  }, [logs, filter, searchQuery]);

  const passedCount = logs.filter((l) => l.status === 'passed').length;
  const failedCount = logs.filter((l) => l.status === 'failed').length;

  // Export CSV
  const exportCsv = () => {
    const header = 'Status,Website,Forms Tested,Duration(ms),Executed At,Error Message';
    const rows = filteredLogs.map((l) => {
      const siteName = (l.siteId?.name || 'Website').replace(/"/g, '""');
      const formsCount = l.formResults?.length || 1;
      const duration = l.durationMs || 0;
      const date = l.executedAt ? new Date(l.executedAt).toISOString() : '';
      const error = (l.errorMessage || '').replace(/"/g, '""');

      return `"${l.status}","${siteName}","${formsCount}","${duration}","${date}","${error}"`;
    });

    const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `formguard-test-logs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    notify('Test log CSV exported successfully.', 'success');
  };

  const triggerRunAll = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('formguard:open-run-all'));
    }
  };

  return (
    <div className="canvas-glow min-h-full">
      <div className="mx-auto w-full max-w-[1130px] px-4 py-7 sm:px-7 lg:px-9">
        {/* Page Heading */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-display text-[10px] font-extrabold tracking-[.17em] text-cobalt">
              TEST HISTORY
            </p>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-.035em] text-ink sm:text-[32px]">
              Test logs
            </h1>
            <p className="mt-1.5 text-[13px] text-muted">
              Every submission attempt, verification result, console log, and screenshot from your monitored forms.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary btn-lg" onClick={exportCsv}>
              <Download size={14} /> Export CSV
            </button>
            <button className="btn btn-primary btn-lg" onClick={triggerRunAll}>
              <RefreshCw size={14} /> Run new tests
            </button>
          </div>
        </div>

        {/* Main Panel */}
        <div className="panel animate-rise overflow-hidden">
          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
            <div className="flex items-center gap-1 rounded-xl bg-[#f2f5fa] p-1">
              {(['All', 'Passed', 'Failed'] as const).map((option) => (
                <button
                  key={option}
                  onClick={() => setFilter(option)}
                  className={`rounded-lg px-3.5 py-1.5 text-[11.5px] font-semibold transition ${
                    filter === option
                      ? 'bg-white text-ink shadow-sm'
                      : 'text-[#8491a7] hover:text-ink'
                  }`}
                >
                  {option}
                  {option === 'Passed' && <span className="ml-1 text-[10px] text-mint">({passedCount})</span>}
                  {option === 'Failed' && <span className="ml-1 text-[10px] text-[#dc5262]">({failedCount})</span>}
                </button>
              ))}
            </div>

            <div className="flex flex-1 flex-wrap items-center gap-2 sm:max-w-[480px]">
              {/* Site Selector */}
              <select
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                className="field !h-9 !w-auto text-[11.5px]"
              >
                <option value="all">All Websites ({sites.length})</option>
                {sites.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>

              {/* Search query */}
              <div className="relative flex-1 min-w-[170px]">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa6b9]"
                />
                <input
                  className="field !h-9 !pl-9 text-[11.5px]"
                  placeholder="Search forms, sites or errors…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Table Container */}
          <div className="soft-scroll overflow-x-auto">
            <div className="min-w-[760px]">
              <div className="grid grid-cols-[110px_1.4fr_1.2fr_100px_90px_140px_24px] gap-3 border-b border-line bg-[#f8fafd] px-5 py-2.5">
                {['Status', 'Form / Site', 'Target URL', 'Trigger', 'Duration', 'Time', ''].map(
                  (h) => (
                    <span
                      key={h}
                      className="text-[10px] font-bold uppercase tracking-[.09em] text-[#8a97ad]"
                    >
                      {h}
                    </span>
                  )
                )}
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-[12px] text-muted">
                  <RefreshCw size={18} className="mx-auto mb-2 animate-spin text-cobalt" />
                  Loading test logs…
                </div>
              ) : filteredLogs.length > 0 ? (
                filteredLogs.map((log) => {
                  const isPassed = log.status === 'passed';
                  const site = log.siteId || {};
                  const isExpanded = expandedId === log._id;
                  const formsCount = log.formResults?.length || 1;
                  const formLabel =
                    log.formResults && log.formResults.length === 1
                      ? log.formResults[0].formName
                      : log.formResults && log.formResults.length > 1
                      ? `${formsCount} forms verified`
                      : site.name || 'Form test';

                  const timeDisplay = log.executedAt
                    ? new Date(log.executedAt).toLocaleString([], {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })
                    : 'N/A';

                  return (
                    <div key={log._id} className="border-b border-line/70 last:border-0">
                      <button
                        onClick={() => setExpandedId(isExpanded ? null : log._id)}
                        className="grid w-full grid-cols-[110px_1.4fr_1.2fr_100px_90px_140px_24px] items-center gap-3 px-5 py-3.5 text-left transition hover:bg-[#fafbfe]"
                      >
                        <StatusPill tone={isPassed ? 'green' : 'red'}>
                          {isPassed ? <CircleCheck size={11} /> : <CircleAlert size={11} />}
                          {isPassed ? 'Passed' : 'Failed'}
                        </StatusPill>
                        <div className="min-w-0">
                          <p className="truncate text-[12px] font-semibold text-ink">
                            {site.name || 'Unknown Site'}
                          </p>
                          <p className="truncate text-[10.5px] text-muted">{formLabel}</p>
                        </div>
                        <span className="truncate text-[11.5px] text-[#6b7b95]">
                          {site.url?.replace(/^https?:\/\//, '') || '—'}
                        </span>
                        <span className="text-[11.5px] text-[#6b7b95]">
                          {log.triggeredBy || 'Scheduled'}
                        </span>
                        <span className="font-mono text-[11.5px] text-[#6b7b95]">
                          {log.durationMs ? `${log.durationMs}ms` : '—'}
                        </span>
                        <span className="text-[11.5px] text-[#6b7b95]">{timeDisplay}</span>
                        <ChevronRight
                          size={14}
                          className={`text-[#b3bdcd] transition-transform duration-200 ${
                            isExpanded ? 'rotate-90 text-cobalt' : ''
                          }`}
                        />
                      </button>

                      {/* Expanded Preview Drawer */}
                      {isExpanded && (
                        <div className="animate-rise border-t border-line/50 bg-[#f8faff] px-5 py-4 text-[11.5px]">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <span className="font-semibold text-cobalt">Run summary: </span>
                              <span className="text-[#556784]">
                                {log.errorMessage ? (
                                  <strong className="text-[#c93448] font-normal">{log.errorMessage}</strong>
                                ) : (
                                  'Playwright successfully filled inputs, submitted form, and detected success indicator.'
                                )}
                              </span>
                            </div>
                            <button
                              className="btn btn-secondary btn-sm shrink-0"
                              onClick={() => setActiveModalLog(log)}
                            >
                              View full report & screenshot →
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="px-5 py-12 text-center text-[12.5px] text-muted">
                  No test runs match your filters.
                </div>
              )}
            </div>
          </div>

          {/* Table Footer */}
          <div className="flex items-center justify-between border-t border-line px-5 py-3.5 text-[11.5px] text-muted">
            <span>
              Showing {filteredLogs.length} of {logs.length} runs
            </span>
            <span className="flex items-center gap-1.5">
              <Clock size={12} /> Live telemetry recorded to MongoDB Atlas
            </span>
          </div>
        </div>
      </div>

      {/* Log Detail Modal */}
      {activeModalLog && (
        <LogDetailModal log={activeModalLog} onClose={() => setActiveModalLog(null)} />
      )}

      {/* Toast */}
      <Toast notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}

export default function LogsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted">Loading logs...</div>}>
      <LogsContent />
    </Suspense>
  );
}
