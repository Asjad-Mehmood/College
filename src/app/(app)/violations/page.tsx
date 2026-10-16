import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarX, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Plus, Printer, ShieldCheck } from "lucide-react";
import { FilterForm, PrintButton } from "@/components/filter-form";
import { MonthCalendar } from "@/components/month-calendar";
import { ButtonLink, Card, EmptyState, Input, PageHeader, Select, Skeleton, buttonClass, cx } from "@/components/ui";
import { ViewTabs, pickView } from "@/components/view-tabs";
import { ViolationTable } from "@/components/violation-table";
import { can, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RANGES, getClassOptions, monthOptions } from "@/lib/records";
import { getSettings } from "@/lib/settings";
import { formatDate, formatMonth, fromDbDate, isValidMonth, isValidYmd, localParts, nextMonthStart, toDbDate } from "@/lib/time";
import {
  VIOLATION_PAGE_SIZE,
  getViolationTypes,
  parseViolationFilters,
  queryViolations,
  violationCountsForMonth,
  violationFiltersToQuery,
  type ViolationFilters,
} from "@/lib/violations";

export const metadata: Metadata = { title: "Violations" };

type SP = PageProps<"/violations">["searchParams"];

export default function ViolationsPage(props: PageProps<"/violations">) {
  return (
    <div>
      <PageHeader
        title="Discipline violations"
        description="Browse cases by month and date, or search every violation."
        actions={
          <Suspense>
            <HeaderActions searchParams={props.searchParams} />
          </Suspense>
        }
      />
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-28 rounded-2xl" />
            <Skeleton className="h-[480px] rounded-2xl" />
          </div>
        }
      >
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: SP }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const params = await searchParams;
  const view = pickView(params);
  return (
    <>
      <ViewTabs basePath="/violations" view={view} />
      {view === "search" ? <Register params={params} /> : <MonthView params={params} />}
    </>
  );
}

type Params = Awaited<SP>;

