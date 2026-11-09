import React, { type ReactNode } from "react";
import { Check, CircleAlert, CircleCheck, Info, X } from "lucide-react";

export type Notice = { id: number; message: string; tone: "success" | "info" | "error" };

export function SectionCard({
  step,
  icon,
  title,
  subtitle,
  action,
  children,
}: {
  step: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="panel animate-rise overflow-hidden">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-line/90 px-5 py-5 sm:px-7 sm:py-6">
        <div className="flex min-w-0 items-start gap-3.5">
          <div className="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#eef1ff] text-cobalt">
            {icon}
          </div>
          <div className="min-w-0">
            <p className="mb-1 font-display text-[10px] font-extrabold tracking-[.16em] text-cobalt">STEP {step}</p>
            <h2 className="font-display text-[17px] font-bold tracking-tight text-ink sm:text-[19px]">{title}</h2>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-relaxed text-muted">{subtitle}</p>
          </div>
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
      </header>
      {children}
    </section>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label ?? "Toggle"}
      onClick={() => onChange(!checked)}
      className={`switch ${checked ? "on" : ""}`}
    />
  );
}

export function CheckBox({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={label}
      onClick={onClick}
      className={`checkbox ${checked ? "on" : ""}`}
    >
      <Check size={12} strokeWidth={3} />
    </button>
  );
}

export function StatusPill({
  tone,
  children,
}: {
  tone: "green" | "blue" | "amber" | "gray" | "red";
  children: ReactNode;
}) {
  const styles: Record<string, string> = {
    green: "bg-[#e7f8f2] text-[#0b8d73]",
    blue: "bg-[#eef1ff] text-[#3c56e8]",
    amber: "bg-[#fff5df] text-[#a96c07]",
    gray: "bg-[#f0f3f8] text-[#71809a]",
    red: "bg-[#ffeded] text-[#c23b48]",
  };
  return <span className={`pill ${styles[tone]}`}>{children}</span>;
}

export function Toast({
  notice,
  onClose,
}: {
  notice: Notice | null;
  onClose: () => void;
}) {
  if (!notice) return null;
  const Icon = notice.tone === "success" ? CircleCheck : notice.tone === "error" ? CircleAlert : Info;
  const color = notice.tone === "success" ? "text-mint" : notice.tone === "error" ? "text-[#e25060]" : "text-cobalt";
  return (
    <div className="animate-toast pointer-events-auto fixed bottom-6 right-6 z-[80] flex max-w-[360px] items-start gap-3 rounded-2xl border border-line bg-white px-4 py-3.5 shadow-[0_18px_50px_rgba(18,32,58,.18)]">
      <span className={`mt-0.5 ${color}`}><Icon size={18} /></span>
      <p className="flex-1 text-[12.5px] font-medium leading-relaxed text-ink">{notice.message}</p>
      <button onClick={onClose} className="text-[#9aa6b9] hover:text-ink" aria-label="Dismiss notification"><X size={15} /></button>
    </div>
  );
}

export function FieldLabel({
  children,
  required,
}: {
  children: ReactNode;
  required?: boolean;
}) {
  return (
    <span className="field-label">
      {children}{required && <span className="ml-1 text-[#e25060]">*</span>}
    </span>
  );
}

