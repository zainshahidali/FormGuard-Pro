'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Globe,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Play,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  History,
  ExternalLink,
  Mail,
  MessageSquare,
  ShieldCheck,
  ShieldAlert,
  Search,
  Filter,
} from 'lucide-react';
import LogDetailModal from '@/components/LogDetailModal';

export default function DashboardPage() {
  const [sites, setSites] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [testingSiteId, setTestingSiteId] = useState<string | null>(null);
  const [activeModalLog, setActiveModalLog] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error';
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 5000);
  };

  const fetchData = useCallback(async () => {
    try {
      const [sitesRes, logsRes] = await Promise.all([
        fetch('/api/sites'),
        fetch('/api/logs?limit=10'),
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

    const handleRefetch = () => {
      fetchData();
    };

    window.addEventListener('formguard:refetch', handleRefetch);
    return () => {
      window.removeEventListener('formguard:refetch', handleRefetch);
    };
  }, [fetchData]);

  // Single Site Run Test
  const handleTestSite = async (siteId: string, siteName: string) => {
    setTestingSiteId(siteId);
    try {
      const res = await fetch('/api/test/run-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Form test failed to execute.');
      }

      if (data.result.status === 'passed') {
        showToast(`✅ ${siteName}: Form test PASSED in ${data.result.durationMs}ms!`, 'success');
      } else {
        showToast(`🚨 ${siteName}: Form test FAILED — ${data.result.errorMessage}`, 'error');
      }

      // Update site locally
      setSites((prev) =>
        prev.map((s) =>
          s._id === siteId
            ? {
                ...s,
                lastStatus: data.result.status === 'passed' ? 'healthy' : 'failing',
                lastCheckedAt: new Date().toISOString(),
              }
            : s
        )
      );

      // Refresh logs
      fetchData();
    } catch (err: any) {
      showToast(err.message || 'Failed to trigger form test.', 'error');
    } finally {
      setTestingSiteId(null);
    }
  };

  // Delete Site
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
      showToast(`Site "${siteName}" removed successfully.`);
      setSites((prev) => prev.filter((s) => s._id !== siteId));
    } catch (err: any) {
      showToast(err.message || 'Error deleting site.', 'error');
    }
  };

  // Calculate KPIs
  const totalSites = sites.length;
  const healthySites = sites.filter((s) => s.lastStatus === 'healthy').length;
  const failingSites = sites.filter((s) => s.lastStatus === 'failing').length;
  const pendingSites = sites.filter((s) => s.lastStatus === 'pending' || !s.lastStatus).length;

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const testsTodayCount = logs.filter(
    (l) => new Date(l.executedAt) >= todayStart
  ).length;

  // Filtered Sites
  const filteredSites = sites.filter((site) => {
    const matchesSearch =
      site.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      site.url.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (site.formPluginType && site.formPluginType.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'healthy'
        ? site.lastStatus === 'healthy'
        : statusFilter === 'failing'
        ? site.lastStatus === 'failing'
        : site.lastStatus === 'pending' || !site.lastStatus;

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-8">
      {/* Toast Notification */}
      {toastMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 p-4 rounded-xl shadow-2xl border flex items-center gap-3 text-sm animate-in fade-in slide-in-from-bottom-5 duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-700 text-emerald-100'
              : 'bg-red-950/90 border-red-700 text-red-100'
          }`}
        >
          {toastMessage.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
          )}
          <span>{toastMessage.text}</span>
        </div>
      )}

      {/* Page Title & Quick Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">WordPress Form Health Monitor</h1>
          <p className="text-xs text-slate-400 mt-1">
            Real-time daily verification of client contact forms with automated alerts & failure screenshot logs.
          </p>
        </div>

        <Link
          href="/sites/new"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold text-navy-900 bg-gradient-to-r from-sky-accent to-teal-light hover:brightness-110 transition-all shadow-md shadow-sky-accent/20 w-fit"
        >
          <Plus className="w-4 h-4 stroke-[3]" /> Add New Website
        </Link>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Monitored */}
        <div className="bg-surface border border-surface-border rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-400">Total Monitored Sites</span>
            <div className="p-2 rounded-lg bg-sky-accent/10 border border-sky-accent/20 text-sky-accent">
              <Globe className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mt-3">{totalSites}</div>
          <p className="text-[11px] text-slate-400 mt-1">Active client web forms</p>
        </div>

        {/* Healthy Forms */}
        <div className="bg-surface border border-surface-border rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-emerald-400">Healthy Forms</span>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
              <ShieldCheck className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-emerald-400 mt-3">{healthySites}</div>
          <p className="text-[11px] text-slate-400 mt-1">Submissions verified</p>
        </div>

        {/* Failing Forms */}
        <div className="bg-surface border border-surface-border rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-red-400">Failing Forms</span>
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400">
              <ShieldAlert className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-red-400 mt-3">{failingSites}</div>
          <p className="text-[11px] text-slate-400 mt-1">Requires immediate attention</p>
        </div>

        {/* Tests Run Today */}
        <div className="bg-surface border border-surface-border rounded-xl p-5 relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-teal-light">Tests Run Today</span>
            <div className="p-2 rounded-lg bg-teal-accent/15 border border-teal-accent/30 text-teal-light">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="text-3xl font-bold text-white mt-3">{testsTodayCount}</div>
          <p className="text-[11px] text-slate-400 mt-1">
            {pendingSites > 0 ? `${pendingSites} pending tests` : 'All sites up to date'}
          </p>
        </div>
      </div>

      {/* Monitored Sites Table Section */}
      <div className="bg-surface border border-surface-border rounded-xl overflow-hidden shadow-lg">
        {/* Table Toolbar */}
        <div className="p-5 border-b border-surface-border flex flex-col sm:flex-row items-center justify-between gap-4 bg-navy-800">
          <div className="flex items-center gap-2">
            <h2 className="text-base font-semibold text-white">Monitored Client Sites</h2>
            <span className="text-xs text-slate-400 font-medium px-2 py-0.5 rounded-full bg-navy-900 border border-surface-border">
              {filteredSites.length}
            </span>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            {/* Search Input */}
            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search site, URL, or plugin..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-navy-900 border border-surface-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent"
              />
            </div>

            {/* Filter Dropdown */}
            <div className="relative">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-navy-900 border border-surface-border rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-accent cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="healthy">Healthy Only</option>
                <option value="failing">Failing Only</option>
                <option value="pending">Pending Only</option>
              </select>
            </div>
          </div>
        </div>

        {/* Sites Table */}
        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="py-16 text-center">
              <Loader2 className="w-8 h-8 text-sky-accent animate-spin mx-auto" />
              <p className="text-xs text-slate-400 mt-2">Loading monitored websites...</p>
            </div>
          ) : filteredSites.length === 0 ? (
            <div className="py-16 text-center space-y-4">
              <div className="w-12 h-12 rounded-full bg-navy-800 border border-surface-border flex items-center justify-center text-slate-400 mx-auto">
                <Globe className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-200">No Monitored Sites Found</h3>
                <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                  {searchTerm || statusFilter !== 'all'
                    ? 'No sites match your filter criteria. Try resetting search.'
                    : 'Get started by adding your first client WordPress website contact form.'}
                </p>
              </div>
              <Link
                href="/sites/new"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold text-navy-900 bg-sky-accent hover:brightness-110 transition-all"
              >
                <Plus className="w-4 h-4 stroke-[3]" /> Add First Site
              </Link>
            </div>
          ) : (
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-surface-border bg-navy-900/50 text-slate-400 font-semibold uppercase tracking-wider">
                  <th className="py-3 px-5">Site & Plugin</th>
                  <th className="py-3 px-5">Status</th>
                  <th className="py-3 px-5">Last Checked</th>
                  <th className="py-3 px-5">Alert Routing</th>
                  <th className="py-3 px-5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-surface-border/60">
                {filteredSites.map((site) => {
                  const isTestingThis = testingSiteId === site._id;
                  const prefs = site.notificationPreferences || {};

                  return (
                    <tr
                      key={site._id}
                      className="hover:bg-navy-800/60 transition-colors group"
                    >
                      {/* Name & URL */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-slate-100 text-sm">
                            {site.name}
                          </span>
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-surface border border-surface-border text-slate-300">
                            {site.formPluginType || 'Elementor'}
                          </span>
                        </div>
                        <a
                          href={site.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-sky-accent hover:underline flex items-center gap-1 mt-1 truncate max-w-xs sm:max-w-md"
                        >
                          {site.url} <ExternalLink className="w-3 h-3 shrink-0" />
                        </a>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-5">
                        {site.lastStatus === 'healthy' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                            Healthy
                          </span>
                        ) : site.lastStatus === 'failing' ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/15 text-red-400 border border-red-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse"></span>
                            Failing
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/15 text-amber-300 border border-amber-500/30">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                            Pending
                          </span>
                        )}
                      </td>

                      {/* Last Checked */}
                      <td className="py-4 px-5 text-slate-300">
                        {site.lastCheckedAt ? (
                          <div className="flex flex-col">
                            <span className="font-medium text-slate-200">
                              {new Date(site.lastCheckedAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(site.lastCheckedAt).toLocaleDateString()}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-500 italic">Never tested</span>
                        )}
                      </td>

                      {/* Notification Routing Icons */}
                      <td className="py-4 px-5">
                        <div className="flex items-center gap-2">
                          {prefs.enableEmail !== false ? (
                            <div
                              title={
                                prefs.useGlobalDefaults
                                  ? 'Email alerts: Global Defaults'
                                  : `Email alerts: Custom (${prefs.customEmails?.length || 0} recipients)`
                              }
                              className="p-1.5 rounded bg-sky-accent/10 text-sky-accent border border-sky-accent/20 cursor-help"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div
                              title="Email alerts disabled"
                              className="p-1.5 rounded bg-slate-800 text-slate-500 border border-slate-700 cursor-help opacity-40"
                            >
                              <Mail className="w-3.5 h-3.5" />
                            </div>
                          )}

                          {prefs.enableSlack !== false ? (
                            <div
                              title={
                                prefs.useGlobalDefaults
                                  ? 'Slack alerts: Global Webhook'
                                  : 'Slack alerts: Site Custom Webhook'
                              }
                              className="p-1.5 rounded bg-amber-500/10 text-amber-400 border border-amber-500/20 cursor-help"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </div>
                          ) : (
                            <div
                              title="Slack alerts disabled"
                              className="p-1.5 rounded bg-slate-800 text-slate-500 border border-slate-700 cursor-help opacity-40"
                            >
                              <MessageSquare className="w-3.5 h-3.5" />
                            </div>
                          )}

                          {prefs.useGlobalDefaults ? (
                            <span className="text-[10px] text-slate-400">Global</span>
                          ) : (
                            <span className="text-[10px] text-sky-accent font-medium">Custom</span>
                          )}
                        </div>
                      </td>

                      {/* Action Buttons */}
                      <td className="py-4 px-5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Test Now Button */}
                          <button
                            onClick={() => handleTestSite(site._id, site.name)}
                            disabled={isTestingThis}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-slate-200 bg-surface hover:bg-surface-hover border border-surface-border transition-colors disabled:opacity-50"
                            title="Run Playwright test immediately"
                          >
                            {isTestingThis ? (
                              <>
                                <Loader2 className="w-3 h-3 animate-spin text-sky-accent" />
                                <span>Testing...</span>
                              </>
                            ) : (
                              <>
                                <Play className="w-3 h-3 text-sky-accent fill-current" />
                                <span>Test Now</span>
                              </>
                            )}
                          </button>

                          {/* Logs Link */}
                          <Link
                            href={`/logs?siteId=${site._id}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface border border-transparent hover:border-surface-border transition-colors"
                            title="View Execution History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </Link>

                          {/* Edit Link */}
                          <Link
                            href={`/sites/${site._id}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface border border-transparent hover:border-surface-border transition-colors"
                            title="Edit Configuration"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </Link>

                          {/* Delete Button */}
                          <button
                            onClick={() => handleDeleteSite(site._id, site.name)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-surface border border-transparent hover:border-surface-border transition-colors"
                            title="Delete Site"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Log Detail Modal */}
      {activeModalLog && (
        <LogDetailModal
          log={activeModalLog}
          onClose={() => setActiveModalLog(null)}
        />
      )}
    </div>
  );
}

