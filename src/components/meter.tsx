/** Labelled progress meter: accent fill on a lighter track of the same hue. */
export function Meter({ label, value, total, suffix }: { label: string; value: number; total: number; suffix?: string }) {
  const pct = total > 0 ? Math.min(100, Math.round((value / total) * 100)) : 0;
  return (
    <div>
      <div className="flex items-baseline justify-between text-[12px]">
        <span className="text-muted">{label}</span>
        <span className="font-medium text-ink tabular">
          {value}/{total}
          {suffix && <span className="font-normal text-muted"> {suffix}</span>}
        </span>
      </div>
      <div
        className="mt-1 h-1.5 overflow-hidden rounded-full bg-accent/15"
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
      >
        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
