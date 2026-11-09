'use client';

import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  FileText,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  Image as ImageIcon,
  Loader2,
  ExternalLink,
  Mail,
  MessageSquare,
  AlertOctagon,
  ArrowRight,
  Download,
} from 'lucide-react';
import LogDetailModal from '@/components/LogDetailModal';

export const dynamic = 'force-dynamic';

function LogsContent() {
  const searchParams = useSearchParams();
  const initialSiteId = searchParams.get('siteId') || 'all';

  const [logs, setLogs] = useState<any[]>([]);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState<string>(initialSiteId);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [activeLog, setActiveLog] = useState<any | null>(null);

  const fetchLogs = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams();
      if (selectedSiteId && selectedSiteId !== 'all') {
        query.set('siteId', selectedSiteId);
      }
      if (selectedStatus && selectedStatus !== 'all') {
        query.set('status', selectedStatus);
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
  }, [selectedSiteId, selectedStatus]);

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

  useEffect(() => {
    fetchSites();
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2.5">
            <FileText className="w-6 h-6 text-sky-accent" /> Test Execution Logs & Failure Screenshots
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Historical Playwright verification runs, captured console exceptions, and visual failure screenshots.
          </p>
        </div>

        {/* Filter Controls */}
        <div className="flex items-center gap-3">
          {/* Site Filter */}
          <select
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            className="bg-navy-800 border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-accent cursor-pointer"
          >
            <option value="all">All Monitored Sites</option>
            {sites.map((site) => (
              <option key={site._id} value={site._id}>
                {site.name}
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="bg-navy-800 border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-sky-accent cursor-pointer"
          >
            <option value="all">All Statuses</option>
            <option value="failed">Failed Only (🚨)</option>
            <option value="passed">Passed Only (✅)</option>
          </select>

          {/* Export CSV Button */}
          <a
            href={`/api/logs/export?siteId=${selectedSiteId}&status=${selectedStatus}`}
            download
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold text-slate-200 bg-surface hover:bg-surface-hover border border-surface-border transition-colors shadow-sm"
            title="Download logs report as CSV"
          >
            <Download className="w-3.5 h-3.5 text-sky-accent" />
            <span className="hidden sm:inline">Export CSV</span>
          </a>
        </div>
      </div>

      {/* Logs Table Container */}
      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-lg">
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-20 text-center">
              <Loader2 className="w-8 h-8 text-sky-accent animate-spin mx-auto" />
              <p className="text-xs text-slate-400 mt-2">Loading test run history...</p>
            </div>
          ) : logs.length === 0 ? (
            <div className="py-20 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-navy-800 border border-surface-border flex items-center justify-center text-slate-400 mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-semibold text-slate-200">No Test Logs Found</h3>
              <p className="text-xs text-slate-400 max-w-sm mx-auto">
                No execution logs match the selected filter criteria. Run a manual test or wait for the daily cron schedule.
              </p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-navy-800 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-5">Site & Form</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Duration</th>
                  <th className="py-3 px-5">Error / Details</th>
                  <th className="py-3 px-5">Screenshot</th>
                  <th className="py-3 px-5">Alerts</th>
                  <th className="py-3 px-5">Timestamp</th>
                  <th className="py-3 px-5 text-right">Inspect</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {logs.map((log) => {
                  const isPassed = log.status === 'passed';
                  const site = log.siteId || {};

                  return (
                    <tr
                      key={log._id}
                      onClick={() => setActiveLog(log)}
                      className="hover:bg-navy-800/60 transition-colors cursor-pointer group"
                    >
                      {/* Site Name & Plugin */}
                      <td className="py-4 px-5">
                        <div className="font-semibold text-slate-100 text-sm">
                          {site.name || 'Unknown Site'}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span>{site.formPluginType || 'Form'}</span>
                          {site.url && (
                            <span className="text-slate-500 truncate max-w-[200px]">
                              • {site.url}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-4 px-5">
                        {isPassed ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Passed
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                            <XCircle className="w-3.5 h-3.5" />
                            Failed
                          </span>
                        )}
                      </td>

                      {/* Duration */}
                      <td className="py-4 px-5 font-mono text-slate-300">
                        {log.durationMs ? `${log.durationMs}ms` : '—'}
                      </td>

                      {/* Error Preview */}
                      <td className="py-4 px-5 max-w-xs">
                        {!isPassed && log.errorMessage ? (
                          <div className="truncate text-red-300 font-mono text-[11px] bg-red-950/40 px-2 py-1 rounded border border-red-900/50">
                            {log.errorMessage}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Submission confirmed</span>
                        )}
                      </td>

                      {/* Screenshot Thumbnail */}
                      <td className="py-4 px-5">
                        {log.screenshotBase64 ? (
                          <div className="flex items-center gap-1.5 text-sky-accent group-hover:underline">
                            <ImageIcon className="w-3.5 h-3.5" />
                            <span className="text-[11px] font-medium">Captured</span>
                          </div>
                        ) : (
                          <span className="text-slate-500 text-[11px]">—</span>
                        )}
                      </td>

                      {/* Alerts Sent */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <span
                            title={log.notificationsSent?.email ? 'Email alert sent' : 'No email sent'}
                            className={`p-1 rounded ${
                              log.notificationsSent?.email
                                ? 'bg-sky-accent/20 text-sky-accent'
                                : 'text-slate-600'
                            }`}
                          >
                            <Mail className="w-3.5 h-3.5" />
                          </span>
                          <span
                            title={log.notificationsSent?.slack ? 'Slack alert sent' : 'No Slack sent'}
                            className={`p-1 rounded ${
                              log.notificationsSent?.slack
                                ? 'bg-amber-500/20 text-amber-400'
                                : 'text-slate-600'
                            }`}
                          >
                            <MessageSquare className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </td>

                      {/* Timestamp */}
                      <td className="py-4 px-5 text-slate-400">
                        <div className="flex flex-col">
                          <span className="text-slate-200">
                            {new Date(log.executedAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </span>
                          <span className="text-[10px] text-slate-500">
                            {new Date(log.executedAt).toLocaleDateString()}
                          </span>
                        </div>
                      </td>

                      {/* Action */}
                      <td className="py-4 px-5 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveLog(log);
                          }}
                          className="px-2.5 py-1 rounded bg-navy-800 hover:bg-surface-hover border border-surface-border text-slate-300 hover:text-white transition-colors text-[11px] font-medium"
                        >
                          View Details
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Log Modal */}
      {activeLog && (
        <LogDetailModal log={activeLog} onClose={() => setActiveLog(null)} />
      )}
    </div>
  );
}

export default function LogsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-20 text-center">
          <Loader2 className="w-8 h-8 text-sky-accent animate-spin mx-auto" />
          <p className="text-xs text-slate-400 mt-2">Loading logs...</p>
        </div>
      }
    >
      <LogsContent />
    </Suspense>
  );
}


