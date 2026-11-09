'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Save,
  Plus,
  Trash2,
  Sparkles,
  Play,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Bell,
  Mail,
  MessageSquare,
  Globe,
  Settings,
  Layers,
  CheckSquare,
  Square,
  ExternalLink,
  ChevronRight,
} from 'lucide-react';
import { FORM_PRESETS } from '@/lib/presets';
import { IFormField, IFormItem } from '@/models/Site';

interface SiteFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export default function SiteForm({ initialData, isEditing = false }: SiteFormProps) {
  const router = useRouter();

  // Basic Info
  const [name, setName] = useState(initialData?.name || '');
  const [url, setUrl] = useState(initialData?.url || '');
  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive !== undefined ? initialData.isActive : true
  );

  // Initialize Forms List (supports multi-form and legacy single-form sites)
  const initialFormsList: IFormItem[] =
    initialData?.forms && initialData.forms.length > 0
      ? initialData.forms
      : [
          {
            id: 'form-' + Math.random().toString(36).substring(2, 9),
            name: initialData?.name ? `${initialData.name} Form` : 'Primary Contact Form',
            pageUrl: initialData?.url || '',
            formPluginType: initialData?.formPluginType || 'Elementor Pro',
            fields:
              initialData?.fields?.length > 0
                ? initialData.fields
                : FORM_PRESETS['Elementor Pro'].fields,
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
        ];

  const [forms, setForms] = useState<IFormItem[]>(initialFormsList);
  const [activeFormIndex, setActiveFormIndex] = useState<number>(0);

  // Notification Preferences
  const [useGlobalDefaults, setUseGlobalDefaults] = useState(
    initialData?.notificationPreferences?.useGlobalDefaults !== undefined
      ? initialData.notificationPreferences.useGlobalDefaults
      : true
  );
  const [enableEmail, setEnableEmail] = useState(
    initialData?.notificationPreferences?.enableEmail !== undefined
      ? initialData.notificationPreferences.enableEmail
      : true
  );
  const [customEmails, setCustomEmails] = useState(
    initialData?.notificationPreferences?.customEmails?.join(', ') || ''
  );
  const [enableSlack, setEnableSlack] = useState(
    initialData?.notificationPreferences?.enableSlack !== undefined
      ? initialData.notificationPreferences.enableSlack
      : true
  );
  const [customSlackWebhookUrl, setCustomSlackWebhookUrl] = useState(
    initialData?.notificationPreferences?.customSlackWebhookUrl || ''
  );
  const [notifyOnSuccess, setNotifyOnSuccess] = useState(
    initialData?.notificationPreferences?.notifyOnSuccess || false
  );

  // UI States
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [isDetecting, setIsDetecting] = useState(false);
  const [detectMode, setDetectMode] = useState<'single' | 'deep' | null>(null);
  const [detectedFormsList, setDetectedFormsList] = useState<any[]>([]);
  const [checkedDiscoveredIndices, setCheckedDiscoveredIndices] = useState<Record<number, boolean>>({});
  const [testResult, setTestResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [noticeMsg, setNoticeMsg] = useState<string | null>(null);

  // Safe pointer to currently active form
  const activeForm: IFormItem =
    forms[activeFormIndex] ||
    forms[0] || {
      id: 'default',
      name: 'Form',
      pageUrl: url,
      formPluginType: 'Custom',
      fields: [],
      submitButtonSelector: 'button[type="submit"]',
      verificationMethod: 'text_visible',
      expectedSuccessValue: 'Thank you',
      isActive: true,
    };

  // Helper to show temporary flash notice
  const flashNotice = (msg: string) => {
    setNoticeMsg(msg);
    setTimeout(() => setNoticeMsg(null), 5000);
  };

  // Update a property of the currently active form
  const updateActiveForm = (key: keyof IFormItem, value: any) => {
    setForms((prevForms) => {
      const updated = [...prevForms];
      if (updated[activeFormIndex]) {
        updated[activeFormIndex] = {
          ...updated[activeFormIndex],
          [key]: value,
        };
      }
      return updated;
    });
  };

  // Apply a preset to the active form
  const handleApplyPresetToActiveForm = (presetKey: string) => {
    const preset = FORM_PRESETS[presetKey];
    if (!preset) return;

    setForms((prevForms) => {
      const updated = [...prevForms];
      if (updated[activeFormIndex]) {
        updated[activeFormIndex] = {
          ...updated[activeFormIndex],
          formPluginType: preset.pluginType,
          submitButtonSelector: preset.submitButtonSelector,
          verificationMethod: preset.verificationMethod,
          expectedSuccessValue: preset.expectedSuccessValue,
          fields: [...preset.fields],
        };
      }
      return updated;
    });

    flashNotice(`Loaded presets for ${presetKey} into "${activeForm.name}"`);
  };

  // Field Management for Active Form
  const handleAddFieldToActiveForm = () => {
    setForms((prevForms) => {
      const updated = [...prevForms];
      if (updated[activeFormIndex]) {
        const curFields = updated[activeFormIndex].fields || [];
        updated[activeFormIndex] = {
          ...updated[activeFormIndex],
          fields: [
            ...curFields,
            {
              label: 'New Field',
              selector: 'input[name=""]',
              type: 'text',
              testValue: '',
            },
          ],
        };
      }
      return updated;
    });
  };

  const handleUpdateActiveFormField = (
    fIdx: number,
    key: keyof IFormField,
    value: any
  ) => {
    setForms((prevForms) => {
      const updated = [...prevForms];
      if (updated[activeFormIndex]) {
        const curFields = [...(updated[activeFormIndex].fields || [])];
        if (curFields[fIdx]) {
          curFields[fIdx] = { ...curFields[fIdx], [key]: value };
          updated[activeFormIndex] = {
            ...updated[activeFormIndex],
            fields: curFields,
          };
        }
      }
      return updated;
    });
  };

  const handleRemoveActiveFormField = (fIdx: number) => {
    setForms((prevForms) => {
      const updated = [...prevForms];
      if (updated[activeFormIndex]) {
        const curFields = updated[activeFormIndex].fields || [];
        updated[activeFormIndex] = {
          ...updated[activeFormIndex],
          fields: curFields.filter((_, i) => i !== fIdx),
        };
      }
      return updated;
    });
  };

  // Add another form to the website manually
  const handleAddNewForm = () => {
    const newForm: IFormItem = {
      id: 'form-' + Math.random().toString(36).substring(2, 9),
      name: `Form #${forms.length + 1}`,
      pageUrl: url || '',
      formPluginType: 'Elementor Pro',
      fields: [...FORM_PRESETS['Elementor Pro'].fields],
      submitButtonSelector: FORM_PRESETS['Elementor Pro'].submitButtonSelector,
      verificationMethod: FORM_PRESETS['Elementor Pro'].verificationMethod,
      expectedSuccessValue: FORM_PRESETS['Elementor Pro'].expectedSuccessValue,
      isActive: true,
    };

    setForms([...forms, newForm]);
    setActiveFormIndex(forms.length);
    flashNotice(`Added new blank form to "${name || 'Website'}".`);
  };

  // Remove a form from the website
  const handleDeleteForm = (indexToDelete: number) => {
    if (forms.length <= 1) {
      setErrorMsg('A website must have at least one monitored form.');
      return;
    }
    const filtered = forms.filter((_, i) => i !== indexToDelete);
    setForms(filtered);
    if (activeFormIndex >= filtered.length) {
      setActiveFormIndex(filtered.length - 1);
    }
    flashNotice('Form removed from website monitoring.');
  };

  // Crawl & Detect Forms
  const handleAutoDetect = async (isDeep: boolean = false) => {
    if (!url.trim() || !url.startsWith('http')) {
      setErrorMsg('Please enter a valid page or website URL (starting with http:// or https://) first.');
      return;
    }

    setIsDetecting(true);
    setDetectMode(isDeep ? 'deep' : 'single');
    setErrorMsg(null);
    setDetectedFormsList([]);
    setCheckedDiscoveredIndices({});

    try {
      const res = await fetch('/api/sites/inspect-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), deepScan: isDeep }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to inspect website for forms.');
      }

      const discovered = json.forms || (json.data ? [json.data] : []);
      if (discovered.length === 0) {
        throw new Error('No forms detected on this website/page.');
      }

      setDetectedFormsList(discovered);

      // Default check forms that have at least 1 input
      const initialChecked: Record<number, boolean> = {};
      discovered.forEach((df: any, idx: number) => {
        if (df.fields && df.fields.length > 0) {
          initialChecked[idx] = true;
        }
      });
      setCheckedDiscoveredIndices(initialChecked);

      // Auto-suggest website name if empty
      if (!name.trim()) {
        try {
          const parsedUrl = new URL(url.trim());
          const hostParts = parsedUrl.hostname.replace('www.', '').split('.');
          if (hostParts.length > 0) {
            const derived = hostParts[0].charAt(0).toUpperCase() + hostParts[0].slice(1);
            setName(derived);
          }
        } catch {}
      }

      flashNotice(`Discovered ${discovered.length} forms across the website! Select which forms you want to monitor below.`);
    } catch (detectErr: any) {
      setErrorMsg(detectErr.message || 'Auto-detection failed.');
    } finally {
      setIsDetecting(false);
      setDetectMode(null);
    }
  };

  // Toggle checkbox for a discovered form
  const toggleDiscoveredCheck = (idx: number) => {
    setCheckedDiscoveredIndices((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }));
  };

  // Import all checked discovered forms into the website
  const handleImportCheckedForms = () => {
    const selectedForms = detectedFormsList.filter((_, idx) => checkedDiscoveredIndices[idx]);

    if (selectedForms.length === 0) {
      setErrorMsg('Please select at least one form to import.');
      return;
    }

    const convertedForms: IFormItem[] = selectedForms.map((df, i) => {
      const cleanTitle = df.title || `${df.pageTitle || 'Page'} Form #${i + 1}`;
      return {
        id: df.id || 'form-' + Math.random().toString(36).substring(2, 9),
        name: cleanTitle,
        pageUrl: df.pageUrl || url,
        formPluginType: df.detectedPlugin || 'Custom',
        fields: df.fields || [],
        submitButtonSelector: df.submitButtonSelector || 'button[type="submit"]',
        verificationMethod: df.verificationMethod || 'text_visible',
        expectedSuccessValue: df.expectedSuccessValue || 'Thank you',
        isActive: true,
      };
    });

    setForms(convertedForms);
    setActiveFormIndex(0);
    setDetectedFormsList([]); // close the import drawer once imported
    flashNotice(`Successfully imported ${convertedForms.length} forms into ${name || 'Website'}! You can customize each form's fields below.`);
  };

  // Save Website with All Forms
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSaving(true);

    try {
      if (!name.trim()) throw new Error('Site name is required.');
      if (!url.trim()) throw new Error('Website URL is required.');
      if (forms.length === 0) throw new Error('At least one form must be added to the website.');

      // Validate each form
      for (let i = 0; i < forms.length; i++) {
        const f = forms[i];
        if (!f.name?.trim()) throw new Error(`Form #${i + 1} requires a name.`);
        if (!f.pageUrl?.trim()) throw new Error(`Form "${f.name}" requires a page URL.`);
        if (!f.submitButtonSelector?.trim())
          throw new Error(`Form "${f.name}" requires a submit button selector.`);
        if (!f.expectedSuccessValue?.trim())
          throw new Error(`Form "${f.name}" requires an expected verification value.`);
      }

      const primaryForm = forms[0];

      const payload = {
        name: name.trim(),
        url: url.trim(),
        forms,
        // Backward compatibility top-level fields:
        formPluginType: primaryForm.formPluginType,
        fields: primaryForm.fields,
        submitButtonSelector: primaryForm.submitButtonSelector,
        verificationMethod: primaryForm.verificationMethod,
        expectedSuccessValue: primaryForm.expectedSuccessValue,
        isActive,
        notificationPreferences: {
          useGlobalDefaults,
          enableEmail,
          customEmails: customEmails
            .split(',')
            .map((emailStr: string) => emailStr.trim())
            .filter(Boolean),
          enableSlack,
          customSlackWebhookUrl: customSlackWebhookUrl.trim(),
          notifyOnSuccess,
        },
      };

      const endpoint = isEditing ? `/api/sites/${initialData._id}` : '/api/sites';
      const method = isEditing ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to save site configuration.');
      }

      router.push('/');
      router.refresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error saving site.');
    } finally {
      setIsSaving(false);
    }
  };

  // Immediate Test Run on Current Site
  const handleTestNow = async () => {
    if (!initialData?._id) {
      setErrorMsg('Please save the website first before running a live test.');
      return;
    }

    setIsTesting(true);
    setTestResult(null);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/test/run-single', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ siteId: initialData._id }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Test run failed.');
      }

      setTestResult(data.result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Test execution failed.');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8 max-w-5xl mx-auto pb-16">
      {/* Notifications / Error Banner */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-950/60 border border-red-800 text-red-200 flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-sm">
            <span className="font-semibold block">Configuration Error</span>
            <span className="text-xs opacity-90">{errorMsg}</span>
          </div>
        </div>
      )}

      {noticeMsg && (
        <div className="p-4 rounded-xl bg-sky-950/60 border border-sky-800 text-sky-200 flex items-center gap-3 animate-in fade-in duration-300">
          <Sparkles className="w-5 h-5 text-sky-400 shrink-0" />
          <span className="text-sm font-medium">{noticeMsg}</span>
        </div>
      )}

      {/* SECTION 1: Website General Details & Deep Multi-Page Scanner */}
      <div className="bg-surface border border-surface-border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-sky-accent" /> Website Information & Multi-Form Crawler
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Specify the client website. FormGuard Pro will automatically crawl internal pages (Contact, Quote, Services) to find and test all forms.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Client Website Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Skin Creation or Extreme Roofing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent transition-colors"
            />
          </div>

          <div className="space-y-1.5 flex flex-col justify-end">
            <div className="flex items-center gap-2 pb-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="w-4 h-4 rounded border-surface-border text-sky-accent focus:ring-0 bg-navy-800 cursor-pointer"
              />
              <label htmlFor="isActive" className="text-xs text-slate-300 cursor-pointer select-none">
                Active Daily Website Monitoring (include all forms in daily cron runs)
              </label>
            </div>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-300">
                Target Website URL (Homepage or Form Page) <span className="text-red-400">*</span>
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleAutoDetect(false)}
                  disabled={isDetecting || !url.trim()}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] font-semibold text-slate-300 bg-navy-800 hover:bg-surface-hover border border-surface-border transition-all disabled:opacity-40"
                  title="Scan only the specific URL entered below"
                >
                  {isDetecting && detectMode === 'single' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-sky-accent" /> Scanning Page...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3 h-3 text-sky-accent" /> Scan Current Page
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handleAutoDetect(true)}
                  disabled={isDetecting || !url.trim()}
                  className="flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-semibold text-white bg-gradient-to-r from-sky-accent/80 to-teal-light/80 hover:from-sky-accent hover:to-teal-light border border-sky-accent/40 shadow-sm transition-all disabled:opacity-40"
                  title="Crawl internal pages (Contact, Quote, Services) to find all forms on the entire site"
                >
                  {isDetecting && detectMode === 'deep' ? (
                    <>
                      <Loader2 className="w-3 h-3 animate-spin text-white" /> Crawling All Pages...
                    </>
                  ) : (
                    <>
                      <Globe className="w-3.5 h-3.5 text-white" /> 🌐 Deep Crawl Entire Website
                    </>
                  )}
                </button>
              </div>
            </div>
            <input
              type="url"
              required
              placeholder="https://example.com/ (Enter homepage URL)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent transition-colors"
            />
            <p className="text-[11px] text-slate-400">
              💡 Tip: Enter the homepage URL and click <strong>&quot;Deep Crawl Entire Website&quot;</strong>. FormGuard will crawl all sub-pages and allow you to monitor all client contact forms in 1 click!
            </p>

            {/* Live Detected Forms Checklist Drawer */}
            {detectedFormsList.length > 0 && (
              <div className="pt-3 p-4 bg-navy-950 border border-sky-accent/30 rounded-xl space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border pb-2.5">
                  <div>
                    <span className="text-xs font-bold text-sky-accent flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" /> Discovered Forms across Website ({detectedFormsList.length})
                    </span>
                    <p className="text-[11px] text-slate-400">
                      Check the forms you want to monitor, then click &quot;Import Selected Forms&quot;.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleImportCheckedForms}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold text-navy-900 bg-sky-accent hover:bg-sky-400 shadow transition-all"
                  >
                    <Plus className="w-3.5 h-3.5 stroke-[3]" /> Import Selected Forms (
                    {Object.values(checkedDiscoveredIndices).filter(Boolean).length})
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
                  {detectedFormsList.map((df, fIdx) => {
                    const isChecked = !!checkedDiscoveredIndices[fIdx];
                    return (
                      <div
                        key={df.id || fIdx}
                        onClick={() => toggleDiscoveredCheck(fIdx)}
                        className={`p-3 rounded-lg border text-left cursor-pointer transition-all flex items-start gap-2.5 ${
                          isChecked
                            ? 'bg-sky-accent/15 border-sky-accent text-white shadow-sm'
                            : 'bg-navy-900/60 border-surface-border text-slate-400 opacity-75 hover:opacity-100'
                        }`}
                      >
                        <div className="pt-0.5 shrink-0">
                          {isChecked ? (
                            <CheckSquare className="w-4 h-4 text-sky-accent" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-500" />
                          )}
                        </div>

                        <div className="space-y-0.5 overflow-hidden flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-xs font-bold text-white truncate max-w-[200px]">
                              {df.title || `Form #${fIdx + 1}`}
                            </span>
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-surface border border-surface-border text-sky-accent font-medium">
                              {df.detectedPlugin}
                            </span>
                            {df.occurrences && df.occurrences > 1 && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 font-medium">
                                Shared across {df.occurrences} pages
                              </span>
                            )}
                          </div>

                          {df.pageTitle && (
                            <div className="text-[11px] text-teal-light font-medium truncate">
                              📄 {df.pageTitle}
                            </div>
                          )}

                          {df.pageUrl && (
                            <div className="text-[10px] text-slate-400 truncate max-w-[280px]">
                              🔗 {df.pageUrl}
                            </div>
                          )}

                          <div className="text-[10px] text-slate-300 pt-0.5">
                            <strong>{df.fields?.length || 0} inputs:</strong>{' '}
                            {df.fields?.map((f: any) => f.label).filter(Boolean).slice(0, 4).join(', ')}
                            {df.fields?.length > 4 ? '...' : ''}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION 2: Monitored Forms Manager (Hierarchical Multi-Form) */}
      <div className="bg-surface border border-surface-border rounded-xl p-6 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Layers className="w-5 h-5 text-teal-light" /> Monitored Forms on this Website ({forms.length})
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              All active forms below will be filled and tested during daily monitoring or when you click &quot;Test Now&quot;.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddNewForm}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-navy-800 text-sky-accent border border-surface-border hover:bg-surface-hover transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Another Form to Website
          </button>
        </div>

        {/* Tab Strip to switch between forms */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-surface-border">
          {forms.map((formItem, idx) => {
            const isActiveTab = activeFormIndex === idx;
            return (
              <div
                key={formItem.id || idx}
                onClick={() => setActiveFormIndex(idx)}
                className={`flex items-center gap-2 px-3.5 py-2 rounded-t-lg border-t border-x cursor-pointer text-xs font-semibold transition-all shrink-0 ${
                  isActiveTab
                    ? 'bg-navy-900 border-sky-accent text-white shadow-sm'
                    : 'bg-navy-800/60 border-surface-border text-slate-400 hover:text-slate-200'
                }`}
              >
                <span className="flex items-center gap-1.5">
                  <span
                    className={`w-2 h-2 rounded-full ${
                      formItem.isActive ? 'bg-emerald-400' : 'bg-slate-500'
                    }`}
                  />
                  {formItem.name || `Form #${idx + 1}`}
                </span>

                <span className="text-[10px] px-1 py-0.2 rounded bg-surface border border-surface-border text-slate-400">
                  {formItem.fields?.length || 0} inputs
                </span>

                {forms.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteForm(idx);
                    }}
                    className="p-1 hover:text-red-400 rounded transition-colors ml-1"
                    title="Remove this form from website"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Active Form Settings Panel */}
        <div className="bg-navy-900 border border-surface-border rounded-xl p-5 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-surface-border pb-3">
            <span className="text-xs font-bold text-sky-accent uppercase tracking-wider flex items-center gap-1.5">
              <Settings className="w-3.5 h-3.5" /> Editing Settings for: &quot;{activeForm.name}&quot;
            </span>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="activeFormToggle"
                checked={activeForm.isActive !== false}
                onChange={(e) => updateActiveForm('isActive', e.target.checked)}
                className="w-4 h-4 rounded border-surface-border text-sky-accent focus:ring-0 bg-navy-800 cursor-pointer"
              />
              <label htmlFor="activeFormToggle" className="text-xs text-slate-300 cursor-pointer select-none">
                Enable daily testing for this form
              </label>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Form Name / Label <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="e.g. Contact Us Form"
                value={activeForm.name}
                onChange={(e) => updateActiveForm('name', e.target.value)}
                className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-accent transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Form Plugin Type
              </label>
              <select
                value={activeForm.formPluginType}
                onChange={(e) => updateActiveForm('formPluginType', e.target.value)}
                className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-accent transition-colors"
              >
                <option value="Elementor Pro">Elementor Pro</option>
                <option value="Contact Form 7">Contact Form 7</option>
                <option value="MetForm">MetForm</option>
                <option value="WPForms">WPForms</option>
                <option value="Gravity Forms">Gravity Forms</option>
                <option value="Custom">Custom / Other</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Exact Page URL where Form Lives <span className="text-red-400">*</span>
              </label>
              <input
                type="url"
                required
                placeholder="https://example.com/contact-us"
                value={activeForm.pageUrl}
                onChange={(e) => updateActiveForm('pageUrl', e.target.value)}
                className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-accent transition-colors"
              />
            </div>
          </div>

          {/* Quick Preset loader for this specific form */}
          <div className="pt-1 flex items-center gap-2 flex-wrap text-xs text-slate-400">
            <span>Apply Preset to this form:</span>
            {Object.keys(FORM_PRESETS).map((pKey) => (
              <button
                key={pKey}
                type="button"
                onClick={() => handleApplyPresetToActiveForm(pKey)}
                className="px-2 py-0.5 rounded bg-navy-800 border border-surface-border hover:border-sky-accent text-slate-300 text-[11px] transition-colors"
              >
                {pKey}
              </button>
            ))}
          </div>

          {/* Form Fields Builder for Active Form */}
          <div className="pt-2 space-y-3">
            <div className="flex items-center justify-between border-t border-surface-border pt-4">
              <div>
                <h3 className="text-sm font-semibold text-white">Form Inputs & Test Values</h3>
                <p className="text-[11px] text-slate-400">
                  Inputs that Playwright will automatically fill or select for this form.
                </p>
              </div>
              <button
                type="button"
                onClick={handleAddFieldToActiveForm}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-navy-800 text-sky-accent border border-surface-border hover:bg-surface-hover transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Add Input Field
              </button>
            </div>

            <div className="space-y-2.5">
              {activeForm.fields && activeForm.fields.length > 0 ? (
                activeForm.fields.map((field, fIdx) => (
                  <div
                    key={fIdx}
                    className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-navy-800/80 border border-surface-border p-3 rounded-lg items-center"
                  >
                    <div className="sm:col-span-3">
                      <label className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                        Label
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Your Name"
                        value={field.label}
                        onChange={(e) => handleUpdateActiveFormField(fIdx, 'label', e.target.value)}
                        className="w-full bg-navy-900 border border-surface-border rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-accent"
                      />
                    </div>

                    <div className="sm:col-span-4">
                      <label className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                        CSS Selector
                      </label>
                      <input
                        type="text"
                        placeholder='input[name="your-name"]'
                        value={field.selector}
                        onChange={(e) => handleUpdateActiveFormField(fIdx, 'selector', e.target.value)}
                        className="w-full bg-navy-900 border border-surface-border rounded px-2.5 py-1.5 text-xs font-mono text-sky-accent focus:outline-none focus:border-sky-accent"
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                        Type
                      </label>
                      <select
                        value={field.type}
                        onChange={(e) => handleUpdateActiveFormField(fIdx, 'type', e.target.value)}
                        className="w-full bg-navy-900 border border-surface-border rounded px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-accent"
                      >
                        <option value="text">Text</option>
                        <option value="email">Email</option>
                        <option value="tel">Tel</option>
                        <option value="textarea">Textarea</option>
                        <option value="select">Select</option>
                        <option value="checkbox">Checkbox</option>
                      </select>
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[10px] text-slate-400 block mb-0.5 uppercase tracking-wider font-semibold">
                        Test Value
                      </label>
                      <input
                        type="text"
                        placeholder="Value to fill"
                        value={field.testValue}
                        onChange={(e) => handleUpdateActiveFormField(fIdx, 'testValue', e.target.value)}
                        className="w-full bg-navy-900 border border-surface-border rounded px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-accent"
                      />
                    </div>

                    <div className="sm:col-span-1 flex justify-end pt-3 sm:pt-0">
                      <button
                        type="button"
                        onClick={() => handleRemoveActiveFormField(fIdx)}
                        className="p-1.5 text-slate-400 hover:text-red-400 rounded hover:bg-navy-900 transition-colors"
                        title="Remove field"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-6 border border-dashed border-surface-border rounded-lg text-slate-500 text-xs">
                  No input fields configured yet. Click &quot;Add Input Field&quot; or choose a preset above.
                </div>
              )}
            </div>
          </div>

          {/* Submission & Verification for Active Form */}
          <div className="border-t border-surface-border pt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Submit Button Selector <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder='button[type="submit"]'
                value={activeForm.submitButtonSelector}
                onChange={(e) => updateActiveForm('submitButtonSelector', e.target.value)}
                className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-accent transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Verification Method
              </label>
              <select
                value={activeForm.verificationMethod}
                onChange={(e) => updateActiveForm('verificationMethod', e.target.value)}
                className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-accent transition-colors"
              >
                <option value="text_visible">Text Appears on Page</option>
                <option value="selector_visible">CSS Selector Appears (e.g. .success-msg)</option>
                <option value="url_redirect">URL Redirects to (Thank You Page)</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-slate-300">
                Expected Success Value <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                required
                placeholder="Thank you for your message"
                value={activeForm.expectedSuccessValue}
                onChange={(e) => updateActiveForm('expectedSuccessValue', e.target.value)}
                className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-xs text-slate-100 focus:outline-none focus:border-sky-accent transition-colors"
              />
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: Notification Preferences */}
      <div className="bg-surface border border-surface-border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-sky-accent" /> Alert & Notification Routing
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Choose where failure alerts (and screenshots) are sent if any form on this website breaks.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="useGlobalDefaults"
              checked={useGlobalDefaults}
              onChange={(e) => setUseGlobalDefaults(e.target.checked)}
              className="w-4 h-4 rounded border-surface-border text-sky-accent focus:ring-0 bg-navy-800 cursor-pointer"
            />
            <label htmlFor="useGlobalDefaults" className="text-sm font-medium text-slate-200 cursor-pointer select-none">
              Use Global Notification Defaults (Configured in Settings)
            </label>
          </div>

          {!useGlobalDefaults && (
            <div className="p-4 rounded-xl bg-navy-800/80 border border-surface-border space-y-4 animate-in fade-in duration-200">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enableEmail"
                      checked={enableEmail}
                      onChange={(e) => setEnableEmail(e.target.checked)}
                      className="w-4 h-4 rounded border-surface-border text-sky-accent focus:ring-0 bg-navy-900 cursor-pointer"
                    />
                    <label htmlFor="enableEmail" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer">
                      <Mail className="w-3.5 h-3.5 text-sky-accent" /> Enable Custom Email Alerts
                    </label>
                  </div>
                  <input
                    type="text"
                    disabled={!enableEmail}
                    placeholder="client-support@agency.com, alerts@site.com"
                    value={customEmails}
                    onChange={(e) => setCustomEmails(e.target.value)}
                    className="w-full bg-navy-900 border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 disabled:opacity-40 focus:outline-none focus:border-sky-accent"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="enableSlack"
                      checked={enableSlack}
                      onChange={(e) => setEnableSlack(e.target.checked)}
                      className="w-4 h-4 rounded border-surface-border text-sky-accent focus:ring-0 bg-navy-900 cursor-pointer"
                    />
                    <label htmlFor="enableSlack" className="text-xs font-semibold text-slate-300 flex items-center gap-1.5 cursor-pointer">
                      <MessageSquare className="w-3.5 h-3.5 text-amber-400" /> Enable Custom Slack Webhook
                    </label>
                  </div>
                  <input
                    type="url"
                    disabled={!enableSlack}
                    placeholder="https://hooks.slack.com/services/..."
                    value={customSlackWebhookUrl}
                    onChange={(e) => setCustomSlackWebhookUrl(e.target.value)}
                    className="w-full bg-navy-900 border border-surface-border rounded-lg px-3 py-2 text-xs text-slate-100 disabled:opacity-40 focus:outline-none focus:border-sky-accent"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="notifyOnSuccess"
              checked={notifyOnSuccess}
              onChange={(e) => setNotifyOnSuccess(e.target.checked)}
              className="w-4 h-4 rounded border-surface-border text-sky-accent focus:ring-0 bg-navy-800 cursor-pointer"
            />
            <label htmlFor="notifyOnSuccess" className="text-xs text-slate-400 cursor-pointer select-none">
              Notify on passed tests as well (Default: only alert on form failures)
            </label>
          </div>
        </div>
      </div>

      {/* ACTION BAR: Save & Immediate Test */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-4 border-t border-surface-border">
        {isEditing && (
          <button
            type="button"
            onClick={handleTestNow}
            disabled={isTesting || isSaving}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-bold bg-navy-800 hover:bg-surface-hover text-sky-accent border border-sky-accent/30 shadow transition-all disabled:opacity-50"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-sky-accent" /> Testing All Forms...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-sky-accent text-sky-accent" /> Test All {forms.length} Forms Now
              </>
            )}
          </button>
        )}

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end ml-auto">
          <button
            type="button"
            onClick={() => router.push('/')}
            className="px-4 py-2.5 rounded-lg text-xs font-medium text-slate-400 hover:text-white border border-surface-border bg-navy-800 hover:bg-surface-hover transition-colors"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSaving || isTesting}
            className="flex items-center justify-center gap-2 px-6 py-2.5 rounded-lg text-xs font-bold text-navy-900 bg-gradient-to-r from-sky-accent to-teal-light hover:brightness-110 shadow-lg shadow-sky-accent/20 transition-all disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving Website...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 stroke-[2.5]" /> Save Website & All {forms.length} Forms
              </>
            )}
          </button>
        </div>
      </div>

      {/* Live Inline Test Result Modal / Banner if tested */}
      {testResult && (
        <div
          className={`p-5 rounded-xl border space-y-3 ${
            testResult.status === 'passed'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-100'
              : 'bg-red-950/40 border-red-800 text-red-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="font-bold text-sm flex items-center gap-2">
              {testResult.status === 'passed' ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-400" />
              )}
              Live Multi-Form Test Result: {testResult.status.toUpperCase()} ({testResult.durationMs}ms)
            </span>
            <span className="text-xs opacity-75">
              {testResult.formResults?.filter((fr: any) => fr.status === 'passed').length}/
              {testResult.formResults?.length || 1} forms passed
            </span>
          </div>

          {testResult.formResults && testResult.formResults.length > 0 && (
            <div className="space-y-1.5 pt-2">
              {testResult.formResults.map((fr: any, idx: number) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-2 rounded bg-navy-900/60 border border-surface-border text-xs"
                >
                  <span className="font-medium text-white">{fr.formName}</span>
                  <span
                    className={`font-bold text-[10px] px-2 py-0.5 rounded ${
                      fr.status === 'passed'
                        ? 'bg-emerald-500/20 text-emerald-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
                  >
                    {fr.status.toUpperCase()} ({fr.durationMs}ms)
                  </span>
                </div>
              ))}
            </div>
          )}

          {testResult.errorMessage && (
            <p className="text-xs font-mono text-red-300 pt-1">{testResult.errorMessage}</p>
          )}
        </div>
      )}
    </form>
  );
}
