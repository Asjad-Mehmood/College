import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FilterForm } from "@/components/filter-form";
import { Select, buttonClass, cx } from "@/components/ui";
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
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
        <div className="flex items-center gap-1">
          <Link href={href({ month: prev })} className={buttonClass("ghost", "sm", "px-2")} aria-label={`Previous month, ${formatMonth(`${prev}-01`)}`}>
            <ChevronLeft className="size-4.5" aria-hidden />
          </Link>
          <h2 className="min-w-36 text-center text-base font-semibold">{formatMonth(`${month}-01`)}</h2>
          {month < thisMonth ? (
            <Link href={href({ month: next })} className={buttonClass("ghost", "sm", "px-2")} aria-label={`Next month, ${formatMonth(`${next}-01`)}`}>
              <ChevronRight className="size-4.5" aria-hidden />
            </Link>
          ) : (
            <span className={buttonClass("ghost", "sm", "pointer-events-none px-2 opacity-30")} aria-hidden>
              <ChevronRight className="size-4.5" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {month !== thisMonth && (
            <Link href={basePath} className={buttonClass("secondary", "sm")}>
              This month
            </Link>
          )}
          {/* Keyed by month so the dropdown follows arrow navigation. */}
          <FilterForm key={month} action={basePath}>
            <Select name="month" defaultValue={month} aria-label="Jump to month" className="h-8 w-auto text-[13px]">
              {months.map((m) => (
                <option key={m} value={m}>
                  {formatMonth(`${m}-01`)}
                </option>
              ))}
            </Select>
          </FilterForm>
        </div>
      </div>

      <div className="p-2 sm:p-4">
        <div className="grid grid-cols-7 gap-1 sm:gap-2" role="grid" aria-label={formatMonth(`${month}-01`)}>
          {WEEKDAYS.map((d, i) => (
            <div key={d} role="columnheader" className={cx("pb-1 text-center text-[11px] font-semibold tracking-wide uppercase", i === 6 ? "text-muted/60" : "text-muted")}>
              {d}
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
                <span
                  className={cx(
                    "flex size-6 items-center justify-center rounded-full text-[12px] font-medium sm:text-[13px]",
                    isToday ? "bg-ink text-page" : strong ? "text-white" : "text-ink-2",
                  )}
                >
                  {day}
                </span>
                <span className={cx("self-end text-base leading-none font-semibold tabular sm:text-xl", strong ? "text-white" : count ? "text-ink" : "text-muted/50")}>
                  {count > 0 ? count : future ? "" : "–"}
                </span>
              </>
            );
            const cellClass = cx(
              "flex aspect-square flex-col justify-between rounded-lg border p-1 sm:aspect-auto sm:min-h-16 sm:p-2",
              isSelected ? "border-transparent ring-2 ring-ink ring-offset-2 ring-offset-surface" : "border-line",
              !bg && "bg-surface",
            );
            if (future) {
              return (
                <div key={ymd} role="gridcell" aria-label={label} className={cx(cellClass, "opacity-40")}>
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
                className={cx(cellClass, "transition-shadow hover:border-line-strong hover:shadow-card focus-visible:outline-2 focus-visible:outline-accent")}
                style={bg ? { background: bg } : undefined}
              >
                {body}
              </Link>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-end gap-1.5 text-[11px] text-muted" aria-hidden>
          Fewer
          {[14, 28, 46, 72].map((p) => (
            <span key={p} className="size-3 rounded-sm" style={{ background: `color-mix(in oklab, var(--accent) ${p}%, var(--surface))` }} />
          ))}
          More
        </div>
      </div>
    </div>
  );
}
