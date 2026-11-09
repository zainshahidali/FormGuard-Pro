'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  Globe,
  Layers,
  Activity,
  ShieldCheck,
  CalendarClock,
  Database,
  ArrowRight,
  ArrowUpRight,
  Play,
  Plus,
  Sparkles,
  ChevronRight,
  CircleCheck,
  CircleAlert,
  Search,
  ExternalLink,
  Edit2,
  Trash2,
  LoaderCircle,
  RefreshCw,
} from 'lucide-react';
import { StatusPill, Toast, type Notice } from '@/components/ui';
import LogDetailModal from '@/components/LogDetailModal';

export default function DashboardPage() {
  const [sites, setSites] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [testingSiteId, setTestingSiteId] = useState<string | null>(null);
  const [activeModalLog, setActiveModalLog] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [siteFilter, setSiteFilter] = useState<'all' | 'healthy' | 'failing'>('all');
  const [notice, setNotice] = useState<Notice | null>(null);

  const notify = (message: string, tone: 'success' | 'info' | 'error' = 'success') => {
    setNotice({ id: Date.now(), message, tone });
  };

  const fetchData = useCallback(async () => {
    try {
      const [sitesRes, logsRes] = await Promise.all([
        fetch('/api/sites'),
        fetch('/api/logs?limit=50'),
      ]);

      const sitesData = await sitesRes.json();
      const logsData = await logsRes.json();

      if (sitesData.success) {
        setSites(sitesData.sites || []);
      }
      if (logsData.success) {
        setLogs(logsData.logs || []);
      }
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();

    const handleRefetch = () => fetchData();
    window.addEventListener('formguard:refetch', handleRefetch);
    return () => window.removeEventListener('formguard:refetch', handleRefetch);
  }, [fetchData]);

  // Run single site test
  const handleTestSite = async (siteId: string, siteName: string) => {
    setTestingSiteId(siteId);
    notify(`Testing all forms for "${siteName}"…`, 'info');

    try {
      const res = await fetch('/api/test/run-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Form test execution failed.');
      }

      if (data.result.status === 'passed') {
        notify(`✅ ${siteName}: All forms passed in ${data.result.durationMs}ms!`, 'success');
      } else {
        notify(`🚨 ${siteName}: Test failed — ${data.result.errorMessage}`, 'error');
      }

      // Re-fetch updated site status and logs
      fetchData();
    } catch (err: any) {
      notify(err.message || 'Failed to trigger form test.', 'error');
    } finally {
      setTestingSiteId(null);
    }
  };

  // Delete site
  const handleDeleteSite = async (siteId: string, siteName: string) => {
    if (!confirm(`Are you sure you want to stop monitoring "${siteName}" and remove it?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/sites/${siteId}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete site.');
      }
      notify(`Website "${siteName}" removed from monitoring.`, 'info');
      setSites((prev) => prev.filter((s) => s._id !== siteId));
    } catch (err: any) {
      notify(err.message || 'Error deleting site.', 'error');
    }
  };

  const triggerRunAll = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('formguard:open-run-all'));
    }
  };

  // Metrics computation
  const totalSites = sites.length;
  const totalForms = sites.reduce((sum, s) => sum + (s.forms?.length || 1), 0);
  const healthySites = sites.filter((s) => s.lastStatus === 'healthy').length;
  const failingSites = sites.filter((s) => s.lastStatus === 'failing').length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const testsTodayCount = logs.filter((l) => new Date(l.executedAt) >= todayStart).length;

  const passedLogsCount = logs.filter((l) => l.status === 'passed').length;
  const failedLogsCount = logs.filter((l) => l.status === 'failed').length;
  const successRate =
    logs.length > 0 ? ((passedLogsCount / logs.length) * 100).toFixed(1) : '100.0';

  // 7-day chart computation
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const chartDays = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);

      const nextD = new Date(d);
      nextD.setDate(nextD.getDate() + 1);

      const dayLogs = logs.filter((l) => {
        const time = new Date(l.executedAt).getTime();
        return time >= d.getTime() && time < nextD.getTime();
      });

      const dayPassed = dayLogs.filter((l) => l.status === 'passed').length;
      const rate = dayLogs.length > 0 ? Math.round((dayPassed / dayLogs.length) * 100) : 100;

      days.push({
        label: dayNames[d.getDay()],
        rate,
        total: dayLogs.length,
      });
    }
    return days;
  }, [logs]);

  // Filtered sites
  const filteredSites = sites.filter((site) => {
    const matchesSearch =
      site.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      site.url?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      siteFilter === 'all'
        ? true
        : siteFilter === 'healthy'
        ? site.lastStatus === 'healthy'
        : site.lastStatus === 'failing';

    return matchesSearch && matchesFilter;
  });

  return (
    <div className="canvas-glow min-h-full">
      <div className="mx-auto w-full max-w-[1130px] px-4 py-7 sm:px-7 lg:px-9">
        {/* Page Heading */}
        <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="mb-2 font-display text-[10px] font-extrabold tracking-[.17em] text-cobalt">
              WORKSPACE OVERVIEW
            </p>
            <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-.035em] text-ink sm:text-[32px]">
              Monitor health
            </h1>
            <p className="mt-1.5 text-[13px] text-muted">
              Your forms are being tested automatically with headless Playwright. Here’s what happened in the last 24 hours.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className="btn btn-secondary btn-lg" onClick={triggerRunAll}>
              <Play size={14} className="fill-current text-cobalt" /> Run all tests
            </button>
            <Link href="/sites/new" className="btn btn-primary btn-lg">
              <Plus size={15} strokeWidth={2.5} /> Add website
            </Link>
          </div>
        </div>

        {/* 4 Stat Cards */}
        <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="panel animate-rise p-4.5">
            <div className="flex items-start justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#eef1ff] text-cobalt">
                <Globe size={17} />
              </span>
              <ArrowUpRight size={15} className="text-[#b5c0d2]" />
            </div>
            <p className="mt-4 font-display text-[27px] font-extrabold leading-none tracking-tight text-ink">
              {totalSites}
            </p>
            <p className="mt-1.5 text-[12px] font-semibold text-[#4d5c76]">Websites monitored</p>
            <p className="mt-2 text-[11px] text-[#91a0b5]">
              {healthySites} healthy · {failingSites} failing
            </p>
          </div>

          <div className="panel animate-rise p-4.5" style={{ animationDelay: '60ms' }}>
            <div className="flex items-start justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#f0ecff] text-[#7655d8]">
                <Layers size={17} />
              </span>
              <ArrowUpRight size={15} className="text-[#b5c0d2]" />
            </div>
            <p className="mt-4 font-display text-[27px] font-extrabold leading-none tracking-tight text-ink">
              {totalForms}
            </p>
            <p className="mt-1.5 text-[12px] font-semibold text-[#4d5c76]">Forms tracked</p>
            <p className="mt-2 text-[11px] text-[#91a0b5]">Across {totalSites} WordPress sites</p>
          </div>

          <div className="panel animate-rise p-4.5" style={{ animationDelay: '120ms' }}>
            <div className="flex items-start justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#fff2e3] text-[#d8892c]">
                <Activity size={17} />
              </span>
              <ArrowUpRight size={15} className="text-[#b5c0d2]" />
            </div>
            <p className="mt-4 font-display text-[27px] font-extrabold leading-none tracking-tight text-ink">
              {testsTodayCount}
            </p>
            <p className="mt-1.5 text-[12px] font-semibold text-[#4d5c76]">Tests run today</p>
            <p className="mt-2 text-[11px] text-[#91a0b5]">04:00 UTC schedule</p>
          </div>

          <div className="panel animate-rise p-4.5" style={{ animationDelay: '180ms' }}>
            <div className="flex items-start justify-between">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e7f8f2] text-mint">
                <ShieldCheck size={17} />
              </span>
              <ArrowUpRight size={15} className="text-[#b5c0d2]" />
            </div>
            <p className="mt-4 font-display text-[27px] font-extrabold leading-none tracking-tight text-ink">
              {successRate}%
            </p>
            <p className="mt-1.5 text-[12px] font-semibold text-[#4d5c76]">Success rate</p>
            <p className="mt-2 text-[11px] text-[#91a0b5]">
              {passedLogsCount} / {logs.length || 0} total tests
            </p>
          </div>
        </div>

        {/* 2-Column Hero: Chart + Next automated run */}
        <div className="mt-5 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
          <div className="panel animate-rise p-5 sm:p-6">
            <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="font-display text-[15px] font-bold text-ink">Submission success rate</h2>
                <p className="mt-1 text-[11.5px] text-muted">
                  Automated checks across all websites · last 7 days
                </p>
              </div>
              <StatusPill tone="green">
                <Sparkles size={11} /> {successRate}% average
              </StatusPill>
            </div>

            {/* 7-Day Bar Chart */}
            <div className="flex h-[170px] items-end gap-3 border-b border-line pb-1 sm:gap-5">
              {chartDays.map((cd, i) => (
                <div key={i} className="group flex h-full flex-1 flex-col items-center justify-end gap-2">
                  <span className="text-[10px] font-semibold text-[#8a97ad] opacity-0 transition group-hover:opacity-100">
                    {cd.rate}%
                  </span>
                  <div
                    className={`w-full max-w-[42px] rounded-t-lg transition-all ${
                      i === chartDays.length - 1
                        ? 'bg-cobalt'
                        : 'bg-[#d9e2fb] group-hover:bg-[#aebbfa]'
                    }`}
                    style={{ height: `${Math.max(12, cd.rate)}%` }}
                  />
                  <span className="text-[10.5px] font-semibold text-[#9aa6b9]">{cd.label}</span>
                </div>
              ))}
            </div>

            <div className="mt-5 grid grid-cols-3 divide-x divide-line">
              <div className="px-2 text-center first:pl-0 last:pr-0">
                <p className="font-display text-[17px] font-extrabold text-ink">{logs.length}</p>
                <p className="mt-0.5 text-[10.5px] text-muted">Total submissions</p>
              </div>
              <div className="px-2 text-center first:pl-0 last:pr-0">
                <p className="font-display text-[17px] font-extrabold text-mint">{passedLogsCount}</p>
                <p className="mt-0.5 text-[10.5px] text-muted">Successful</p>
              </div>
              <div className="px-2 text-center first:pl-0 last:pr-0">
                <p className="font-display text-[17px] font-extrabold text-[#d23f53]">
                  {failedLogsCount}
                </p>
                <p className="mt-0.5 text-[10.5px] text-muted">Failures</p>
              </div>
            </div>
          </div>

          {/* Dark Ink Schedule Card */}
          <div className="sidebar-grain relative flex flex-col justify-between overflow-hidden rounded-[20px] bg-ink p-6 text-white shadow-[0_16px_40px_rgba(16,28,46,.18)]">
            <div className="relative">
              <div className="mb-5 flex items-center justify-between">
                <span className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-[#8fa6ff]">
                  <CalendarClock size={19} />
                </span>
                <span className="pill bg-white/10 text-[#a7e9d8]">
                  <span className="dot-live" /> Engine online
                </span>
              </div>
              <p className="text-[11px] font-bold uppercase tracking-[.14em] text-[#8ba0c3]">
                Next automated run
              </p>
              <p className="mt-2 font-display text-[30px] font-extrabold leading-none tracking-tight">
                04:00 <span className="text-[16px] font-semibold text-[#9fb0cc]">UTC</span>
              </p>
              <p className="mt-2 text-[12px] text-[#a4b5d1]">
                Daily · 09:00 AM PKT · {totalForms} forms queued
              </p>
            </div>
            <div className="relative mt-8 space-y-3">
              <div className="flex items-center justify-between rounded-xl bg-white/[.07] px-3.5 py-2.5 text-[11.5px]">
                <span className="flex items-center gap-2 text-[#b7c6de]">
                  <Database size={13} /> Database
                </span>
                <span className="font-semibold text-[#64dfba]">Connected</span>
              </div>
              <button
                onClick={triggerRunAll}
                className="btn btn-lg w-full !border-white/15 !bg-white !text-ink hover:!bg-[#eef2ff]"
              >
                <Play size={14} className="fill-current text-cobalt" /> Run tests now{' '}
                <ArrowRight size={14} />
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Split: Sites in Rotation + Recent Activity */}
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          {/* Sites in Rotation */}
          <div className="panel animate-rise overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
              <div>
                <h2 className="font-display text-[14px] font-bold text-ink">Sites in rotation</h2>
                <p className="text-[11px] text-muted">Active client websites scheduled for daily checks</p>
              </div>
              <Link href="/sites/new" className="text-[11.5px] font-semibold text-cobalt hover:underline">
                + Add site
              </Link>
            </div>

            {/* Filter & Search Bar */}
            <div className="flex items-center gap-2 border-b border-line bg-[#fafbfe] px-4 py-2.5">
              <div className="relative flex-1">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa6b9]"
                />
                <input
                  className="field !h-8 !pl-8 text-[11.5px]"
                  placeholder="Filter websites…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-1">
                {(['all', 'healthy', 'failing'] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setSiteFilter(mode)}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-semibold capitalize transition ${
                      siteFilter === mode ? 'bg-white text-ink shadow-sm' : 'text-[#8491a7] hover:text-ink'
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>
            </div>

            <div className="soft-scroll max-h-[360px] overflow-y-auto divide-y divide-line/70">
              {filteredSites.map((site) => {
                const isTesting = testingSiteId === site._id;
                const formCount = site.forms?.length || 1;
                const isHealthy = site.lastStatus === 'healthy';
                const isFailing = site.lastStatus === 'failing';
                const tone = isHealthy ? 'green' : isFailing ? 'red' : 'gray';
                const statusLabel = isHealthy ? 'All passing' : isFailing ? 'Failing' : 'Pending';

                return (
                  <div
                    key={site._id}
                    className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-[#fafbfe]"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-[#f0f3f9] text-[#71809a]">
                        <Globe size={16} />
                      </span>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="truncate text-[12.5px] font-bold text-ink">{site.name}</p>
                          <StatusPill tone={tone}>{statusLabel}</StatusPill>
                        </div>
                        <p className="truncate text-[11px] text-muted">
                          {site.url.replace(/^https?:\/\//, '')} · {formCount} {formCount === 1 ? 'form' : 'forms'}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handleTestSite(site._id, site.name)}
                        disabled={isTesting}
                        className="btn btn-secondary btn-sm !h-8 px-2.5 text-[11px]"
                        title="Test all forms on this site now"
                      >
                        {isTesting ? (
                          <LoaderCircle size={12} className="animate-spin text-cobalt" />
                        ) : (
                          <Play size={11} className="text-cobalt fill-current" />
                        )}
                        <span className="hidden sm:inline">Test</span>
                      </button>
                      <Link
                        href={`/sites/${site._id}`}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-line text-[#6b7b95] hover:border-cobalt hover:text-cobalt transition"
                        title="Edit website configuration"
                      >
                        <Edit2 size={12} />
                      </Link>
                      <button
                        onClick={() => handleDeleteSite(site._id, site.name)}
                        className="grid h-8 w-8 place-items-center rounded-lg border border-line text-[#b3bdcd] hover:border-[#ffccd2] hover:bg-[#ffeded] hover:text-[#d64c59] transition"
                        title="Delete site"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                );
              })}

              {!filteredSites.length && (
                <div className="p-8 text-center text-[12px] text-muted">
                  {sites.length === 0
                    ? 'No websites monitored yet. Click "+ Add site" to start.'
                    : 'No websites match your filter.'}
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="panel animate-rise overflow-hidden">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="font-display text-[14px] font-bold text-ink">Recent activity</h2>
                <p className="text-[11px] text-muted">Automated & manual test submissions</p>
              </div>
              <Link href="/logs" className="text-[11.5px] font-semibold text-cobalt hover:underline">
                View logs →
              </Link>
            </div>

            <div className="soft-scroll max-h-[410px] overflow-y-auto divide-y divide-line/70">
              {logs.slice(0, 7).map((log) => {
                const passed = log.status === 'passed';
                const site = log.siteId || {};
                const timeAgo = log.executedAt ? new Date(log.executedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Just now';

                return (
                  <button
                    key={log._id}
                    onClick={() => setActiveModalLog(log)}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-[#fafbfe]"
                  >
                    <span
                      className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                        passed ? 'bg-[#e7f8f2] text-mint' : 'bg-[#ffeded] text-[#dc5262]'
                      }`}
                    >
                      {passed ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-bold text-ink">
                        {site.name || 'Automated Form Check'}
                      </p>
                      <p className="truncate text-[11px] text-muted">
                        {log.formResults?.length ? `${log.formResults.length} forms verified` : site.url || 'Single form run'}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <StatusPill tone={passed ? 'green' : 'red'}>
                        {passed ? 'Passed' : 'Failed'}
                      </StatusPill>
                      <p className="mt-1 text-[10.5px] text-[#9aa6b9]">{timeAgo}</p>
                    </div>
                    <ChevronRight size={14} className="text-[#b3bdcd]" />
                  </button>
                );
              })}

              {!logs.length && (
                <div className="p-8 text-center text-[12px] text-muted">
                  No tests recorded yet. Run a test to see results here.
                </div>
              )}
            </div>
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
