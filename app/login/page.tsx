'use client';

import React, { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  ShieldCheck,
  Lock,
  User,
  Eye,
  EyeOff,
  ArrowRight,
  LoaderCircle,
  AlertCircle,
  CheckCircle2,
  KeyRound,
} from 'lucide-react';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const returnTo = searchParams.get('from') || '/';

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('Please enter both username and password.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: cleanUser,
          password,
          rememberMe,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Authentication failed. Check your credentials.');
      }

      // Successful login -> Redirect
      router.push(returnTo);
      router.refresh();
    } catch (err: any) {
      setError(err.message || 'Unable to sign in. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen w-full items-center justify-center bg-[#f4f6fa] p-4 selection:bg-cobalt/20 selection:text-cobaltdark">
      {/* Background ambient decorative glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[500px] w-[600px] -translate-x-1/2 rounded-full bg-gradient-to-b from-[#3c56e8]/10 via-[#3c56e8]/5 to-transparent blur-3xl" />
        <div className="absolute -bottom-40 right-10 h-[400px] w-[400px] rounded-full bg-emerald-500/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[420px]">
        {/* Brand header */}
        <div className="mb-6 text-center">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-tr from-[#2c43cc] via-[#3c56e8] to-[#5872ff] text-white shadow-xl shadow-[#3c56e8]/25 ring-4 ring-[#3c56e8]/10">
            <ShieldCheck size={28} strokeWidth={2.4} />
          </div>
          <h1 className="mt-4 font-display text-[24px] font-extrabold tracking-[-.03em] text-[#101c2e]">
            FormGuard Pro
          </h1>
          <p className="mt-1 text-[13px] text-[#71809a]">
            WordPress Form Health & Security Portal
          </p>
        </div>

        {/* Login Card */}
        <div className="panel border-[#e6eaf1] bg-white p-6 sm:p-8 shadow-[0_12px_40px_rgba(21,38,72,.07)]">
          <div className="mb-5">
            <h2 className="font-display text-[17px] font-bold text-[#101c2e]">
              Sign in to dashboard
            </h2>
            <p className="mt-0.5 text-[12px] text-[#71809a]">
              Enter your administrator credentials to continue.
            </p>
          </div>

          {error && (
            <div className="animate-rise mb-5 flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50/80 p-3 text-[12.5px] leading-relaxed text-red-700">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="field-label" htmlFor="username">
                Username or Email
              </label>
              <div className="relative">
                <User
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8c99ae]"
                />
                <input
                  id="username"
                  type="text"
                  autoComplete="username"
                  autoFocus
                  required
                  disabled={isLoading}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  className="field !h-11 !pl-10 text-[13.5px]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="field-label" htmlFor="password">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock
                  size={15}
                  className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8c99ae]"
                />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  disabled={isLoading}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="field !h-11 !pl-10 !pr-10 text-[13.5px]"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#8c99ae] transition hover:text-[#101c2e]"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer items-center gap-2 select-none">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-[#cbd5e3] text-cobalt focus:ring-cobalt/25"
                />
                <span className="text-[12px] font-medium text-[#63728c]">
                  Remember for 7 days
                </span>
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="btn btn-primary btn-lg mt-2 !h-11 w-full !text-[13.5px] font-semibold shadow-lg shadow-cobalt/25 transition-all hover:shadow-cobalt/35"
            >
              {isLoading ? (
                <>
                  <LoaderCircle size={16} className="animate-spin" />
                  Verifying credentials…
                </>
              ) : (
                <>
                  Sign in
                  <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>

          {/* Initial credentials hint pill */}
          <div className="mt-6 rounded-xl border border-dashed border-[#dce3f0] bg-[#f9fafc] p-3 text-[11.5px] text-[#63728c]">
            <div className="flex items-center gap-2 font-semibold text-[#101c2e]">
              <KeyRound size={13} className="text-cobalt" />
              <span>First-time login credentials:</span>
            </div>
            <div className="mt-1 flex flex-wrap items-center justify-between gap-1 font-mono text-[11px] text-[#425066]">
              <span>User: <strong className="font-semibold text-cobalt">admin</strong></span>
              <span>Pass: <strong className="font-semibold text-cobalt">FormGuard@2026</strong></span>
            </div>
            <p className="mt-1.5 text-[10.5px] text-[#8c99ae]">
              You can change your password anytime in Settings & Alerts.
            </p>
          </div>
        </div>

        {/* Footer info */}
        <p className="mt-6 text-center text-[11.5px] text-[#8c99ae]">
          FormGuard Pro Monitor · All rights reserved
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="grid min-h-screen place-items-center bg-[#f4f6fa]">
          <LoaderCircle size={28} className="animate-spin text-cobalt" />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}