async function MonthView({ params }: { params: Params }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const manage = can.manageRecords(user.role);
  const openCases = await prisma.violation.count({ where: { status: "OPEN" } });
  const settings = await getSettings();
  const today = localParts(new Date(), settings.timezone).date;
  const thisMonth = today.slice(0, 7);
  const monthParam = typeof params.month === "string" ? params.month : undefined;
  const month = isValidMonth(monthParam) && monthParam <= thisMonth ? monthParam : thisMonth;

  const [counts, earliest, students] = await Promise.all([
    violationCountsForMonth(month),
    prisma.violation.findFirst({ orderBy: { incidentDate: "asc" }, select: { incidentDate: true } }),
    prisma.violation.groupBy({
      by: ["rollNo"],
      where: { incidentDate: { gte: toDbDate(`${month}-01`), lt: toDbDate(nextMonthStart(`${month}-01`)) } },
    }),
  ]);

  const dateParam = typeof params.date === "string" ? params.date : undefined;
  const daysWithCases = Object.keys(counts).sort();
  const date =
    isValidYmd(dateParam) && dateParam.startsWith(month) && dateParam <= today
      ? dateParam
      : month === thisMonth
        ? today
        : (daysWithCases.at(-1) ?? null);
  const monthTotal = Object.values(counts).reduce((a, b) => a + b, 0);
  const { rows } = date
    ? await queryViolations({ ...parseViolationFilters({}), range: "custom", from: date, to: date }, settings, { limit: 1000 })
    : { rows: [] };
  const dayQs = date ? `range=custom&from=${date}&to=${date}` : "";

  return (
    <div className="flex flex-col gap-4">
      {openCases > 0 && (
        <Link
          href="/violations?view=search&status=OPEN"
          className="no-print flex items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent-soft px-5 py-3 text-sm font-medium text-accent-ink hover:border-accent/60"
        >
          <span>
            {openCases} open {openCases === 1 ? "case" : "cases"} need attention
          </span>
          <span className="inline-flex items-center gap-1">
            Review and manage <ChevronRight className="size-4" aria-hidden />
          </span>
        </Link>
      )}
      <Card className="no-print overflow-hidden">
        <MonthCalendar
          basePath="/violations"
          month={month}
          months={monthOptions(thisMonth, earliest ? fromDbDate(earliest.incidentDate).slice(0, 7) : null)}
          today={today}
          selected={date}
          counts={counts}
          noun={["case", "cases"]}
        />
        <p className="border-t border-line px-5 py-3 text-[13px] text-ink-2">
          <span className="font-semibold text-ink tabular">{monthTotal}</span> {monthTotal === 1 ? "violation" : "violations"} in{" "}
          {formatMonth(`${month}-01`)} · {students.length} {students.length === 1 ? "student" : "students"} · on {daysWithCases.length}{" "}
          {daysWithCases.length === 1 ? "day" : "days"}
        </p>
      </Card>

      {date && (
        <div className="hidden print:block">
          <p className="text-lg font-semibold">{settings.collegeName} — Discipline violations</p>
          <p className="text-sm">
            {formatDate(date, { weekday: true })} · {rows.length} cases
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
                  {rows.length} {rows.length === 1 ? "case" : "cases"}
                </p>
              </div>
              {rows.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  <a className={buttonClass("secondary", "sm")} href={`/api/export/violations?format=xlsx&${dayQs}`}>
                    <FileSpreadsheet className="size-3.5" aria-hidden /> Excel
                  </a>
                  <a className={buttonClass("secondary", "sm")} href={`/api/export/violations?format=csv&${dayQs}`}>
                    <FileText className="size-3.5" aria-hidden /> CSV
                  </a>
                  <PrintButton>
                    <Printer className="size-4" aria-hidden /> Print
                  </PrintButton>
                </div>
              )}
            </div>
            {rows.length === 0 ? (
              <EmptyState icon={<CalendarX className="size-5" />} title="No violations on this day" />
            ) : (
              <ViolationTable rows={rows} manage={manage} />
            )}
          </>
        ) : (
          <EmptyState icon={<CalendarX className="size-5" />} title={`No violations in ${formatMonth(`${month}-01`)}`}>
            Pick another month above.
          </EmptyState>
        )}
      </Card>
    </div>
  );
}

async function HeaderActions({ searchParams }: { searchParams: SP }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const params = await searchParams;
  const qs = violationFiltersToQuery({ ...parseViolationFilters(params), page: 1 });
  const sep = qs ? "&" : "";
  return (
    <>
      {pickView(params) === "search" && (
        <>
          <a className={buttonClass("secondary")} href={`/api/export/violations?format=xlsx${sep}${qs}`}>
            <FileSpreadsheet className="size-4" aria-hidden /> Excel
          </a>
          <a className={buttonClass("secondary")} href={`/api/export/violations?format=csv${sep}${qs}`}>
            <FileText className="size-4" aria-hidden /> CSV
          </a>
          <PrintButton>
            <Printer className="size-4" aria-hidden /> Print / PDF
          </PrintButton>
        </>
      )}
      {can.manageRecords(user.role) && (
        <ButtonLink href="/violations/new" variant="primary">
          <Plus className="size-4" aria-hidden /> Record violation
        </ButtonLink>
      )}
    </>
  );
}

