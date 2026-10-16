import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FilterForm } from "@/components/filter-form";
import { Select, cx } from "@/components/ui";
import { addMonths, formatDate, formatMonth, monthGrid } from "@/lib/time";

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** Sequential tint (one hue, light → dark) for a day's count relative to the month's busiest day. */
function tint(count: number, max: number) {
  if (count === 0 || max === 0) return { bg: undefined, strong: false };
  const r = count / max;
  const pct = r <= 0.25 ? 14 : r <= 0.5 ? 28 : r <= 0.75 ? 46 : 72;
  return { bg: `color-mix(in oklab, var(--accent) ${pct}%, var(--surface))`, strong: pct >= 72 };
}

/**
 * Month view: a navigable calendar where each day shows its record count and
 * links to that day's records.
 */
export function MonthCalendar({
  basePath,
  month,
  months,
  today,
  selected,
  counts,
  noun,
}: {
  basePath: string;
  /** "YYYY-MM" being shown */
  month: string;
  /** Months offered in the jump list, newest first */
  months: string[];
  /** Today's YYYY-MM-DD in the college timezone */
  today: string;
  selected: string | null;
  counts: Record<string, number>;
  /** e.g. ["late arrival", "late arrivals"] */
  noun: [string, string];
}) {
  const max = Math.max(0, ...Object.values(counts));
  const thisMonth = today.slice(0, 7);
  const prev = addMonths(month, -1);
  const next = addMonths(month, 1);
  const href = (params: Record<string, string>) => `${basePath}?${new URLSearchParams(params)}`;

  return (
    <div>
      <div className="flex items-center justify-between gap-2 px-3 pt-3 pb-2">
        <Link href={href({ month: prev })} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={`Previous month, ${formatMonth(`${prev}-01`)}`}>
          <ChevronLeft className="size-5 shrink-0" aria-hidden />
        </Link>
        {/* Keyed by month so the dropdown follows arrow navigation. */}
        <FilterForm key={month} action={basePath} className="min-w-0">
          <Select
            name="month"
            defaultValue={month}
            aria-label="Jump to month"
            className="h-8 w-auto border-transparent bg-transparent pr-7 text-center text-[15px] font-semibold shadow-none hover:bg-surface-2"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {formatMonth(`${m}-01`)}
              </option>
            ))}
          </Select>
        </FilterForm>
        {month < thisMonth ? (
          <Link href={href({ month: next })} className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink" aria-label={`Next month, ${formatMonth(`${next}-01`)}`}>
            <ChevronRight className="size-5 shrink-0" aria-hidden />
          </Link>
        ) : (
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg text-ink-2 opacity-30" aria-hidden>
            <ChevronRight className="size-5 shrink-0" />
          </span>
        )}
      </div>

      <div className="px-3 pb-3">
        <div className="grid grid-cols-7 gap-1" role="grid" aria-label={formatMonth(`${month}-01`)}>
          {WEEKDAYS.map((d, i) => (
            <div key={d} role="columnheader" className={cx("py-1 text-center text-[11px] font-medium", i === 6 ? "text-muted/60" : "text-muted")}>
              {d.slice(0, 2)}
            </div>
          ))}
          {monthGrid(month).map((ymd, i) => {
            if (!ymd) return <div key={`pad-${i}`} aria-hidden />;
            const count = counts[ymd] ?? 0;
            const future = ymd > today;
            const isToday = ymd === today;
            const isSelected = ymd === selected;
            const { bg, strong } = tint(count, max);
            const day = Number(ymd.slice(8));
            const label = `${formatDate(ymd, { weekday: true })}: ${count === 0 ? "none" : `${count} ${count === 1 ? noun[0] : noun[1]}`}`;
            const body = (
              <>
                <span className={cx("text-[13px] leading-none", isSelected ? "font-semibold" : "font-medium")}>{day}</span>
                <span className={cx("mt-1 h-3 text-[10px] leading-none font-semibold tabular", isSelected ? "text-page/80" : strong ? "text-white" : "text-ink-2")}>
                  {count > 0 ? count : ""}
                </span>
              </>
            );
            const cellClass = cx(
              "relative flex h-11 flex-col items-center justify-center rounded-lg",
              isSelected
                ? "bg-ink text-page shadow-card"
                : strong
                  ? "text-white"
                  : "text-ink",
              isToday && !isSelected && "ring-2 ring-accent ring-inset",
            );
            if (future) {
              return (
                <div key={ymd} role="gridcell" aria-label={label} className={cx(cellClass, "text-muted/50")}>
                  {body}
                </div>
              );
            }
            return (
              <Link
                key={ymd}
                role="gridcell"
                href={href({ month, date: ymd })}
                scroll={false}
                aria-label={label}
                aria-current={isSelected ? "date" : undefined}
                title={label}
                className={cx(cellClass, !isSelected && "hover:ring-2 hover:ring-line-strong hover:ring-inset", "focus-visible:outline-2 focus-visible:outline-accent")}
                style={bg && !isSelected ? { background: bg } : undefined}
              >
                {body}
              </Link>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-muted">
          {month !== thisMonth || selected !== today ? (
            <Link href={basePath} className="font-medium text-accent-ink hover:underline">
              Go to today
            </Link>
          ) : (
            <span />
          )}
          <span className="flex items-center gap-1" aria-hidden>
            Fewer
            {[14, 28, 46, 72].map((p) => (
              <span key={p} className="size-2.5 rounded-sm" style={{ background: `color-mix(in oklab, var(--accent) ${p}%, var(--surface))` }} />
            ))}
            More
          </span>
        </div>
      </div>
    </div>
  );
}
