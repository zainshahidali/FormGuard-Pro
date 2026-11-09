'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowRight,
  Bell,
  Check,
  ChevronLeft,
  Clock,
  Globe,
  Layers,
  Lightbulb,
  Link2,
  Mail,
  Plus,
  Radar,
  RefreshCw,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Webhook,
  X,
  Play,
  LoaderCircle,
  AlertCircle,
  CircleCheck,
} from 'lucide-react';
import { FORM_PRESETS } from '@/lib/presets';
import { IFormField, IFormItem } from '@/models/Site';
import { SectionCard, Toggle, FieldLabel, StatusPill, Toast, type Notice } from '@/components/ui';

interface SiteFormProps {
  initialData?: any;
  isEditing?: boolean;
}

const UI_FIELD_TYPES = [
  'Text',
  'Tel',
  'Email',
  'Select',
  'File / Image Upload',
  'Textarea',
  'Checkbox',
] as const;

type UiFieldType = typeof UI_FIELD_TYPES[number];

const VERIFICATION_OPTIONS = [
  { label: 'CSS Selector Appears (e.g. .success-msg)', value: 'selector_visible' },
  { label: 'Text Appears on Page', value: 'text_visible' },
  { label: 'URL Redirect / Thank You Page', value: 'url_redirect' },
];

