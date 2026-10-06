"use client";

import clsx from "clsx";
import { AlertTriangle, ChevronDown, Loader2, type LucideIcon } from "lucide-react";
import {
  useEffect,
  useState,
  type ButtonHTMLAttributes,
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";

/* ------------------------------------------------------------------ */
/* Layout                                                              */
/* ------------------------------------------------------------------ */

export function Tile({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={clsx("tile", className)} {...rest}>
      {children}
    </div>
  );
}

export function Eyebrow({ children, className }: { children: ReactNode; className?: string }) {
  return <p className={clsx("eyebrow", className)}>{children}</p>;
}

export function TileHeader({ title, icon: Icon, right }: { title: ReactNode; icon?: LucideIcon; right?: ReactNode }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        {Icon && (
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-stone-100 text-stone-500">
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </span>
        )}
        <Eyebrow>{title}</Eyebrow>
      </div>
      {right && <div className="text-xs text-stone-400">{right}</div>}
    </div>
  );
}

export function Stat({
  label,
  value,
  hint,
  icon: Icon,
  tone = "neutral",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  icon?: LucideIcon;
  tone?: "neutral" | "accent" | "success" | "warning" | "danger";
}) {
  const iconTone = {
    neutral: "bg-stone-100 text-stone-600",
    accent: "bg-indigo-50 text-indigo-600",
    success: "bg-emerald-50 text-emerald-600",
    warning: "bg-amber-50 text-amber-700",
    danger: "bg-rose-50 text-rose-600",
  }[tone];
  return (
    <div className="flex h-full flex-col justify-between gap-6">
      <div className="flex items-start justify-between gap-3">
        <Eyebrow>{label}</Eyebrow>
        {Icon && (
          <span className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", iconTone)}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
        )}
      </div>
      <div>
        <div className="display tabular text-5xl font-semibold leading-none text-stone-900">{value}</div>
        {hint && <div className="mt-3 text-sm leading-relaxed text-stone-500">{hint}</div>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Badges                                                              */
/* ------------------------------------------------------------------ */

type Tone = "neutral" | "success" | "warning" | "danger" | "info" | "brand";

const toneClasses: Record<Tone, string> = {
  neutral: "bg-stone-100 text-stone-700",
  success: "bg-emerald-50 text-emerald-700",
  warning: "bg-amber-50 text-amber-800",
  danger: "bg-rose-50 text-rose-700",
  info: "bg-sky-50 text-sky-700",
  brand: "bg-indigo-50 text-indigo-700",
};

export function Badge({
  tone = "neutral",
  icon: Icon,
  className,
  children,
  ...rest
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; icon?: LucideIcon }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none tracking-wide",
        toneClasses[tone],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon className="h-3 w-3" aria-hidden />}
      {children}
    </span>
  );
}

/** Brand chip coloured from the brand's accent so brands are visually unmistakable. */
export function BrandChip({ name, color, className, size = "sm" }: { name: string; color: string; className?: string; size?: "sm" | "md" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center gap-2 rounded-full font-semibold leading-none",
        size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1.5 text-xs",
        className,
      )}
      style={{ backgroundColor: `${color}12`, color }}
    >
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full rounded-full opacity-40" style={{ backgroundColor: color }} />
        <span className="relative inline-flex h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
      </span>
      {name}
    </span>
  );
}

export function Dot({ className }: { className?: string }) {
  return <span className={clsx("inline-block h-1 w-1 rounded-full bg-stone-300", className)} aria-hidden />;
}

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

type Variant = "primary" | "accent" | "secondary" | "ghost" | "danger" | "danger-solid";

const variantClasses: Record<Variant, string> = {
  primary: "bg-stone-900 text-white hover:bg-stone-700 shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]",
  accent: "bg-indigo-600 text-white hover:bg-indigo-500 shadow-glow",
  secondary: "bg-white text-stone-800 ring-1 ring-inset ring-stone-200 hover:bg-stone-50 hover:ring-stone-300",
  ghost: "text-stone-600 hover:bg-stone-100 hover:text-stone-900",
  danger: "bg-white text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50",
  "danger-solid": "bg-rose-600 text-white hover:bg-rose-500",
};

const sizeClasses = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-10 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  icon: "h-8 w-8 text-xs",
};

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: keyof typeof sizeClasses; loading?: boolean }) {
  return (
    <button
      type="button"
      className={clsx(
        "inline-flex items-center justify-center rounded-full font-medium transition-all duration-200 ease-out-expo active:scale-[0.97] focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 focus-visible:ring-offset-canvas disabled:cursor-not-allowed disabled:opacity-55 disabled:active:scale-100",
        sizeClasses[size],
        variantClasses[variant],
        className,
      )}
      disabled={disabled || loading}
      {...rest}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}

/** Two-step destructive action: first click arms it, second click confirms, auto-disarms after 3 s. */
export function ConfirmButton({
  label,
  confirmLabel = "Confirm",
  onConfirm,
  size = "sm",
  icon: Icon,
  disabled,
}: {
  label: string;
  confirmLabel?: string;
  onConfirm: () => void;
  size?: keyof typeof sizeClasses;
  icon?: LucideIcon;
  disabled?: boolean;
}) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <Button
      size={size}
      variant={armed ? "danger-solid" : "danger"}
      disabled={disabled}
      onClick={() => {
        if (armed) {
          setArmed(false);
          onConfirm();
        } else {
          setArmed(true);
        }
      }}
      onBlur={() => setArmed(false)}
    >
      {Icon && <Icon className="h-3.5 w-3.5" aria-hidden />}
      {armed ? confirmLabel : label}
    </Button>
  );
}

