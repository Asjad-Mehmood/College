import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  CalendarX,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Printer,
  SearchX,
} from "lucide-react";
import { FilterForm } from "@/components/filter-form";
import { LedgerTable } from "@/components/ledger-table";
import { MonthCalendar } from "@/components/month-calendar";
import {
  ButtonLink,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Skeleton,
  StrikeBadge,
  buttonClass,
  cx,
} from "@/components/ui";
import { ViewTabs, pickView } from "@/components/view-tabs";
import { can, requireUser } from "@/lib/auth";
import { REASON_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { strikeLevel } from "@/lib/strikes";
import {
  PAGE_SIZE,
  RANGES,
  filtersToQuery,
  getClassOptions,
  lateCountsForMonth,
  monthOptions,
  parseRecordFilters,
  queryLedger,
  type RecordFilters,
} from "@/lib/records";
import { getSettings, type Settings } from "@/lib/settings";
import { addDays, formatDate, formatMonth, fromDbDate, isValidMonth, isValidYmd, localParts, monthStart, nextMonthStart, toDbDate } from "@/lib/time";

export const metadata: Metadata = { title: "Late records" };

export default function RecordsPage(props: PageProps<"/records">) {
  return (
    <div>
      <PageHeader
        title="Late records"
        description="Browse by month and date, or search every late arrival."
        actions={
          <Suspense>
            <ExportActions searchParams={props.searchParams} />
          </Suspense>
        }
      />
      <Suspense fallback={<LedgerSkeleton />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

type SP = PageProps<"/records">["searchParams"];

async function Content({ searchParams }: { searchParams: SP }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const params = await searchParams;
  const view = pickView(params);
  return (
    <>
      <ViewTabs basePath="/records" view={view} />
      {view === "search" ? <Ledger params={params} /> : <MonthView params={params} />}
    </>
  );
}

type Params = Awaited<SP>;

async function MonthView({ params }: { params: Params }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const settings = await getSettings();
  const today = localParts(new Date(), settings.timezone).date;
  const thisMonth = today.slice(0, 7);
  const monthParam = typeof params.month === "string" ? params.month : undefined;
  const month = isValidMonth(monthParam) && monthParam <= thisMonth ? monthParam : thisMonth;

  const monthWhere = { lateDate: { gte: toDbDate(monthStart(`${month}-01`)), lt: toDbDate(nextMonthStart(`${month}-01`)) } };
  const [counts, earliest, students, agg, unpaid, reasons] = await Promise.all([
    lateCountsForMonth(month),
    prisma.lateRecord.findFirst({ orderBy: { lateDate: "asc" }, select: { lateDate: true } }),
    prisma.lateRecord.groupBy({ by: ["rollNo"], where: monthWhere, _count: { _all: true } }),
    prisma.lateRecord.aggregate({ where: monthWhere, _avg: { minutesLate: true }, _sum: { fineAmount: true } }),
    prisma.lateRecord.aggregate({ where: { ...monthWhere, finePaid: false, fineAmount: { gt: 0 } }, _sum: { fineAmount: true } }),
    prisma.lateRecord.groupBy({ by: ["reason"], where: monthWhere, _count: { _all: true } }),
  ]);
  const repeaters = students
    .filter((x) => x._count._all >= settings.habitualThreshold)
    .sort((a, b) => b._count._all - a._count._all);
  const topRolls = repeaters.slice(0, 8);
  const topStudents = topRolls.length
    ? await prisma.student.findMany({ where: { rollNo: { in: topRolls.map((t) => t.rollNo) } }, select: { rollNo: true, fullName: true, section: true } })
    : [];
  const nameOf = new Map(topStudents.map((t) => [t.rollNo, t]));
  const reasonTotal = reasons.reduce((a, r) => a + r._count._all, 0);

  // Selected day: the one asked for, else today (this month) or the month's last day with records.
  const dateParam = typeof params.date === "string" ? params.date : undefined;
  const daysWithRecords = Object.keys(counts).sort();
  const date =
    isValidYmd(dateParam) && dateParam.startsWith(month) && dateParam <= today
      ? dateParam
      : month === thisMonth
        ? today
        : (daysWithRecords.at(-1) ?? null);

  const monthTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  const busiest = daysWithRecords.reduce<string | null>((best, d) => (!best || counts[d] > counts[best] ? d : best), null);
  const { rows } = date
    ? await queryLedger({ ...parseRecordFilters({}), range: "custom", from: date, to: date }, settings, { limit: 1000 })
    : { rows: [] };
  const dayQs = date ? `range=custom&from=${date}&to=${date}` : "";

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="no-print overflow-hidden lg:sticky lg:top-6">
        <MonthCalendar
          basePath="/records"
          month={month}
          months={monthOptions(thisMonth, earliest ? fromDbDate(earliest.lateDate).slice(0, 7) : null)}
          today={today}
          selected={date}
          counts={counts}
          noun={["late arrival", "late arrivals"]}
        />
        <p className="border-t border-line px-4 py-3 text-[12px] leading-relaxed text-ink-2">
          <span className="font-semibold text-ink tabular">{monthTotal}</span> late {monthTotal === 1 ? "arrival" : "arrivals"} in{" "}
          {formatMonth(`${month}-01`)} · {students.length} {students.length === 1 ? "student" : "students"} · on {daysWithRecords.length}{" "}
          {daysWithRecords.length === 1 ? "day" : "days"}
          {busiest && (
            <>
              {" "}
              · busiest: {formatDate(busiest, { weekday: true })} ({counts[busiest]})
            </>
          )}
        </p>
      </Card>
      <div className="flex min-w-0 flex-col gap-4">

      {/* Shown only on paper */}
      {date && (
        <div className="hidden print:block">
          <p className="text-lg font-semibold">{settings.collegeName} — Late arrivals</p>
          <p className="text-sm">
            {formatDate(date, { weekday: true })} · {rows.length} records
          </p>
        </div>
      )}

      <Card className="print-plain overflow-hidden">
        {date ? (
          <>
            <div className="no-print flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
              <div>
                <h2 className="text-[15px] font-semibold">{formatDate(date, { weekday: true })}</h2>
                <p className="text-[13px] text-muted">
                  {rows.length} late {rows.length === 1 ? "arrival" : "arrivals"}
                  {rows.length > 0 &&
                    ` · ${[...rows.reduce((m, r) => m.set(r.section, (m.get(r.section) ?? 0) + 1), new Map<string, number>())]
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 6)
                      .map(([sec, n]) => `${sec} ${n}`)
                      .join(" · ")}`}
                </p>
              </div>
              {rows.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <a className={buttonClass("secondary", "sm")} href={`/api/export?format=xlsx&${dayQs}`}>
                    <FileSpreadsheet className="size-3.5" aria-hidden /> Excel
                  </a>
                  <a className={buttonClass("secondary", "sm")} href={`/api/export?format=csv&${dayQs}`}>
                    <FileText className="size-3.5" aria-hidden /> CSV
                  </a>
                  <a className={buttonClass("secondary", "sm")} href={`/late-print?${dayQs}`} target="_blank" rel="noreferrer">
                    <Printer className="size-3.5" aria-hidden /> Print
                  </a>
                </div>
              )}
            </div>
            {rows.length === 0 ? (
              <EmptyState icon={<CalendarX className="size-5" />} title="No late arrivals on this day" />
            ) : (
              <LedgerTable rows={rows} settings={settings} manage={can.manageRecords(user.role)} showDate={false} />
            )}
          </>
        ) : (
          <EmptyState icon={<CalendarX className="size-5" />} title={`No late arrivals in ${formatMonth(`${month}-01`)}`}>
            Pick another month above.
          </EmptyState>
        )}
      </Card>
      </div>
      </div>

      <div className="no-print grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Late arrivals", value: monthTotal.toLocaleString() },
          { label: "Students late", value: students.length.toLocaleString() },
          { label: `Habitual (${settings.habitualThreshold}+)`, value: repeaters.length.toLocaleString(), href: `/records?view=search&range=custom&from=${month}-01&to=${month === thisMonth ? today : addDays(nextMonthStart(`${month}-01`), -1)}&habitual=1` },
          { label: "Avg. minutes late", value: agg._avg.minutesLate ? Math.round(agg._avg.minutesLate).toString() : "—" },
          { label: "Unpaid fines", value: `Rs. ${Number(unpaid._sum.fineAmount ?? 0).toLocaleString()}`, sub: `of Rs. ${Number(agg._sum.fineAmount ?? 0).toLocaleString()} fined` },
        ].map((x) => {
          const body = (
            <>
              <p className="text-[12px] text-muted">{x.label}</p>
              <p className="mt-0.5 text-xl font-semibold tabular">{x.value}</p>
              {x.sub && <p className="text-[12px] text-muted">{x.sub}</p>}
            </>
          );
          return x.href ? (
            <Link key={x.label} href={x.href} className="rounded-2xl border border-line bg-surface px-4 py-3 shadow-card hover:border-line-strong">
              {body}
            </Link>
          ) : (
            <Card key={x.label} className="px-4 py-3">
              {body}
            </Card>
          );
        })}
      </div>

      {(topRolls.length > 0 || reasons.length > 0) && (
        <div className="no-print grid gap-4 lg:grid-cols-2">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-[15px] font-semibold">Most late this month</h2>
              <p className="text-[13px] text-muted">Students with {settings.habitualThreshold} or more late arrivals</p>
            </div>
            {topRolls.length === 0 ? (
              <p className="px-5 py-6 text-[13px] text-muted">No habitual late-comers this month.</p>
            ) : (
              <ul className="divide-y divide-line">
                {topRolls.map((t) => {
                  const st = nameOf.get(t.rollNo);
                  return (
                    <li key={t.rollNo}>
                      <Link href={`/students/${encodeURIComponent(t.rollNo)}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2/60">
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">{st?.fullName ?? t.rollNo}</span>
                          <span className="block text-[12px] text-muted">
                            <span className="font-mono">{t.rollNo}</span> · {st?.section}
                          </span>
                        </span>
                        <StrikeBadge level={strikeLevel(t._count._all, settings)} label={`${t._count._all} late`} />
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-[15px] font-semibold">Reasons given</h2>
              <p className="text-[13px] text-muted">{formatMonth(`${month}-01`)}</p>
            </div>
            <ul className="flex flex-col gap-3 px-5 py-4">
              {[...reasons].sort((a, b) => b._count._all - a._count._all).map((r) => {
                const pct = reasonTotal ? Math.round((r._count._all / reasonTotal) * 100) : 0;
                return (
                  <li key={r.reason}>
                    <div className="flex justify-between text-[13px]">
                      <span>{REASON_LABELS[r.reason]}</span>
                      <span className="text-muted tabular">
                        {r._count._all} · {pct}%
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                      <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      )}

    </div>
  );
}

async function ExportActions({ searchParams }: { searchParams: SP }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const params = await searchParams;
  // The month view has its own per-day export buttons.
  if (pickView(params) === "month") return null;
  const qs = filtersToQuery({ ...parseRecordFilters(params), page: 1 });
  const sep = qs ? "&" : "";
  return (
    <>
      <a className={buttonClass("secondary")} href={`/api/export?format=xlsx${sep}${qs}`}>
        <FileSpreadsheet className="size-4" aria-hidden /> Excel
      </a>
      <a className={buttonClass("secondary")} href={`/api/export?format=csv${sep}${qs}`}>
        <FileText className="size-4" aria-hidden /> CSV
      </a>
      <a className={buttonClass("secondary")} href={`/late-print?${qs}`} target="_blank" rel="noreferrer">
        <Printer className="size-4" aria-hidden /> Print / PDF
      </a>
    </>
  );
}

function LedgerSkeleton() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-28 rounded-2xl" />
      <Skeleton className="h-[480px] rounded-2xl" />
    </div>
  );
}

async function Ledger({ params }: { params: Params }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const filters = parseRecordFilters(params);
  const settings = await getSettings();
  const [{ rows, total, range }, classes] = await Promise.all([
    queryLedger(filters, settings, { offset: (filters.page - 1) * PAGE_SIZE }),
    getClassOptions(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const manage = can.manageRecords(user.role);
  const rangeLabel =
    range.from && range.to
      ? range.from === range.to
        ? formatDate(range.from)
        : `${formatDate(range.from)} – ${formatDate(range.to)}`
      : range.from
        ? `From ${formatDate(range.from)}`
        : range.to
          ? `Until ${formatDate(range.to)}`
          : "All time";

  return (
    <div className="flex flex-col gap-4">
      <Filters filters={filters} settings={settings} programs={classes.programs} sections={classes.sections} />

      {/* Shown only on paper */}
      <div className="hidden print:block">
        <p className="text-lg font-semibold">{settings.collegeName} — Late arrivals</p>
        <p className="text-sm">
          {rangeLabel} · {total} records
        </p>
      </div>

      <Card className="print-plain overflow-hidden">
        <div className="no-print flex items-center justify-between gap-3 border-b border-line px-5 py-3 text-[13px] text-ink-2">
          <span>
            <span className="font-semibold text-ink tabular">{total.toLocaleString()}</span>{" "}
            {total === 1 ? "record" : "records"} · {rangeLabel}
          </span>
          {pages > 1 && <span className="tabular">Page {filters.page} of {pages}</span>}
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<SearchX className="size-5" />} title="No records match these filters">
            Try a wider date range or clear the search.
          </EmptyState>
        ) : (
          <LedgerTable rows={rows} settings={settings} manage={manage} />
        )}
        {pages > 1 && (
          <div className="no-print flex items-center justify-between border-t border-line px-5 py-3">
            <PageLink filters={filters} page={filters.page - 1} disabled={filters.page <= 1}>
              <ChevronLeft className="size-4" aria-hidden /> Previous
            </PageLink>
            <span className="text-[13px] text-muted tabular">
              {(filters.page - 1) * PAGE_SIZE + 1}–{Math.min(filters.page * PAGE_SIZE, total)} of {total}
            </span>
            <PageLink filters={filters} page={filters.page + 1} disabled={filters.page >= pages}>
              Next <ChevronRight className="size-4" aria-hidden />
            </PageLink>
          </div>
        )}
      </Card>
    </div>
  );
}

function PageLink({
  filters,
  page,
  disabled,
  children,
}: {
  filters: RecordFilters;
  page: number;
  disabled: boolean;
  children: React.ReactNode;
}) {
  if (disabled) {
    return <span className={buttonClass("secondary", "sm", "pointer-events-none opacity-40")}>{children}</span>;
  }
  return (
    <ButtonLink size="sm" href={`/records?view=search&${filtersToQuery(filters, { page })}`} scroll={false}>
      {children}
    </ButtonLink>
  );
}

function Filters({
  filters,
  settings,
  programs,
  sections,
}: {
  filters: RecordFilters;
  settings: Settings;
  programs: string[];
  sections: string[];
}) {
  const quick = [
    { name: "habitual", value: "1", active: filters.habitual, label: `Habitual (${settings.habitualThreshold}+ this month)` },
    { name: "fines", value: "unpaid", active: filters.fines === "unpaid", label: "Unpaid fines" },
  ];
  return (
    <Card className="no-print p-4">
      <FilterForm action="/records" className="flex flex-col gap-3">
        <input type="hidden" name="view" value="search" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(5,minmax(0,1fr))]">
          <Input
            type="search"
            name="q"
            defaultValue={filters.q}
            placeholder="Roll no., name, father's name or phone"
            aria-label="Search"
          />
          <Select name="range" defaultValue={filters.range} aria-label="Date range">
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Select name="program" defaultValue={filters.program} aria-label="Program">
            <option value="">All programs</option>
            {programs.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select name="section" defaultValue={filters.section} aria-label="Section">
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select name="shift" defaultValue={filters.shift} aria-label="Shift">
            <option value="">Both shifts</option>
            <option value="MORNING">Morning shift</option>
            <option value="EVENING">Evening shift</option>
          </Select>
          <Select name="strike" defaultValue={filters.strike} aria-label="Times late this month">
            <option value="">Any number of times</option>
            <option value="low">Late 1–{settings.habitualThreshold - 1} times</option>
            <option value="habitual">
              Late {settings.habitualThreshold}–{settings.criticalThreshold - 1} times
            </option>
            <option value="critical">Late {settings.criticalThreshold}+ times</option>
          </Select>
        </div>
        {filters.range === "custom" && (
          <div className="flex flex-wrap items-center gap-2 text-[13px] text-ink-2">
            <span>From</span>
            <Input type="date" name="from" defaultValue={filters.from} className="w-auto" aria-label="From date" />
            <span>to</span>
            <Input type="date" name="to" defaultValue={filters.to} className="w-auto" aria-label="To date" />
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          {RANGES.filter((r) => r.value !== "custom").map((r) => (
            <Link
              key={r.value}
              href={`/records?view=search&${filtersToQuery({ ...filters, range: r.value, page: 1 })}`}
              className={cx(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium",
                filters.range === r.value ? "border-accent bg-accent text-on-accent" : "border-line text-ink-2 hover:bg-surface-2",
              )}
            >
              {r.label}
            </Link>
          ))}
          <span className="mx-1 h-5 w-px bg-line" aria-hidden />
          {quick.map((q) => (
            <label
              key={q.name}
              className={cx(
                "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium transition-colors select-none",
                q.active ? "border-accent/50 bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-2",
              )}
            >
              <input type="checkbox" name={q.name} value={q.value} defaultChecked={q.active} className="accent-[var(--accent)]" />
              {q.label}
            </label>
          ))}
          {filtersToQuery({ ...filters, page: 1 }) && (
            <Link href="/records?view=search" className="ml-auto text-[13px] font-medium text-accent-ink hover:underline">
              Clear filters
            </Link>
          )}
        </div>
      </FilterForm>
    </Card>
  );
}
