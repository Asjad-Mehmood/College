import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { AlertTriangle, CheckCircle2, CircleAlert, OctagonAlert } from "lucide-react";
import { STRIKE_LABELS, type StrikeLevel } from "@/lib/strikes";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

/* ---------- Buttons ---------- */

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-accent text-on-accent hover:bg-accent-hover shadow-card disabled:opacity-50",
  secondary:
    "bg-surface text-ink border border-line hover:bg-surface-2 shadow-card disabled:opacity-50",
  ghost: "text-ink-2 hover:bg-surface-2 hover:text-ink disabled:opacity-50",
  danger:
    "bg-surface text-danger-ink border border-line hover:bg-critical/10 hover:border-critical/40 disabled:opacity-50",
};

const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-[13px] gap-1.5 rounded-lg",
  md: "h-10 px-4 text-sm gap-2 rounded-lg",
  lg: "h-14 px-6 text-base gap-2.5 rounded-xl",
};

export function buttonClass(variant: Variant = "secondary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
    "disabled:cursor-not-allowed",
    VARIANTS[variant],
    SIZES[size],
    extra,
  );
}

export function Button({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({
  variant = "secondary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

/* ---------- Layout ---------- */

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 no-print">{actions}</div>}
    </div>
  );
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx("min-w-0 rounded-2xl border border-line bg-surface shadow-card", className)}
      {...props}
    />
  );
}

export function CardHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      {actions}
    </div>
  );
}

/* ---------- Forms ---------- */

export const inputClass = cx(
  "h-10 w-full rounded-lg border border-line bg-surface px-3 text-sm text-ink",
  "placeholder:text-muted shadow-card",
  "focus:border-accent focus:outline-none focus:ring-3 focus:ring-accent/20",
  "disabled:opacity-60",
);

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputClass, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      className={cx(inputClass, "h-auto min-h-20 py-2 leading-relaxed", className)}
      {...props}
    />
  );
}

export function Field({
  label,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx("flex flex-col gap-1.5", className)}>
      <span className="text-[13px] font-medium text-ink-2">{label}</span>
      {children}
      {error ? (
        <span className="text-[12px] text-danger-ink">{error}</span>
      ) : (
        hint && <span className="text-[12px] text-muted">{hint}</span>
      )}
    </label>
  );
}

export function FormMessage({ state }: { state?: { ok?: boolean; message?: string } | null }) {
  if (!state?.message) return null;
  return (
    <p
      role="status"
      className={cx(
        "flex items-center gap-2 rounded-lg px-3 py-2 text-sm",
        state.ok ? "bg-good/10 text-success-ink" : "bg-critical/10 text-danger-ink",
      )}
    >
      {state.ok ? <CheckCircle2 className="size-4 shrink-0" /> : <CircleAlert className="size-4 shrink-0" />}
      {state.message}
    </p>
  );
}

/* ---------- Status & badges ---------- */

const STRIKE_STYLES: Record<StrikeLevel, { dot: string; bg: string; Icon: typeof CheckCircle2 }> = {
  good: { dot: "text-good", bg: "bg-good/12 ring-good/25", Icon: CheckCircle2 },
  warning: { dot: "text-warning", bg: "bg-warning/15 ring-warning/35", Icon: CircleAlert },
  serious: { dot: "text-serious", bg: "bg-serious/15 ring-serious/35", Icon: AlertTriangle },
  critical: { dot: "text-critical", bg: "bg-critical/12 ring-critical/30", Icon: OctagonAlert },
};

/** Colour + icon + text, so the level never relies on colour alone. */
export function StrikeBadge({
  level,
  label,
  size = "sm",
}: {
  level: StrikeLevel;
  label?: ReactNode;
  size?: "sm" | "lg";
}) {
  const s = STRIKE_STYLES[level];
  return (
    <span
      className={cx(
        "inline-flex items-center rounded-full font-medium text-ink ring-1 ring-inset whitespace-nowrap",
        s.bg,
        size === "lg" ? "gap-2 px-3.5 py-1.5 text-sm" : "gap-1 px-2 py-0.5 text-[12px]",
      )}
    >
      <s.Icon className={cx(s.dot, size === "lg" ? "size-4.5" : "size-3.5")} aria-hidden />
      {label ?? STRIKE_LABELS[level]}
    </span>
  );
}

export function Pill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "accent" | "good" | "warning" | "critical";
  children: ReactNode;
}) {
  const tones = {
    neutral: "bg-surface-2 text-ink-2 ring-line",
    accent: "bg-accent-soft text-accent-ink ring-accent/20",
    good: "bg-good/10 text-success-ink ring-good/25",
    warning: "bg-warning/15 text-ink ring-warning/35",
    critical: "bg-critical/10 text-danger-ink ring-critical/25",
  };
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[12px] font-medium ring-1 ring-inset whitespace-nowrap",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

/* ---------- Student avatar ---------- */

const AVATAR_SIZES = {
  sm: "size-9 text-xs rounded-lg",
  md: "size-12 text-sm rounded-xl",
  lg: "size-28 text-2xl rounded-2xl",
  xl: "size-36 text-3xl rounded-2xl",
};

export function Avatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof AVATAR_SIZES;
}) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  if (photoUrl) {
    return (
      // Photos are arbitrary external URLs from the student import.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={photoUrl}
        alt={`Photo of ${name}`}
        className={cx("shrink-0 object-cover ring-1 ring-line bg-surface-2", AVATAR_SIZES[size])}
      />
    );
  }
  return (
    <div
      aria-hidden
      className={cx(
        "flex shrink-0 items-center justify-center bg-accent-soft font-semibold text-accent-ink ring-1 ring-inset ring-accent/15",
        AVATAR_SIZES[size],
      )}
    >
      {initials || "?"}
    </div>
  );
}

/* ---------- Placeholders ---------- */

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-surface-2", className)} />;
}

export function EmptyState({
  icon,
  title,
  children,
}: {
  icon?: ReactNode;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
      {icon && (
        <div className="mb-3 flex size-11 items-center justify-center rounded-xl bg-surface-2 text-muted">
          {icon}
        </div>
      )}
      <p className="text-sm font-medium text-ink">{title}</p>
      {children && <div className="mt-1 max-w-sm text-[13px] text-muted">{children}</div>}
    </div>
  );
}

/* ---------- Tables ---------- */

export function Table({ children }: { children: ReactNode }) {
  return (
    // `relative` keeps absolutely positioned children (sr-only labels) inside
    // the scroll container instead of widening the whole page.
    <div className="relative overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-left text-sm">{children}</table>
    </div>
  );
}

export function Th({ className, ...props }: ComponentProps<"th">) {
  return (
    <th
      className={cx(
        "border-b border-line bg-surface-2/60 px-4 py-2.5 text-[12px] font-medium tracking-wide text-muted uppercase",
        className,
      )}
      {...props}
    />
  );
}

export function Td({ className, ...props }: ComponentProps<"td">) {
  return <td className={cx("border-b border-line px-4 py-3 align-middle", className)} {...props} />;
}