export default function SiteForm({ initialData, isEditing = false }: SiteFormProps) {
  const router = useRouter();

  // Helper to sanitize clean form name
  const sanitizeName = (n: string) =>
    (n || '')
      .replace(/\s*\(Appears on \d+ pages?\)/gi, '')
      .replace(/\s*\(Shared across \d+ pages?\)/gi, '')
      .replace(/\s*\(Global.*?\)/gi, '')
      .trim();

  // Step 01: Website details & Crawler
  const [siteName, setSiteName] = useState(initialData?.name || '');
  const [siteUrl, setSiteUrl] = useState(initialData?.url || '');
  const [activeMonitoring, setActiveMonitoring] = useState<boolean>(
    initialData?.isActive !== undefined ? initialData.isActive : true
  );

  // Discovery Crawler state
  const [scanMode, setScanMode] = useState<'idle' | 'page' | 'deep'>('idle');
  const [scanProgress, setScanProgress] = useState(0);
  const [lastScan, setLastScan] = useState<string | null>(null);
  const [discoveredForms, setDiscoveredForms] = useState<any[]>([]);
  const [selectedDiscovered, setSelectedDiscovered] = useState<Record<number, boolean>>({});

  // Step 02: Monitored Forms List
  const initialFormsList: IFormItem[] =
    initialData?.forms && initialData.forms.length > 0
      ? initialData.forms.map((f: any) => ({ ...f, name: sanitizeName(f.name) }))
      : isEditing && initialData?.fields && initialData.fields.length > 0
      ? [
          {
            id: 'form-' + Math.random().toString(36).substring(2, 9),
            name: initialData?.name ? `${initialData.name} Form` : 'Primary Contact Form',
            pageUrl: initialData?.url || '',
            formPluginType: initialData?.formPluginType || 'Elementor Pro',
            fields: initialData.fields,
            submitButtonSelector:
              initialData?.submitButtonSelector ||
              FORM_PRESETS['Elementor Pro'].submitButtonSelector,
            verificationMethod:
              initialData?.verificationMethod ||
              FORM_PRESETS['Elementor Pro'].verificationMethod,
            expectedSuccessValue:
              initialData?.expectedSuccessValue ||
              FORM_PRESETS['Elementor Pro'].expectedSuccessValue,
            isActive: true,
          },
        ]
      : [];

  const [forms, setForms] = useState<IFormItem[]>(initialFormsList);
  const [activeFormIndex, setActiveFormIndex] = useState<number>(0);

  // Step 03: Alert & Notification routing
  const [alertMode, setAlertMode] = useState<'global' | 'custom'>(
    initialData?.notificationPreferences?.useGlobalDefaults === false ? 'custom' : 'global'
  );
  const [customEmails, setCustomEmails] = useState(
    initialData?.notificationPreferences?.customEmails?.join(', ') || ''
  );
  const [customWebhookUrl, setCustomWebhookUrl] = useState(
    initialData?.notificationPreferences?.customSlackWebhookUrl || ''
  );
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(
    initialData?.notificationPreferences?.notifyOnSuccess || false
  );

  // Operation / Feedback states
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingActiveForm, setIsTestingActiveForm] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const progressTimerRef = useRef<any>(null);

  const notify = (message: string, tone: 'success' | 'info' | 'error' = 'success') => {
    setNotice({ id: Date.now(), message, tone });
  };

  useEffect(() => {
    return () => {
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, []);

  // Active form pointer
  const activeForm: IFormItem = forms[activeFormIndex] || {
    id: 'default',
    name: 'Primary Form',
    pageUrl: siteUrl,
    formPluginType: 'Contact Form 7',
    fields: [],
    submitButtonSelector: 'input[type="submit"]',
    verificationMethod: 'selector_visible',
    expectedSuccessValue: '.wpcf7-mail-sent-ok',
    isActive: true,
  };

  // Type converters
  const mapTypeToUi = (t: string): UiFieldType => {
    switch (t) {
      case 'file':
        return 'File / Image Upload';
      case 'tel':
        return 'Tel';
      case 'email':
        return 'Email';
      case 'select':
        return 'Select';
      case 'textarea':
        return 'Textarea';
      case 'checkbox':
        return 'Checkbox';
      default:
        return 'Text';
    }
  };

  const mapUiToType = (ui: UiFieldType): IFormField['type'] => {
    switch (ui) {
      case 'File / Image Upload':
        return 'file';
      case 'Tel':
        return 'tel';
      case 'Email':
        return 'email';
      case 'Select':
        return 'select';
      case 'Textarea':
        return 'textarea';
      case 'Checkbox':
        return 'checkbox';
      default:
        return 'text';
    }
  };

  // Form updates
  const updateActiveForm = (patch: Partial<IFormItem>) => {
    setForms((prev) => {
      const copy = [...prev];
      if (copy[activeFormIndex]) {
        copy[activeFormIndex] = { ...copy[activeFormIndex], ...patch };
      }
      return copy;
    });
  };

  const updateActiveFormField = (fIdx: number, patch: Partial<IFormField>) => {
    setForms((prev) => {
      const copy = [...prev];
      if (copy[activeFormIndex]) {
        const curFields = [...(copy[activeFormIndex].fields || [])];
        if (curFields[fIdx]) {
          curFields[fIdx] = { ...curFields[fIdx], ...patch };
          copy[activeFormIndex] = { ...copy[activeFormIndex], fields: curFields };
        }
      }
      return copy;
    });
  };

  const addFieldToActiveForm = () => {
    setForms((prev) => {
      const copy = [...prev];
      if (copy[activeFormIndex]) {
        const curFields = copy[activeFormIndex].fields || [];
        copy[activeFormIndex] = {
          ...copy[activeFormIndex],
          fields: [
            ...curFields,
            {
              label: 'New Field',
              selector: 'input[name=""]',
              type: 'text',
              testValue: 'FormGuard QA Bot',
            },
          ],
        };
      }
      return copy;
    });
    notify('New input row added — specify its CSS selector and test value.', 'info');
  };

  const removeFieldFromActiveForm = (fIdx: number) => {
    setForms((prev) => {
      const copy = [...prev];
      if (copy[activeFormIndex]) {
        const curFields = copy[activeFormIndex].fields || [];
        copy[activeFormIndex] = {
          ...copy[activeFormIndex],
          fields: curFields.filter((_, i) => i !== fIdx),
        };
      }
      return copy;
    });
  };

  const addNewForm = () => {
    const defaultPreset = FORM_PRESETS['Contact Form 7'];
    const newFormItem: IFormItem = {
      id: 'form-' + Math.random().toString(36).substring(2, 9),
      name: `Form #${forms.length + 1}`,
      pageUrl: siteUrl || '',
      formPluginType: 'Contact Form 7',
      fields: [...defaultPreset.fields],
      submitButtonSelector: defaultPreset.submitButtonSelector,
      verificationMethod: defaultPreset.verificationMethod,
      expectedSuccessValue: defaultPreset.expectedSuccessValue,
      isActive: true,
    };
    setForms((prev) => [...prev, newFormItem]);
    setActiveFormIndex(forms.length);
    notify('A new form was added. Configure its fields and selectors.', 'info');
  };

  const removeForm = (indexToDelete: number) => {
    if (forms.length <= 1) {
      notify('A monitored website must have at least one active form.', 'error');
      return;
    }
    const next = forms.filter((_, i) => i !== indexToDelete);
    setForms(next);
    if (activeFormIndex >= next.length) {
      setActiveFormIndex(next.length - 1);
    }
    notify('Form removed from website monitoring.', 'info');
  };

  const applyPreset = (presetName: string) => {
    const preset = FORM_PRESETS[presetName];
    if (!preset) return;
    updateActiveForm({
      formPluginType: preset.pluginType,
      submitButtonSelector: preset.submitButtonSelector,
      verificationMethod: preset.verificationMethod,
      expectedSuccessValue: preset.expectedSuccessValue,
      fields: [...preset.fields],
    });
    notify(`${presetName} preset selectors and fields applied.`, 'info');
  };

  // Run Crawl & Auto-Detect
  const startScan = async (mode: 'page' | 'deep') => {
    if (!siteUrl.trim() || !siteUrl.startsWith('http')) {
      notify('Please enter a valid website URL starting with http:// or https://', 'error');
      return;
    }

    if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    setScanMode(mode);
    setScanProgress(10);

    // Fake smooth animation while Playwright works
    progressTimerRef.current = setInterval(() => {
      setScanProgress((p) => {
        if (p < 88) return p + (mode === 'deep' ? 3 : 7);
        return p;
      });
    }, 280);

    try {
      const res = await fetch('/api/sites/inspect-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: siteUrl.trim(), deepScan: mode === 'deep' }),
      });

      const json = await res.json();
      clearInterval(progressTimerRef.current);

      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to inspect website for forms.');
      }

      setScanProgress(100);
      const discovered = json.forms || (json.data ? [json.data] : []);
      setDiscoveredForms(discovered);

      // Default all discovered forms to selected
      const initialChecked: Record<number, boolean> = {};
      discovered.forEach((_: any, idx: number) => {
        initialChecked[idx] = true;
      });
      setSelectedDiscovered(initialChecked);

      setLastScan(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));

      // Auto-set website name if empty
      if (!siteName && json.siteTitle) {
        setSiteName(json.siteTitle);
      }

      notify(
        mode === 'deep'
          ? `Deep crawl complete — ${discovered.length} forms discovered across sitemaps & priority pages.`
          : `Current page scanned — ${discovered.length} forms found.`,
        'success'
      );
    } catch (err: any) {
      clearInterval(progressTimerRef.current);
      setScanProgress(0);
      notify(err.message || 'Error occurred while scanning for forms.', 'error');
    } finally {
      setScanMode('idle');
    }
  };

  const toggleSelectAllDiscovered = () => {
    const allSelected =
      discoveredForms.length > 0 &&
      discoveredForms.every((_, idx) => !!selectedDiscovered[idx]);

    const next: Record<number, boolean> = {};
    discoveredForms.forEach((_, idx) => {
      next[idx] = !allSelected;
    });
    setSelectedDiscovered(next);
  };

  const importSelectedForms = () => {
    const chosen = discoveredForms.filter((_, idx) => !!selectedDiscovered[idx]);
    if (!chosen.length) {
      notify('Please select at least one discovered form to import.', 'error');
      return;
    }

    const imported: IFormItem[] = chosen.map((df: any, idx: number) => {
      const cleanName = sanitizeName(df.name || `Form #${idx + 1}`);
      return {
        id: 'form-' + Math.random().toString(36).substring(2, 9),
        name: cleanName,
        pageUrl: df.pageUrl || siteUrl,
        formPluginType: df.formPluginType || 'Contact Form 7',
        fields: df.fields && df.fields.length > 0 ? df.fields : [...FORM_PRESETS['Contact Form 7'].fields],
        submitButtonSelector: df.submitButtonSelector || 'input[type="submit"]',
        verificationMethod: df.verificationMethod || 'selector_visible',
        expectedSuccessValue: df.expectedSuccessValue || '.wpcf7-mail-sent-ok',
        isActive: true,
      };
    });

    setForms(imported);
    setActiveFormIndex(0);
    notify(
      `${imported.length} ${imported.length === 1 ? 'form' : 'forms'} imported into your active monitoring queue!`,
      'success'
    );

    // Scroll to Step 02
    setTimeout(() => {
      document.getElementById('monitored-forms')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
  };

  // Test Active Form with Playwright
  const handleTestActiveForm = async () => {
    if (!activeForm.pageUrl || !activeForm.submitButtonSelector) {
      notify('Active form requires a page URL and submit button selector.', 'error');
      return;
    }

    setIsTestingActiveForm(true);
    notify(`Testing "${activeForm.name}" with headless Playwright…`, 'info');

    try {
      const res = await fetch('/api/test/run-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tempConfig: {
            name: siteName || 'Test Site',
            url: siteUrl,
            form: activeForm,
          },
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Test execution failed.');
      }

      if (data.result.status === 'passed') {
        notify(`✅ Passed: "${activeForm.name}" verified in ${data.result.durationMs}ms!`, 'success');
      } else {
        notify(`🚨 Failed: "${activeForm.name}" — ${data.result.errorMessage}`, 'error');
      }
    } catch (err: any) {
      notify(err.message || 'Form test failed to run.', 'error');
    } finally {
      setIsTestingActiveForm(false);
    }
  };

  // Save Site & All Forms
  const handleSave = async () => {
    if (!siteName.trim()) {
      notify('Client website name is required.', 'error');
      return;
    }
    if (!siteUrl.trim() || !siteUrl.startsWith('http')) {
      notify('Target website URL is required (must start with http:// or https://).', 'error');
      return;
    }
    if (!forms.length) {
      notify('Please configure at least one form to monitor.', 'error');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        name: siteName.trim(),
        url: siteUrl.trim(),
        isActive: activeMonitoring,
        forms: forms.map((f) => ({
          ...f,
          name: sanitizeName(f.name),
        })),
        notificationPreferences: {
          useGlobalDefaults: alertMode === 'global',
          enableEmail: alertMode === 'custom' ? !!customEmails.trim() : true,
          customEmails:
            alertMode === 'custom'
              ? customEmails
                  .split(',')
                  .map((e: string) => e.trim())
                  .filter(Boolean)
              : [],
          enableSlack: alertMode === 'custom' ? !!customWebhookUrl.trim() : true,
          customSlackWebhookUrl: alertMode === 'custom' ? customWebhookUrl.trim() : '',
          notifyOnSuccess,
        },
      };

      const urlToCall = isEditing ? `/api/sites/${initialData._id}` : '/api/sites';
      const methodToCall = isEditing ? 'PUT' : 'POST';

      const res = await fetch(urlToCall, {
        method: methodToCall,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to save website configuration.');
      }

      notify(
        `Website "${siteName}" saved successfully with ${forms.length} monitored ${
          forms.length === 1 ? 'form' : 'forms'
        }!`,
        'success'
      );

      setTimeout(() => {
        router.push('/');
        router.refresh();
      }, 700);
    } catch (err: any) {
      notify(err.message || 'Failed to save website.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedDiscoveredCount = Object.values(selectedDiscovered).filter(Boolean).length;
  const allDiscoveredSelected =
    discoveredForms.length > 0 && selectedDiscoveredCount === discoveredForms.length;

  return (
    <div className="canvas-glow min-h-full">
      <div className="mx-auto w-full max-w-[1130px] px-4 pb-12 pt-7 sm:px-7 lg:px-9">
        {/* Page Hero */}
        <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
          <div className="flex items-start gap-3">
            <Link
              href="/"
              aria-label="Back to dashboard"
              className="mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-line bg-white text-[#64748b] shadow-sm transition hover:border-[#c3cde3] hover:text-cobalt"
            >
              <ChevronLeft size={17} />
            </Link>
            <div>
              <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold text-[#8a97ad]">
                <Link href="/" className="hover:text-cobalt transition-colors">Websites</Link>
                <span className="text-[#c2cbdc]">/</span>
                <span className="text-cobalt">{isEditing ? 'Edit site' : 'New site'}</span>
              </div>
              <h1 className="font-display text-[26px] font-extrabold leading-tight tracking-[-.035em] text-ink sm:text-[32px]">
                {isEditing ? `Edit: ${initialData?.name || 'WordPress Site'}` : 'Add WordPress site'}
              </h1>
              <p className="mt-1.5 max-w-xl text-[13px] leading-relaxed text-muted">
                Crawl the site, configure form selectors and submission triggers, then choose where failures are reported.
              </p>
            </div>
          </div>

          {/* 3-Step Indicator */}
          <div className="panel flex items-center gap-3 px-4 py-3">
            {[
              { n: '01', label: 'Discover' },
              { n: '02', label: 'Configure' },
              { n: '03', label: 'Alerts' },
            ].map((step, i) => (
              <div key={step.n} className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <span
                    className={`grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold ${
                      forms.length > 0 && i === 0
                        ? 'bg-[#e7f8f2] text-mint'
                        : i === 1
                        ? 'bg-cobalt text-white'
                        : 'bg-[#eef1ff] text-cobalt'
                    }`}
                  >
                    {forms.length > 0 && i === 0 ? <Check size={12} strokeWidth={3} /> : step.n}
                  </span>
                  <span
                    className={`hidden text-[11.5px] font-semibold sm:block ${
                      i === 1 ? 'text-ink' : 'text-[#98a4b8]'
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
                {i < 2 && <span className="h-px w-4 bg-[#dce3ef] sm:w-6" />}
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-6">
          {/* STEP 01: Website info & crawler */}
          <SectionCard
            step="01"
            icon={<Globe size={19} />}
            title="Website information & crawler"
            subtitle="Enter the homepage URL. FormGuard crawls internal pages and sitemaps to find every contact form and its input structure."
            action={
              <StatusPill tone="green">
                <span className="dot-live" /> Crawler ready
              </StatusPill>
            }
          >
            <div className="px-5 py-6 sm:px-7">
              <div className="grid gap-5 md:grid-cols-2">
                <div>
                  <FieldLabel required>Client website name</FieldLabel>
                  <input
                    className="field"
                    value={siteName}
                    onChange={(e) => setSiteName(e.target.value)}
                    placeholder="e.g. Skin Creations SG"
                  />
                </div>
                <div className="panel-tint flex items-center justify-between gap-3 rounded-xl px-4 py-2.5">
                  <div>
                    <p className="text-[12.5px] font-semibold text-ink">Active daily monitoring</p>
                    <p className="mt-0.5 text-[11px] text-muted">Include all forms in the 04:00 UTC cron run</p>
                  </div>
                  <Toggle
                    checked={activeMonitoring}
                    onChange={setActiveMonitoring}
                    label="Active daily monitoring"
                  />
                </div>
              </div>

              <div className="mt-5">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <FieldLabel required>
                    Target website URL{' '}
                    <span className="normal-case tracking-normal text-[#9aa6b9]">
                      (homepage or specific form page)
                    </span>
                  </FieldLabel>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => startScan('page')}
                      disabled={scanMode !== 'idle'}
                    >
                      {scanMode === 'page' ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <Search size={13} />
                      )}
                      Scan current page
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => startScan('deep')}
                      disabled={scanMode !== 'idle'}
                    >
                      {scanMode === 'deep' ? (
                        <RefreshCw size={13} className="animate-spin" />
                      ) : (
                        <Radar size={13} />
                      )}
                      Deep crawl entire website
                    </button>
                  </div>
                </div>

                <div className="relative">
                  <Link2
                    size={15}
                    className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98a4b8]"
                  />
                  <input
                    className="field !pl-10"
                    value={siteUrl}
                    onChange={(e) => setSiteUrl(e.target.value)}
                    placeholder="https://example.com/"
                  />
                </div>

                <div className="mt-2.5 flex items-start gap-2 rounded-lg bg-[#f7f9fc] px-3 py-2.5 text-[11.5px] leading-relaxed text-[#74829a]">
                  <Lightbulb size={14} className="mt-0.5 shrink-0 text-[#d79b2d]" />
                  <span>
                    <strong className="font-semibold text-[#4b5b75]">Tip:</strong> Use the homepage URL with “Deep crawl entire website” to parse WordPress XML sitemaps and find sub-page forms across careers, booking, quote, and contact pages.
                  </span>
                </div>
              </div>

              {/* Scanning Progress Bar */}
              {scanMode !== 'idle' && (
                <div className="animate-rise mt-4 rounded-xl border border-[#d8e0fb] bg-[#f7f9ff] px-4 py-3.5">
                  <div className="mb-2.5 flex items-center justify-between text-[12px] font-semibold text-cobalt">
                    <span className="flex items-center gap-2">
                      <RefreshCw size={13} className="animate-spin" />
                      {scanMode === 'deep' ? 'Crawling internal pages & XML sitemaps…' : 'Inspecting current page with Playwright…'}
                    </span>
                    <span>{scanProgress}%</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-[#dde4fa]">
                    <div
                      className="h-full rounded-full bg-cobalt transition-[width] duration-200"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Discovered Forms Panel (shows only after crawling) */}
              {discoveredForms.length > 0 && (
                <div className="mt-6 rounded-2xl border border-line bg-[#fafbfe] p-4 sm:p-5 animate-rise">
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles size={15} className="text-cobalt" />
                        <h3 className="font-display text-[14px] font-bold text-ink">
                          Discovered forms across website
                        </h3>
                        <StatusPill tone="blue">{discoveredForms.length} found</StatusPill>
                      </div>
                      <p className="mt-1 text-[11.5px] text-muted">
                        {lastScan ? `Last crawl: ${lastScan} · ` : ''}Select the forms you want to monitor and import them.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={toggleSelectAllDiscovered}
                      >
                        {allDiscoveredSelected ? 'Deselect all' : 'Select all'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={importSelectedForms}
                        disabled={scanMode !== 'idle'}
                      >
                        <Plus size={13} /> Import selected ({selectedDiscoveredCount})
                      </button>
                    </div>
                  </div>

                  <div className="soft-scroll grid max-h-[350px] gap-2.5 overflow-y-auto pr-1 md:grid-cols-2">
                    {discoveredForms.map((item: any, idx: number) => {
                      const isSelected = !!selectedDiscovered[idx];
                      const pagesCount = item.sharedPagesCount || item.foundOnPages?.length || 1;
                      const inputCount = item.fields?.length || 0;
                      const fieldPreview = item.fields?.map((f: any) => f.label).slice(0, 5).join(', ');

                      return (
                        <div
                          key={idx}
                          onClick={() =>
                            setSelectedDiscovered((prev) => ({ ...prev, [idx]: !prev[idx] }))
                          }
                          className={`cursor-pointer rounded-xl border p-3.5 text-left transition-all ${
                            isSelected
                              ? 'border-[#aebcf8] bg-[#f4f6ff] shadow-[0_3px_12px_rgba(60,86,232,.07)]'
                              : 'border-line bg-white hover:border-[#c5cfe4] hover:bg-[#fcfdff]'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`checkbox mt-0.5 ${isSelected ? 'on' : ''}`}>
                              <Check size={12} strokeWidth={3} />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <p className="truncate text-[12.5px] font-bold text-ink" title={item.name}>
                                  {sanitizeName(item.name || `Form #${idx + 1}`)}
                                </p>
                                <span className="pill shrink-0 bg-white text-[#6c7b95] ring-1 ring-[#e2e8f2]">
                                  {item.formPluginType || 'Contact Form 7'}
                                </span>
                              </div>
                              <p className="mt-1 truncate text-[11px] text-[#7f8da4]">
                                <Link2 size={11} className="mr-1 inline align-[-1px]" />
                                {item.pageUrl || siteUrl}
                              </p>
                              <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                                <StatusPill tone="amber">
                                  Shared across {pagesCount} {pagesCount === 1 ? 'page' : 'pages'}
                                </StatusPill>
                                <StatusPill tone="gray">
                                  {inputCount} {inputCount === 1 ? 'input' : 'inputs'}
                                </StatusPill>
                              </div>
                              {fieldPreview && (
                                <p className="mt-2 truncate text-[10.5px] text-[#9aa6b9]" title={fieldPreview}>
                                  {fieldPreview}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </SectionCard>

          {/* STEP 02: Monitored Forms Manager */}
          <div id="monitored-forms" className="scroll-mt-24">
            <SectionCard
              step="02"
              icon={<Layers size={19} />}
              title="Monitored forms on this website"
              subtitle="Every active form below is filled and submitted during daily monitoring or when you run tests manually."
              action={
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={addNewForm}
                >
                  <Plus size={13} /> Add another form
                </button>
              }
            >
              {/* Form tabs strip */}
              <div className="soft-scroll flex items-stretch gap-1 overflow-x-auto border-b border-line bg-[#fbfcfe] px-3 pt-2 sm:px-5">
                {forms.map((form, fIdx) => {
                  const isActiveTab = fIdx === activeFormIndex;
                  return (
                    <div
                      key={form.id || fIdx}
                      className={`group relative flex shrink-0 items-center rounded-t-lg border-b-2 transition ${
                        isActiveTab
                          ? 'border-cobalt bg-white'
                          : 'border-transparent hover:bg-white/70'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setActiveFormIndex(fIdx)}
                        className={`flex max-w-[220px] items-center gap-2 px-3.5 py-3 text-[11.5px] font-semibold ${
                          isActiveTab ? 'text-cobalt' : 'text-[#728199]'
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${
                            form.isActive !== false ? 'bg-mint' : 'bg-[#c1cad9]'
                          }`}
                        />
                        <span className="truncate">{form.name || `Form #${fIdx + 1}`}</span>
                        <span className="shrink-0 text-[10px] font-medium text-[#a3aec1]">
                          {form.fields?.length || 0}
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => removeForm(fIdx)}
                        aria-label={`Remove ${form.name}`}
                        className="mr-2 grid h-6 w-6 shrink-0 place-items-center rounded-md text-[#b3bdcd] transition hover:bg-[#ffeded] hover:text-[#d64c59] sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                      >
                        <Trash2 size={12} />
                      </button>
                    </div>
                  );
                })}
              </div>

              {/* Active Form Editor */}
              <div className="px-4 py-5 sm:px-6 sm:py-6">
                <div className="overflow-hidden rounded-2xl border border-line bg-[#fbfcfe]">
                  {/* Editor Header */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-3.5 sm:px-5">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-[#eef1ff] text-cobalt">
                        <Settings2 size={15} />
                      </span>
                      <div className="min-w-0">
                        <p className="font-display text-[10px] font-extrabold tracking-[.12em] text-[#8a97ad]">
                          EDITING SETTINGS FOR
                        </p>
                        <p className="truncate text-[12.5px] font-bold text-ink">
                          “{activeForm.name || 'Form'}”
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={handleTestActiveForm}
                        disabled={isTestingActiveForm}
                        className="btn btn-secondary btn-sm !h-8 text-[11.5px]"
                      >
                        {isTestingActiveForm ? (
                          <LoaderCircle size={13} className="animate-spin text-cobalt" />
                        ) : (
                          <Play size={12} className="text-cobalt fill-current" />
                        )}
                        Test this form now
                      </button>
                      <div className="h-4 w-px bg-line" />
                      <div className="flex items-center gap-2">
                        <span className="text-[11.5px] font-medium text-[#5d6c86]">
                          Enable daily testing
                        </span>
                        <Toggle
                          checked={activeForm.isActive !== false}
                          onChange={(v) => updateActiveForm({ isActive: v })}
                          label="Enable daily testing"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-6 px-4 py-5 sm:px-5">
                    {/* Form Metadata */}
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div>
                        <FieldLabel required>Form name / label</FieldLabel>
                        <input
                          className="field"
                          value={activeForm.name}
                          onChange={(e) => updateActiveForm({ name: e.target.value })}
                          placeholder="e.g. Booking Form"
                        />
                      </div>
                      <div>
                        <FieldLabel>Form plugin type</FieldLabel>
                        <select
                          className="field"
                          value={activeForm.formPluginType}
                          onChange={(e) => updateActiveForm({ formPluginType: e.target.value as any })}
                        >
                          <option value="Contact Form 7">Contact Form 7</option>
                          <option value="Elementor Pro">Elementor Pro</option>
                          <option value="MetForm">MetForm</option>
                          <option value="WPForms">WPForms</option>
                          <option value="Gravity Forms">Gravity Forms</option>
                          <option value="Custom">Custom</option>
                        </select>
                      </div>
                      <div>
                        <FieldLabel required>Exact page URL where form lives</FieldLabel>
                        <input
                          className="field"
                          value={activeForm.pageUrl}
                          onChange={(e) => updateActiveForm({ pageUrl: e.target.value })}
                          placeholder="https://example.com/contact/"
                        />
                      </div>
                    </div>

                    {/* Presets Strip */}
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="mr-1 text-[11px] font-semibold text-[#8491a7]">
                        Apply preset:
                      </span>
                      {['Contact Form 7', 'Elementor Pro', 'MetForm', 'WPForms', 'Gravity Forms', 'Custom'].map(
                        (preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold transition ${
                              activeForm.formPluginType === preset
                                ? 'border-cobalt bg-[#eef1ff] text-cobalt'
                                : 'border-line bg-white text-[#71809a] hover:border-[#bdc8e2] hover:text-cobalt'
                            }`}
                          >
                            {preset}
                          </button>
                        )
                      )}
                    </div>

                    {/* Form Inputs Matrix */}
                    <div className="rounded-xl border border-line bg-white">
                      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5">
                        <div>
                          <h4 className="font-display text-[13px] font-bold text-ink">
                            Form inputs & test values
                          </h4>
                          <p className="mt-0.5 text-[11px] text-muted">
                            Playwright will automatically fill text, pick random select options, or attach dummy media.
                          </p>
                        </div>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={addFieldToActiveForm}
                        >
                          <Plus size={13} /> Add input field
                        </button>
                      </div>

                      <div className="soft-scroll overflow-x-auto">
                        <div className="min-w-[820px]">
                          <div className="grid grid-cols-[1.05fr_1.65fr_1fr_1.15fr_30px] gap-2.5 border-b border-line bg-[#f8fafd] px-3 py-2.5">
                            {['Label', 'CSS selector', 'Type', 'Test value', ''].map((h, i) => (
                              <span
                                key={i}
                                className="text-[10px] font-bold uppercase tracking-[.09em] text-[#8a97ad]"
                              >
                                {h}
                              </span>
                            ))}
                          </div>

                          {activeForm.fields?.map((field, fIdx) => (
                            <div
                              key={fIdx}
                              className="grid grid-cols-[1.05fr_1.65fr_1fr_1.15fr_30px] items-center gap-2.5 border-b border-line/70 px-3 py-2.5 last:border-0 hover:bg-[#fcfdff]"
                            >
                              <input
                                className="field !h-9 text-[12px]"
                                placeholder="Field label"
                                value={field.label}
                                onChange={(e) => updateActiveFormField(fIdx, { label: e.target.value })}
                              />
                              <input
                                className="field !h-9 font-mono !text-[11px]"
                                placeholder="input[name='...']"
                                value={field.selector}
                                onChange={(e) => updateActiveFormField(fIdx, { selector: e.target.value })}
                              />
                              <select
                                className="field !h-9 !text-[11.5px]"
                                value={mapTypeToUi(field.type)}
                                onChange={(e) => {
                                  const selectedUiType = e.target.value as UiFieldType;
                                  const backendType = mapUiToType(selectedUiType);
                                  const testValue =
                                    backendType === 'file' ? '[Dummy Black Image]' : field.testValue;
                                  updateActiveFormField(fIdx, {
                                    type: backendType,
                                    testValue,
                                  });
                                }}
                              >
                                {UI_FIELD_TYPES.map((t) => (
                                  <option key={t} value={t}>
                                    {t}
                                  </option>
                                ))}
                              </select>
                              <input
                                className="field !h-9 text-[12px]"
                                placeholder="Test value"
                                value={field.testValue}
                                onChange={(e) => updateActiveFormField(fIdx, { testValue: e.target.value })}
                              />
                              <button
                                type="button"
                                onClick={() => removeFieldFromActiveForm(fIdx)}
                                aria-label="Delete input field"
                                className="grid h-8 w-7 place-items-center rounded-md text-[#b3bdcd] transition hover:bg-[#ffeded] hover:text-[#d64c59]"
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          ))}

                          {(!activeForm.fields || activeForm.fields.length === 0) && (
                            <div className="px-4 py-8 text-center text-[12px] text-muted">
                              No inputs added yet. Click &quot;Add input field&quot; or apply a plugin preset above.
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Verification Method & Success Triggers */}
                    <div className="grid gap-4 lg:grid-cols-3">
                      <div>
                        <FieldLabel required>Submit button selector</FieldLabel>
                        <input
                          className="field font-mono !text-[11px]"
                          value={activeForm.submitButtonSelector}
                          onChange={(e) =>
                            updateActiveForm({ submitButtonSelector: e.target.value })
                          }
                          placeholder='button[type="submit"]'
                        />
                      </div>
                      <div>
                        <FieldLabel>Verification method</FieldLabel>
                        <select
                          className="field"
                          value={activeForm.verificationMethod}
                          onChange={(e) =>
                            updateActiveForm({ verificationMethod: e.target.value as any })
                          }
                        >
                          {VERIFICATION_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <FieldLabel required>Expected success value</FieldLabel>
                        <input
                          className="field font-mono !text-[11px]"
                          value={activeForm.expectedSuccessValue}
                          onChange={(e) =>
                            updateActiveForm({ expectedSuccessValue: e.target.value })
                          }
                          placeholder=".wpcf7-mail-sent-ok"
                        />
                      </div>
                    </div>

                    <div className="flex items-start gap-2 rounded-xl bg-[#f2f5ff] px-3.5 py-3 text-[11.5px] leading-relaxed text-[#5a6a90]">
                      <ShieldCheck size={15} className="mt-0.5 shrink-0 text-cobalt" />
                      <span>
                        Test flow: fill <strong className="font-semibold text-ink">{activeForm.fields?.length || 0} inputs</strong> → click submit → wait for verification condition → capture full screenshot & result.
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </SectionCard>
          </div>

          {/* STEP 03: Alert & Notification routing */}
          <SectionCard
            step="03"
            icon={<Bell size={19} />}
            title="Alert & notification routing"
            subtitle="Choose where failure alerts and screenshots are sent if any form on this website breaks."
            action={
              <StatusPill tone="gray">
                <Clock size={11} /> Checks daily at 04:00 UTC
              </StatusPill>
            }
          >
            <div className="px-5 py-6 sm:px-7">
              <div className="grid gap-3 md:grid-cols-2">
                <button
                  type="button"
                  onClick={() => setAlertMode('global')}
                  className={`rounded-xl border p-4 text-left transition ${
                    alertMode === 'global'
                      ? 'border-cobalt bg-[#f5f7ff] shadow-[0_3px_14px_rgba(60,86,232,.09)]'
                      : 'border-line bg-white hover:border-[#c5cfe4]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                        alertMode === 'global' ? 'border-cobalt' : 'border-[#cbd5e3]'
                      }`}
                    >
                      {alertMode === 'global' && <span className="h-1.5 w-1.5 rounded-full bg-cobalt" />}
                    </span>
                    <div>
                      <p className="text-[12.5px] font-bold text-ink">
                        Use global notification defaults
                      </p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                        Inherits email inboxes and Slack webhooks configured in Settings & Alerts.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <StatusPill tone="green">
                          <Check size={10} /> Recommended
                        </StatusPill>
                        <StatusPill tone="gray">Global channels</StatusPill>
                      </div>
                    </div>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setAlertMode('custom')}
                  className={`rounded-xl border p-4 text-left transition ${
                    alertMode === 'custom'
                      ? 'border-cobalt bg-[#f5f7ff] shadow-[0_3px_14px_rgba(60,86,232,.09)]'
                      : 'border-line bg-white hover:border-[#c5cfe4]'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 ${
                        alertMode === 'custom' ? 'border-cobalt' : 'border-[#cbd5e3]'
                      }`}
                    >
                      {alertMode === 'custom' && <span className="h-1.5 w-1.5 rounded-full bg-cobalt" />}
                    </span>
                    <div>
                      <p className="text-[12.5px] font-bold text-ink">
                        Custom routing for this website
                      </p>
                      <p className="mt-1 text-[11.5px] leading-relaxed text-muted">
                        Send this client site’s alerts directly to a dedicated client or team inbox.
                      </p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <StatusPill tone="blue">
                          <Mail size={10} /> Email
                        </StatusPill>
                        <StatusPill tone="blue">
                          <Webhook size={10} /> Webhook
                        </StatusPill>
                      </div>
                    </div>
                  </div>
                </button>
              </div>

              {alertMode === 'custom' && (
                <div className="animate-rise mt-4 grid gap-4 rounded-xl border border-line bg-[#fafbfe] p-4 md:grid-cols-2">
                  <div>
                    <FieldLabel>Alert email recipients</FieldLabel>
                    <div className="relative">
                      <Mail
                        size={14}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98a4b8]"
                      />
                      <input
                        className="field !pl-10"
                        value={customEmails}
                        onChange={(e) => setCustomEmails(e.target.value)}
                        placeholder="client@company.com, team@agency.com"
                      />
                    </div>
                  </div>
                  <div>
                    <FieldLabel>
                      Slack incoming webhook URL{' '}
                      <span className="normal-case tracking-normal text-[#a3aec1]">(optional)</span>
                    </FieldLabel>
                    <div className="relative">
                      <Webhook
                        size={14}
                        className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#98a4b8]"
                      />
                      <input
                        className="field !pl-10"
                        value={customWebhookUrl}
                        onChange={(e) => setCustomWebhookUrl(e.target.value)}
                        placeholder="https://hooks.slack.com/services/..."
                      />
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-[#fafbfe] px-4 py-3.5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-white text-cobalt ring-1 ring-line">
                    <Bell size={14} />
                  </span>
                  <div>
                    <p className="text-[12.5px] font-semibold text-ink">Also notify on passed tests</p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      By default, FormGuard Pro only alerts you when a form fails to avoid notification fatigue.
                    </p>
                  </div>
                </div>
                <Toggle
                  checked={notifyOnSuccess}
                  onChange={setNotifyOnSuccess}
                  label="Notify on passed tests"
                />
              </div>
            </div>
          </SectionCard>
        </div>
      </div>

      {/* Sticky Bottom Action Bar */}
      <div className="sticky bottom-0 z-30 border-t border-line bg-white/95 backdrop-blur-xl shadow-lg">
        <div className="mx-auto flex w-full max-w-[1130px] flex-wrap items-center justify-between gap-3 px-4 py-3.5 sm:px-7 lg:px-9">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#e7f8f2] text-mint">
              <ShieldCheck size={18} />
            </span>
            <div>
              <p className="text-[12.5px] font-bold text-ink">
                {forms.length} {forms.length === 1 ? 'form' : 'forms'} ready to monitor
              </p>
              <p className="text-[11px] text-muted">
                {siteName || 'Untitled website'} · {activeMonitoring ? 'Daily schedule enabled' : 'Schedule paused'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn btn-secondary btn-lg">
              Cancel
            </Link>
            <button
              type="button"
              className="btn btn-primary btn-lg"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <RefreshCw size={15} className="animate-spin" /> Saving…
                </>
              ) : (
                <>
                  <Check size={15} strokeWidth={2.5} /> Save website & all {forms.length} forms{' '}
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Notification Toast */}
      <Toast notice={notice} onClose={() => setNotice(null)} />
    </div>
  );
}
