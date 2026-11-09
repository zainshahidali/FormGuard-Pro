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
} from 'lucide-react';
import { FORM_PRESETS } from '@/lib/presets';
import { IFormField } from '@/models/Site';

interface SiteFormProps {
  initialData?: any;
  isEditing?: boolean;
}

export default function SiteForm({ initialData, isEditing = false }: SiteFormProps) {
  const router = useRouter();

  // Basic Info
  const [name, setName] = useState(initialData?.name || '');
  const [url, setUrl] = useState(initialData?.url || '');
  const [formPluginType, setFormPluginType] = useState<string>(
    initialData?.formPluginType || 'Elementor Pro'
  );
  const [isActive, setIsActive] = useState<boolean>(
    initialData?.isActive !== undefined ? initialData.isActive : true
  );

  // Form Fields
  const [fields, setFields] = useState<IFormField[]>(
    initialData?.fields?.length > 0
      ? initialData.fields
      : FORM_PRESETS['Elementor Pro'].fields
  );

  // Submission & Verification
  const [submitButtonSelector, setSubmitButtonSelector] = useState(
    initialData?.submitButtonSelector || FORM_PRESETS['Elementor Pro'].submitButtonSelector
  );
  const [verificationMethod, setVerificationMethod] = useState<'text_visible' | 'selector_visible' | 'url_redirect'>(
    initialData?.verificationMethod || FORM_PRESETS['Elementor Pro'].verificationMethod
  );
  const [expectedSuccessValue, setExpectedSuccessValue] = useState(
    initialData?.expectedSuccessValue || FORM_PRESETS['Elementor Pro'].expectedSuccessValue
  );

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
  const [selectedFormIndex, setSelectedFormIndex] = useState<number | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [presetNotice, setPresetNotice] = useState<string | null>(null);

  // Apply a selected detected form
  const applyDetectedForm = (form: any, index: number) => {
    setSelectedFormIndex(index);
    if (form.pageUrl && form.pageUrl !== url) {
      setUrl(form.pageUrl);
    }
    if (form.detectedPlugin) {
      setFormPluginType(form.detectedPlugin);
    }
    if (form.fields && form.fields.length > 0) {
      setFields(form.fields);
    }
    if (form.submitButtonSelector) {
      setSubmitButtonSelector(form.submitButtonSelector);
    }
    if (form.verificationMethod) {
      setVerificationMethod(form.verificationMethod);
    }
    if (form.expectedSuccessValue) {
      setExpectedSuccessValue(form.expectedSuccessValue);
    }

    setPresetNotice(
      `✨ Loaded form "${form.title || form.detectedPlugin}" from ${form.pageTitle ? `"${form.pageTitle}"` : form.pageUrl || 'page'} with ${form.fields?.length || 0} input fields! Check the fields below to customize test values.`
    );
    setTimeout(() => setPresetNotice(null), 6000);
  };

  // Auto-Detect all form fields and selectors from live URL using Playwright
  const handleAutoDetect = async (isDeep: boolean = false) => {
    if (!url.trim() || !url.startsWith('http')) {
      setErrorMsg('Please enter a valid page or website URL (starting with http:// or https://) first.');
      return;
    }

    setIsDetecting(true);
    setDetectMode(isDeep ? 'deep' : 'single');
    setErrorMsg(null);
    setDetectedFormsList([]);
    setSelectedFormIndex(null);

    try {
      const res = await fetch('/api/sites/inspect-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), deepScan: isDeep }),
      });

      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.error || 'Failed to inspect page form.');
      }

      const forms = json.forms || (json.data ? [json.data] : []);
      if (forms.length === 0) {
        throw new Error('No forms detected on this website/page.');
      }

      setDetectedFormsList(forms);

      // Auto-populate the first form immediately
      applyDetectedForm(forms[0], 0);

      // Auto-suggest name from domain if empty
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
    } catch (detectErr: any) {
      setErrorMsg(detectErr.message || 'Auto-detection failed.');
    } finally {
      setIsDetecting(false);
      setDetectMode(null);
    }
  };

  // Apply Preset
  const handleApplyPreset = (presetKey: string) => {
    const preset = FORM_PRESETS[presetKey];
    if (!preset) return;

    setFormPluginType(preset.pluginType);
    setSubmitButtonSelector(preset.submitButtonSelector);
    setVerificationMethod(preset.verificationMethod);
    setExpectedSuccessValue(preset.expectedSuccessValue);
    setFields([...preset.fields]);

    setPresetNotice(`Loaded standard presets for ${presetKey}`);
    setTimeout(() => setPresetNotice(null), 4000);
  };

  // Field Management
  const handleAddField = () => {
    setFields([
      ...fields,
      {
        label: 'New Field',
        selector: 'input[name=""]',
        type: 'text',
        testValue: '',
      },
    ]);
  };

  const handleUpdateField = (index: number, key: keyof IFormField, value: any) => {
    const updated = [...fields];
    updated[index] = { ...updated[index], [key]: value };
    setFields(updated);
  };

  const handleRemoveField = (index: number) => {
    setFields(fields.filter((_, i) => i !== index));
  };

  // Save Site
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setIsSaving(true);

    try {
      if (!name.trim()) throw new Error('Site name is required.');
      if (!url.trim()) throw new Error('Target form URL is required.');
      if (!submitButtonSelector.trim()) throw new Error('Submit button selector is required.');
      if (!expectedSuccessValue.trim()) throw new Error('Expected success verification value is required.');

      const payload = {
        name: name.trim(),
        url: url.trim(),
        formPluginType,
        fields,
        submitButtonSelector: submitButtonSelector.trim(),
        verificationMethod,
        expectedSuccessValue: expectedSuccessValue.trim(),
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
      {/* Preset Banner Notice */}
      {presetNotice && (
        <div className="bg-sky-500/15 border border-sky-500/30 p-3.5 rounded-lg text-sky-accent text-sm flex items-center gap-2 animate-in fade-in duration-200">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>{presetNotice}</span>
        </div>
      )}

      {errorMsg && (
        <div className="bg-red-950/60 border border-red-800 p-4 rounded-lg text-red-200 text-sm flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-semibold block">Configuration Error</span>
            <span className="text-xs opacity-90">{errorMsg}</span>
          </div>
        </div>
      )}

      {/* SECTION 1: Site General Details & Preset Quick-Select */}
      <div className="bg-surface border border-surface-border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-sky-accent" /> Website Information & Preset Helper
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Specify the client WordPress URL and optionally select a plugin preset to pre-fill common selectors.
          </p>
        </div>

        {/* Preset Selector Buttons */}
        <div className="space-y-2">
          <label className="text-xs font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-sky-accent" /> Auto-Populate Plugin Presets
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {Object.keys(FORM_PRESETS).map((presetKey) => (
              <button
                key={presetKey}
                type="button"
                onClick={() => handleApplyPreset(presetKey)}
                className={`px-3 py-2 rounded-lg text-xs font-medium border text-center transition-all ${
                  formPluginType === presetKey
                    ? 'bg-sky-accent/20 border-sky-accent text-sky-accent shadow-sm'
                    : 'bg-navy-800 border-surface-border text-slate-300 hover:border-slate-500 hover:text-white'
                }`}
              >
                {presetKey}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Site Name <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Stow Line Roofing"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent transition-colors"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Form Plugin Type
            </label>
            <select
              value={formPluginType}
              onChange={(e) => setFormPluginType(e.target.value)}
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

          <div className="md:col-span-2 space-y-1.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="text-xs font-medium text-slate-300">
                Target Website / Page URL <span className="text-red-400">*</span>
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
                      <Loader2 className="w-3 h-3 animate-spin text-white" /> Crawling Entire Website...
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
              placeholder="https://example.com/ (Enter homepage or specific page URL)"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent transition-colors"
            />
            <p className="text-[11px] text-slate-400">
              💡 Tip: Enter the homepage URL and click <strong>&quot;Deep Crawl Entire Website&quot;</strong> to automatically scan all pages (Contact, Services, Quotes) and list every form found.
            </p>

            {/* Live Detected Forms Picker */}
            {detectedFormsList.length > 0 && (
              <div className="pt-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-sky-accent flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5" /> Discovered Forms ({detectedFormsList.length})
                  </span>
                  <span className="text-[11px] text-slate-400">
                    Click any form to auto-load its page URL, plugin type & fields
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {detectedFormsList.map((df, fIdx) => (
                    <button
                      key={df.id || fIdx}
                      type="button"
                      onClick={() => applyDetectedForm(df, fIdx)}
                      className={`p-3.5 rounded-lg border text-left transition-all flex items-start justify-between gap-3 ${
                        selectedFormIndex === fIdx
                          ? 'bg-sky-accent/20 border-sky-accent text-white shadow-md ring-1 ring-sky-accent/40'
                          : 'bg-navy-900 border-surface-border hover:border-slate-500 text-slate-300'
                      }`}
                    >
                      <div className="space-y-1 overflow-hidden flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-white truncate max-w-[200px]">
                            {df.title || `Form #${fIdx + 1}`}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-surface-border text-sky-accent font-medium">
                            {df.detectedPlugin}
                          </span>
                        </div>

                        {df.pageTitle && (
                          <div className="flex items-center gap-1 text-[11px] text-teal-light font-medium truncate">
                            <span>📄 Page: {df.pageTitle}</span>
                          </div>
                        )}

                        {df.pageUrl && (
                          <div className="text-[10px] text-slate-400 truncate max-w-[280px]">
                            🔗 {df.pageUrl}
                          </div>
                        )}

                        <div className="text-[11px] text-slate-300 pt-1 flex items-center gap-1.5">
                          <span className="font-semibold text-white">{df.fields?.length || 0} inputs:</span>
                          <span className="text-slate-400 truncate max-w-[220px]">
                            {df.fields?.map((f: any) => f.label).filter(Boolean).join(', ')}
                          </span>
                        </div>
                      </div>

                      {selectedFormIndex === fIdx ? (
                        <div className="shrink-0 flex items-center gap-1 bg-sky-accent text-white text-[10px] font-bold px-2 py-0.5 rounded shadow">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Selected
                        </div>
                      ) : (
                        <span className="shrink-0 text-[10px] text-slate-400 border border-surface-border px-2 py-0.5 rounded hover:border-slate-400">
                          Select
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="md:col-span-2 flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 rounded border-surface-border text-sky-accent focus:ring-0 bg-navy-800 cursor-pointer"
            />
            <label htmlFor="isActive" className="text-xs text-slate-300 cursor-pointer select-none">
              Active Daily Form Monitoring (include this site in daily cron runs)
            </label>
          </div>
        </div>
      </div>

      {/* SECTION 2: Dynamic Form Field Builder */}
      <div className="bg-surface border border-surface-border rounded-xl p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Settings className="w-5 h-5 text-teal-light" /> Form Fields Configuration
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Add inputs for Playwright to locate, fill, or toggle on the page.
            </p>
          </div>
          <button
            type="button"
            onClick={handleAddField}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-navy-800 text-sky-accent border border-surface-border hover:bg-surface-hover transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Field
          </button>
        </div>

        <div className="space-y-3">
          {fields.map((field, idx) => (
            <div
              key={idx}
              className="p-3.5 rounded-lg bg-navy-800 border border-surface-border grid grid-cols-1 sm:grid-cols-12 gap-3 items-center"
            >
              <div className="sm:col-span-3">
                <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Label
                </label>
                <input
                  type="text"
                  placeholder="e.g. Name"
                  value={field.label}
                  onChange={(e) => handleUpdateField(idx, 'label', e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-accent"
                />
              </div>

              <div className="sm:col-span-4">
                <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  CSS Selector
                </label>
                <input
                  type="text"
                  placeholder='input[name="form_fields[name]"]'
                  value={field.selector}
                  onChange={(e) => handleUpdateField(idx, 'selector', e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs font-mono text-slate-100 focus:outline-none focus:border-sky-accent"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-[10px] uppercase font-semibold text-slate-400 block mb-1">
                  Type
                </label>
                <select
                  value={field.type}
                  onChange={(e) => handleUpdateField(idx, 'type', e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded px-2 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-accent"
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
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[10px] uppercase font-semibold text-slate-400 block">
                    Test Value
                  </label>
                  {field.type === 'select' && (
                    <button
                      type="button"
                      onClick={() => handleUpdateField(idx, 'testValue', '[Random Option]')}
                      className="text-[9px] text-sky-accent hover:underline font-semibold"
                      title="Set to dynamically pick a random live option from the dropdown"
                    >
                      Random
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder={field.type === 'select' ? '[Random Option]' : 'Test string'}
                  value={field.testValue}
                  onChange={(e) => handleUpdateField(idx, 'testValue', e.target.value)}
                  className="w-full bg-surface border border-surface-border rounded px-2.5 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-sky-accent"
                />
              </div>

              <div className="sm:col-span-1 flex justify-end sm:pt-4">
                <button
                  type="button"
                  onClick={() => handleRemoveField(idx)}
                  className="text-slate-500 hover:text-red-400 p-1.5 rounded transition-colors"
                  title="Remove field"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {fields.some((f) => f.type === 'select') && (
            <div className="p-3 bg-navy-900/60 rounded-lg border border-surface-border text-xs text-slate-300 flex items-center gap-2">
              <span className="text-sky-accent font-semibold shrink-0">💡 Dropdown Tip:</span>
              <span>
                For <strong>Select</strong> inputs, keeping Test Value as <code className="text-amber-300 font-mono">[Random Option]</code> tells Playwright to automatically pick an available option randomly from the live website dropdown on every test run!
              </span>
            </div>
          )}

          {fields.length === 0 && (
            <div className="p-6 text-center text-xs text-slate-400 bg-navy-800 rounded-lg border border-surface-border">
              No fields configured yet. Click &quot;Add Field&quot; or choose a preset above.
            </div>
          )}
        </div>
      </div>

      {/* SECTION 3: Submit Button & Verification Method */}
      <div className="bg-surface border border-surface-border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white">Submission & Success Verification</h2>
          <p className="text-xs text-slate-400 mt-1">
            Specify how Playwright should submit the form and confirm success.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Submit Button Selector <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder='button[type="submit"], input[type="submit"]'
              value={submitButtonSelector}
              onChange={(e) => setSubmitButtonSelector(e.target.value)}
              className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm font-mono text-slate-100 focus:outline-none focus:border-sky-accent"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Verification Method
            </label>
            <select
              value={verificationMethod}
              onChange={(e) => setVerificationMethod(e.target.value as any)}
              className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-accent"
            >
              <option value="text_visible">Text is Visible on Page (e.g. &quot;Thank you&quot;)</option>
              <option value="selector_visible">CSS Selector Appears (e.g. &quot;.elementor-message-success&quot;)</option>
              <option value="url_redirect">URL Redirects to (e.g. &quot;/thank-you&quot;)</option>
            </select>
          </div>

          <div className="md:col-span-2 space-y-1.5">
            <label className="text-xs font-medium text-slate-300">
              Expected Success Value <span className="text-red-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder={
                verificationMethod === 'selector_visible'
                  ? '.elementor-message-success, .wpcf7-mail-sent-ok'
                  : verificationMethod === 'url_redirect'
                  ? '/thank-you'
                  : 'Thank you for your message'
              }
              value={expectedSuccessValue}
              onChange={(e) => setExpectedSuccessValue(e.target.value)}
              className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 focus:outline-none focus:border-sky-accent"
            />
            <p className="text-[11px] text-slate-400">
              Playwright waits up to 15 seconds after submission for this condition to be verified.
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 4: Per-Site Notification Routing */}
      <div className="bg-surface border border-surface-border rounded-xl p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Bell className="w-5 h-5 text-sky-accent" /> Notification & Alert Routing
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Choose whether to route alerts to global agency defaults or site-specific client channels.
          </p>
        </div>

        {/* Global vs Custom Toggle */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <label
            className={`p-4 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
              useGlobalDefaults
                ? 'bg-sky-accent/10 border-sky-accent'
                : 'bg-navy-800 border-surface-border text-slate-300'
            }`}
          >
            <input
              type="radio"
              name="routingMode"
              checked={useGlobalDefaults}
              onChange={() => setUseGlobalDefaults(true)}
              className="mt-1 text-sky-accent focus:ring-0"
            />
            <div>
              <span className="text-sm font-semibold text-white block">Use Global Agency Defaults</span>
              <span className="text-xs text-slate-400 mt-0.5 block">
                Dispatches to the email addresses and Slack webhook configured under Global Settings.
              </span>
            </div>
          </label>

          <label
            className={`p-4 rounded-lg border cursor-pointer transition-all flex items-start gap-3 ${
              !useGlobalDefaults
                ? 'bg-sky-accent/10 border-sky-accent'
                : 'bg-navy-800 border-surface-border text-slate-300'
            }`}
          >
            <input
              type="radio"
              name="routingMode"
              checked={!useGlobalDefaults}
              onChange={() => setUseGlobalDefaults(false)}
              className="mt-1 text-sky-accent focus:ring-0"
            />
            <div>
              <span className="text-sm font-semibold text-white block">Custom Site Channels</span>
              <span className="text-xs text-slate-400 mt-0.5 block">
                Route failures directly to this client&apos;s designated team email and specific Slack channel.
              </span>
            </div>
          </label>
        </div>

        {/* Channel Toggles */}
        <div className="flex flex-wrap gap-6 pt-2">
          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-200">
            <input
              type="checkbox"
              checked={enableEmail}
              onChange={(e) => setEnableEmail(e.target.checked)}
              className="w-4 h-4 rounded border-surface-border text-sky-accent focus:ring-0 bg-navy-800"
            />
            <Mail className="w-4 h-4 text-sky-accent" /> Enable Email Alerts
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-200">
            <input
              type="checkbox"
              checked={enableSlack}
              onChange={(e) => setEnableSlack(e.target.checked)}
              className="w-4 h-4 rounded border-surface-border text-sky-accent focus:ring-0 bg-navy-800"
            />
            <MessageSquare className="w-4 h-4 text-amber-400" /> Enable Slack Alerts
          </label>

          <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-slate-200">
            <input
              type="checkbox"
              checked={notifyOnSuccess}
              onChange={(e) => setNotifyOnSuccess(e.target.checked)}
              className="w-4 h-4 rounded border-surface-border text-sky-accent focus:ring-0 bg-navy-800"
            />
            Notify on Success as well (Default: only alert on failure)
          </label>
        </div>

        {/* Custom Channels Inputs */}
        {!useGlobalDefaults && (
          <div className="space-y-4 pt-2 border-t border-surface-border">
            {enableEmail && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Custom Recipient Email Addresses (comma-separated)
                </label>
                <input
                  type="text"
                  placeholder="client@company.com, tech@company.com"
                  value={customEmails}
                  onChange={(e) => setCustomEmails(e.target.value)}
                  className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent"
                />
              </div>
            )}

            {enableSlack && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-300">
                  Custom Slack Incoming Webhook URL for this Site
                </label>
                <input
                  type="url"
                  placeholder="https://hooks.slack.com/services/..."
                  value={customSlackWebhookUrl}
                  onChange={(e) => setCustomSlackWebhookUrl(e.target.value)}
                  className="w-full bg-navy-800 border border-surface-border rounded-lg px-3.5 py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-accent"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* Test Result Display if Live Tested */}
      {testResult && (
        <div
          className={`p-4 rounded-xl border ${
            testResult.status === 'passed'
              ? 'bg-emerald-950/40 border-emerald-800 text-emerald-200'
              : 'bg-red-950/40 border-red-800 text-red-200'
          }`}
        >
          <div className="flex items-center gap-2 font-semibold text-sm">
            {testResult.status === 'passed' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400" />
            ) : (
              <AlertCircle className="w-5 h-5 text-red-400" />
            )}
            Live Test {testResult.status.toUpperCase()} ({testResult.durationMs}ms)
          </div>
          {testResult.errorMessage && (
            <div className="mt-2 text-xs font-mono bg-navy-900/80 p-3 rounded border border-surface-border">
              {testResult.errorMessage}
            </div>
          )}
        </div>
      )}

      {/* Form Action Buttons */}
      <div className="flex items-center justify-between pt-4">
        {isEditing && (
          <button
            type="button"
            onClick={handleTestNow}
            disabled={isTesting || isSaving}
            className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold text-sky-accent bg-sky-accent/10 hover:bg-sky-accent/20 border border-sky-accent/30 transition-all disabled:opacity-50"
          >
            {isTesting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Testing with Playwright...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" /> Run Live Test Now
              </>
            )}
          </button>
        )}

        <div className="flex items-center gap-3 ml-auto">
          <button
            type="button"
            onClick={() => router.push('/')}
            disabled={isSaving || isTesting}
            className="px-5 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-surface border border-surface-border transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="submit"
            disabled={isSaving || isTesting}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-navy-900 bg-gradient-to-r from-sky-accent to-teal-light hover:brightness-110 transition-all shadow-md shadow-sky-accent/20 disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" /> Saving Site...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" /> {isEditing ? 'Update Website' : 'Save Website'}
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