/* ------------------------------------------------------------------ */
/* Segmented control with a sliding indicator                          */
/* ------------------------------------------------------------------ */

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  icon?: LucideIcon;
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
  className,
  tone = "neutral",
  ariaLabel,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  className?: string;
  tone?: "neutral" | "amber";
  ariaLabel?: string;
}) {
  const index = Math.max(
    0,
    options.findIndex((o) => o.value === value),
  );
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={clsx("relative grid rounded-full bg-stone-200/60 p-1 text-xs font-medium", className)}
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
    >
      <span
        aria-hidden
        className={clsx(
          "absolute bottom-1 top-1 rounded-full bg-white shadow-sm transition-transform duration-300 ease-out-expo",
          tone === "amber" && "ring-1 ring-amber-300",
        )}
        style={{ left: "0.25rem", width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(o.value)}
            className={clsx(
              "relative z-10 inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-1.5 transition-colors duration-200",
              active ? (tone === "amber" ? "text-amber-900" : "text-stone-900") : "text-stone-500 hover:text-stone-800",
            )}
          >
            {o.icon && <o.icon className="h-3.5 w-3.5" aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Collapsible / Disclosure (animated via grid rows)                   */
/* ------------------------------------------------------------------ */

export function Collapsible({ open, children, className }: { open: boolean; children: ReactNode; className?: string }) {
  return (
    <div
      className={clsx(
        "grid transition-[grid-template-rows,opacity] duration-300 ease-out-expo",
        open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
        className,
      )}
      aria-hidden={!open}
    >
      <div className="min-h-0 overflow-hidden">{children}</div>
    </div>
  );
}

export function Disclosure({
  summary,
  children,
  defaultOpen = false,
  className,
  summaryClassName,
}: {
  summary: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
  summaryClassName?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={clsx("flex w-full items-center justify-between gap-3 text-left", summaryClassName)}
      >
        <span className="min-w-0 flex-1">{summary}</span>
        <ChevronDown
          className={clsx("h-4 w-4 shrink-0 text-stone-400 transition-transform duration-300 ease-out-expo", open && "rotate-180")}
          aria-hidden
        />
      </button>
      <Collapsible open={open}>{children}</Collapsible>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Forms                                                               */
/* ------------------------------------------------------------------ */

const fieldClasses =
  "w-full rounded-xl border border-stone-200 bg-white px-3.5 py-2.5 text-sm text-stone-900 shadow-[inset_0_1px_2px_rgb(16_24_40/0.03)] transition-all duration-200 placeholder:text-stone-400 hover:border-stone-300 focus:border-indigo-400 focus:outline-none focus:ring-4 focus:ring-indigo-500/10 disabled:bg-stone-50 disabled:text-stone-500";

/** Plain textarea; `ref` is forwarded as a regular prop (React 19). */
export function TextArea({ className, ...rest }: ComponentProps<"textarea">) {
  return <textarea className={clsx(fieldClasses, "resize-none leading-relaxed", className)} {...rest} />;
}

export function Input({ className, ...rest }: ComponentProps<"input">) {
  return <input className={clsx(fieldClasses, className)} {...rest} />;
}

export function Select({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className={clsx("relative inline-block", className)}>
      <select className={clsx(fieldClasses, "appearance-none pr-9")} {...rest}>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" aria-hidden />
    </span>
  );
}

export function FormLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1.5 block text-xs font-medium text-stone-600">
      {children}
    </label>
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded-md border border-stone-200 bg-white px-1.5 py-0.5 font-mono text-[10px] font-medium text-stone-500 shadow-[0_1px_0_rgb(0_0_0/0.05)]">
      {children}
    </kbd>
  );
}

/* ------------------------------------------------------------------ */
/* Feedback                                                            */
/* ------------------------------------------------------------------ */

export function ErrorNote({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="flex animate-pop items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-sm text-rose-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </p>
  );
}

export function EmptyState({
  title,
  body,
  icon: Icon,
  action,
  className,
}: {
  title: string;
  body?: ReactNode;
  icon?: LucideIcon;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("tile-soft flex flex-col items-center justify-center gap-3 px-6 py-12 text-center", className)}>
      {Icon && (
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-100 text-stone-400">
          <Icon className="h-5 w-5" aria-hidden />
        </span>
      )}
      <p className="display text-base font-semibold text-stone-800">{title}</p>
      {body && <p className="max-w-sm text-sm leading-relaxed text-stone-500">{body}</p>}
      {action}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={clsx("skeleton h-3", className)} aria-hidden />;
}

export function PulseDots({ className }: { className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-1", className)} aria-hidden>
      {[0, 1, 2].map((i) => (
        <span key={i} className="h-1.5 w-1.5 animate-dot rounded-full bg-indigo-500" style={{ animationDelay: `${i * 160}ms` }} />
      ))}
    </span>
  );
}
