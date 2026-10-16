import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarX, ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Plus, Printer, ShieldCheck } from "lucide-react";
import { FilterForm, PrintButton } from "@/components/filter-form";
import { MonthCalendar } from "@/components/month-calendar";
import { ButtonLink, Card, EmptyState, Input, PageHeader, Select, Skeleton, StrikeBadge, buttonClass, cx } from "@/components/ui";
import { ViewTabs, pickView } from "@/components/view-tabs";
import { ViolationTable } from "@/components/violation-table";
import { can, requireUser } from "@/lib/auth";
import { SEVERITY_LABELS, SEVERITY_LEVEL } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { RANGES, getClassOptions, monthOptions } from "@/lib/records";
import { getSettings } from "@/lib/settings";
import { addDays, formatDate, formatMonth, fromDbDate, isValidMonth, isValidYmd, localParts, nextMonthStart, toDbDate } from "@/lib/time";
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
  const monthWhere = { incidentDate: { gte: toDbDate(`${month}-01`), lt: toDbDate(nextMonthStart(`${month}-01`)) } };
  const [bySeverity, byType, fines, unpaidAll, openList, repeat] = await Promise.all([
    prisma.violation.groupBy({ by: ["severity"], where: monthWhere, _count: { _all: true } }),
    prisma.violation.groupBy({ by: ["typeId"], where: monthWhere, _count: { _all: true } }),
    prisma.violation.aggregate({ where: monthWhere, _sum: { fineAmount: true } }),
    prisma.violation.aggregate({ where: { finePaid: false, fineAmount: { gt: 0 } }, _sum: { fineAmount: true }, _count: { _all: true } }),
    prisma.violation.findMany({
      where: { status: "OPEN" },
      orderBy: [{ incidentDate: "asc" }],
      take: 8,
      include: { type: { select: { name: true } }, student: { select: { fullName: true, section: true } } },
    }),
    prisma.violation.groupBy({ by: ["rollNo"], _count: { _all: true }, having: { rollNo: { _count: { gte: 2 } } }, orderBy: { _count: { rollNo: "desc" } }, take: 8 }),
  ]);
  const typeNames = new Map((await prisma.violationType.findMany({ select: { id: true, name: true } })).map((t) => [t.id, t.name]));
  const repeatStudents = repeat.length
    ? new Map((await prisma.student.findMany({ where: { rollNo: { in: repeat.map((r) => r.rollNo) } }, select: { rollNo: true, fullName: true, section: true } })).map((x) => [x.rollNo, x]))
    : new Map<string, { rollNo: string; fullName: string; section: string }>();
  const sev = (k: string) => bySeverity.find((b) => b.severity === k)?._count._all ?? 0;
  const typeTotal = byType.reduce((a, t) => a + t._count._all, 0);
  const daysOpen = (d: Date) => Math.max(0, Math.round((toDbDate(today).getTime() - d.getTime()) / 86_400_000));
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
      <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <Card className="no-print overflow-hidden lg:sticky lg:top-6">
        <MonthCalendar
          basePath="/violations"
          month={month}
          months={monthOptions(thisMonth, earliest ? fromDbDate(earliest.incidentDate).slice(0, 7) : null)}
          today={today}
          selected={date}
          counts={counts}
          noun={["case", "cases"]}
        />
        <p className="border-t border-line px-4 py-3 text-[12px] leading-relaxed text-ink-2">
          <span className="font-semibold text-ink tabular">{monthTotal}</span> {monthTotal === 1 ? "violation" : "violations"} in{" "}
          {formatMonth(`${month}-01`)} · {students.length} {students.length === 1 ? "student" : "students"} · on {daysWithCases.length}{" "}
          {daysWithCases.length === 1 ? "day" : "days"}
        </p>
      </Card>
      <div className="flex min-w-0 flex-col gap-4">

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
      </div>

      <div className="no-print grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[
          { label: "Cases this month", value: monthTotal.toLocaleString(), sub: `${students.length} students` },
          { label: "Minor", value: sev("MINOR").toLocaleString(), href: `/violations?view=search&range=custom&from=${month}-01&to=${addDays(nextMonthStart(`${month}-01`), -1)}&severity=MINOR` },
          { label: "Major", value: sev("MAJOR").toLocaleString(), href: `/violations?view=search&range=custom&from=${month}-01&to=${addDays(nextMonthStart(`${month}-01`), -1)}&severity=MAJOR` },
          { label: "Severe", value: sev("SEVERE").toLocaleString(), href: `/violations?view=search&range=custom&from=${month}-01&to=${addDays(nextMonthStart(`${month}-01`), -1)}&severity=SEVERE` },
          {
            label: "Unpaid fines (all)",
            value: `Rs. ${Number(unpaidAll._sum.fineAmount ?? 0).toLocaleString()}`,
            sub: `${unpaidAll._count._all} ${unpaidAll._count._all === 1 ? "case" : "cases"} · Rs. ${Number(fines._sum.fineAmount ?? 0).toLocaleString()} fined this month`,
            href: "/violations?view=search&range=all&fines=unpaid",
          },
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

      <div className="no-print grid gap-4 xl:grid-cols-3">
        <Card className="overflow-hidden xl:col-span-2">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <div>
              <h2 className="text-[15px] font-semibold">Open cases</h2>
              <p className="text-[13px] text-muted">Oldest first — close them once action is complete</p>
            </div>
            {openCases > openList.length && (
              <Link href="/violations?view=search&range=all&status=OPEN" className="text-[13px] font-medium text-accent-ink hover:underline">
                All {openCases}
              </Link>
            )}
          </div>
          {openList.length === 0 ? (
            <p className="px-5 py-6 text-[13px] text-muted">No open cases. Everything is closed.</p>
          ) : (
            <ul className="divide-y divide-line">
              {openList.map((v) => {
                const age = daysOpen(v.incidentDate);
                return (
                  <li key={v.id}>
                    <Link href={`/violations/${v.id}`} className="flex items-center gap-3 px-5 py-2.5 hover:bg-surface-2/60">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">
                          {v.student.fullName} · {v.type.name}
                        </span>
                        <span className="block truncate text-[12px] text-muted">
                          <span className="font-mono">{v.rollNo}</span> · {v.student.section} · {formatDate(fromDbDate(v.incidentDate))}
                        </span>
                      </span>
                      <StrikeBadge level={SEVERITY_LEVEL[v.severity]} label={SEVERITY_LABELS[v.severity]} />
                      <span className={cx("w-20 text-right text-[12px] tabular", age > 14 ? "font-medium text-danger-ink" : "text-muted")}>
                        {age === 0 ? "today" : `${age} days open`}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
        <div className="flex flex-col gap-4">
          <Card className="overflow-hidden">
            <div className="border-b border-line px-5 py-3">
              <h2 className="text-[15px] font-semibold">Repeat offenders</h2>
              <p className="text-[13px] text-muted">2 or more violations on record</p>
            </div>
            {repeat.length === 0 ? (
              <p className="px-5 py-4 text-[13px] text-muted">None.</p>
            ) : (
              <ul className="divide-y divide-line">
                {repeat.map((r) => {
                  const st = repeatStudents.get(r.rollNo);
                  return (
                    <li key={r.rollNo}>
                      <Link href={`/students/${encodeURIComponent(r.rollNo)}`} className="flex items-center justify-between gap-3 px-5 py-2 hover:bg-surface-2/60">
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{st?.fullName ?? r.rollNo}</span>
                          <span className="block text-[12px] text-muted">
                            <span className="font-mono">{r.rollNo}</span> · {st?.section}
                          </span>
                        </span>
                        <span className="text-sm font-semibold tabular">{r._count._all}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Card>
          {byType.length > 0 && (
            <Card className="overflow-hidden">
              <div className="border-b border-line px-5 py-3">
                <h2 className="text-[15px] font-semibold">By type</h2>
                <p className="text-[13px] text-muted">{formatMonth(`${month}-01`)}</p>
              </div>
              <ul className="flex flex-col gap-3 px-5 py-4">
                {[...byType].sort((a, b) => b._count._all - a._count._all).map((t) => {
                  const pct = typeTotal ? Math.round((t._count._all / typeTotal) * 100) : 0;
                  return (
                    <li key={t.typeId}>
                      <div className="flex justify-between text-[13px]">
                        <span>{typeNames.get(t.typeId)}</span>
                        <span className="text-muted tabular">{t._count._all}</span>
                      </div>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <div className="h-full rounded-full bg-accent" style={{ width: `${pct}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            </Card>
          )}
        </div>
      </div>
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
          <Select name="shift" defaultValue={filters.shift} aria-label="Shift">
            <option value="">Both shifts</option>
            <option value="MORNING">Morning shift</option>
            <option value="EVENING">Evening shift</option>
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
          {RANGES.filter((r) => r.value !== "custom").map((r) => (
            <Link
              key={r.value}
              href={`/violations?view=search&${violationFiltersToQuery({ ...filters, range: r.value, page: 1 })}`}
              className={cx(
                "rounded-full border px-3 py-1.5 text-[13px] font-medium",
                filters.range === r.value ? "border-accent bg-accent text-on-accent" : "border-line text-ink-2 hover:bg-surface-2",
              )}
            >
              {r.label}
            </Link>
          ))}
        </div>
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