async function Register({ params }: { params: Params }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const manage = can.manageRecords(user.role);
  const filters = parseViolationFilters(params);
  const settings = await getSettings();
  const [{ rows, total, range }, classes, types] = await Promise.all([
    queryViolations(filters, settings, { offset: (filters.page - 1) * VIOLATION_PAGE_SIZE }),
    getClassOptions(),
    getViolationTypes(),
  ]);
  const pages = Math.max(1, Math.ceil(total / VIOLATION_PAGE_SIZE));
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
      <Filters filters={filters} programs={classes.programs} sections={classes.sections} types={types} />

      <div className="hidden print:block">
        <p className="text-lg font-semibold">{settings.collegeName} — Discipline violations</p>
        <p className="text-sm">
          {rangeLabel} · {total} cases
        </p>
      </div>

      <Card className="print-plain overflow-hidden">
        <div className="no-print flex items-center justify-between gap-3 border-b border-line px-5 py-3 text-[13px] text-ink-2">
          <span>
            <span className="font-semibold text-ink tabular">{total.toLocaleString()}</span> {total === 1 ? "case" : "cases"} · {rangeLabel}
          </span>
          {pages > 1 && <span className="tabular">Page {filters.page} of {pages}</span>}
        </div>
        {rows.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="size-5" />} title="No violations match these filters">
            Recorded violations appear here.
          </EmptyState>
        ) : (
          <ViolationTable rows={rows} manage={manage} />
        )}
        {pages > 1 && (
          <div className="no-print flex items-center justify-between border-t border-line px-5 py-3">
            {filters.page > 1 ? (
              <ButtonLink size="sm" href={`/violations?view=search&${violationFiltersToQuery(filters, { page: filters.page - 1 })}`}>
                <ChevronLeft className="size-4" aria-hidden /> Previous
              </ButtonLink>
            ) : (
              <span />
            )}
            {filters.page < pages && (
              <ButtonLink size="sm" href={`/violations?view=search&${violationFiltersToQuery(filters, { page: filters.page + 1 })}`}>
                Next <ChevronRight className="size-4" aria-hidden />
              </ButtonLink>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}

function Filters({
  filters,
  programs,
  sections,
  types,
}: {
  filters: ViolationFilters;
  programs: string[];
  sections: string[];
  types: { id: number; name: string }[];
}) {
  const statusChips = [
    { value: "", label: "All cases" },
    { value: "OPEN", label: "Open" },
    { value: "CLOSED", label: "Closed" },
  ];
  return (
    <Card className="no-print p-4">
      <FilterForm action="/violations" className="flex flex-col gap-3">
        <input type="hidden" name="view" value="search" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <Input type="search" name="q" defaultValue={filters.q} placeholder="Roll no., name, father's name or phone" aria-label="Search" />
          <Select name="range" defaultValue={filters.range} aria-label="Date range">
            {RANGES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </Select>
          <Select name="type" defaultValue={filters.type ?? ""} aria-label="Violation type">
            <option value="">All violation types</option>
            {types.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </Select>
          <Select name="severity" defaultValue={filters.severity} aria-label="Severity">
            <option value="">Any severity</option>
            <option value="MINOR">Minor</option>
            <option value="MAJOR">Major</option>
            <option value="SEVERE">Severe</option>
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
          <div className="inline-flex rounded-full border border-line p-0.5" role="radiogroup" aria-label="Case status">
            {statusChips.map((c) => (
              <label
                key={c.value}
                className={cx(
                  "cursor-pointer rounded-full px-3 py-1 text-[13px] font-medium select-none",
                  filters.status === c.value ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2",
                )}
              >
                <input type="radio" name="status" value={c.value} defaultChecked={filters.status === c.value} className="sr-only" />
                {c.label}
              </label>
            ))}
          </div>
          <label
            className={cx(
              "inline-flex cursor-pointer items-center gap-2 rounded-full border px-3 py-1.5 text-[13px] font-medium select-none",
              filters.fines ? "border-accent/50 bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-2",
            )}
          >
            <input type="checkbox" name="fines" value="unpaid" defaultChecked={!!filters.fines} className="accent-[var(--accent)]" />
            Unpaid fines
          </label>
          {violationFiltersToQuery({ ...filters, page: 1 }) && (
            <Link href="/violations?view=search" className="ml-auto text-[13px] font-medium text-accent-ink hover:underline">
              Clear filters
            </Link>
          )}
        </div>
      </FilterForm>
    </Card>
  );
}
