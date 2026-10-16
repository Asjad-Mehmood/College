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
import { FilterForm, PrintButton } from "@/components/filter-form";
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
  buttonClass,
  cx,
} from "@/components/ui";
import { ViewTabs, pickView } from "@/components/view-tabs";
import { can, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
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
import { formatDate, formatMonth, fromDbDate, isValidMonth, isValidYmd, localParts, monthStart, nextMonthStart, toDbDate } from "@/lib/time";

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

  const [counts, earliest, students] = await Promise.all([
    lateCountsForMonth(month),
    prisma.lateRecord.findFirst({ orderBy: { lateDate: "asc" }, select: { lateDate: true } }),
    prisma.lateRecord.groupBy({
      by: ["rollNo"],
      where: { lateDate: { gte: toDbDate(monthStart(`${month}-01`)), lt: toDbDate(nextMonthStart(`${month}-01`)) } },
    }),
  ]);

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
      <Card className="no-print overflow-hidden">
        <MonthCalendar
          basePath="/records"
          month={month}
          months={monthOptions(thisMonth, earliest ? fromDbDate(earliest.lateDate).slice(0, 7) : null)}
          today={today}
          selected={date}
          counts={counts}
          noun={["late arrival", "late arrivals"]}
        />
        <p className="border-t border-line px-5 py-3 text-[13px] text-ink-2">
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
                  <PrintButton>
                    <Printer className="size-4" aria-hidden /> Print
                  </PrintButton>
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
      <PrintButton>
        <Printer className="size-4" aria-hidden /> Print / PDF
      </PrintButton>
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
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))]">
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
          <Select name="strike" defaultValue={filters.strike} aria-label="Strike level">
            <option value="">Any strike</option>
            <option value="low">Strikes 1–{settings.habitualThreshold - 1}</option>
            <option value="habitual">
              Strikes {settings.habitualThreshold}–{settings.criticalThreshold - 1}
            </option>
            <option value="critical">Strikes {settings.criticalThreshold}+</option>
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
