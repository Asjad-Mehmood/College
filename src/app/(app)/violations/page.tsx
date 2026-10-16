import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, FileSpreadsheet, FileText, Plus, Printer, ShieldCheck } from "lucide-react";
import { FilterForm, PrintButton } from "@/components/filter-form";
import {
  Avatar,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Pill,
  Select,
  Skeleton,
  StrikeBadge,
  Table,
  Td,
  Th,
  buttonClass,
  cx,
} from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { SEVERITY_LABELS, SEVERITY_LEVEL, VIOLATION_ACTION_LABELS } from "@/lib/labels";
import { RANGES, getClassOptions } from "@/lib/records";
import { getSettings } from "@/lib/settings";
import { formatDate, fromDbDate } from "@/lib/time";
import {
  VIOLATION_PAGE_SIZE,
  getViolationTypes,
  parseViolationFilters,
  queryViolations,
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
        description="Every recorded violation, its action and case status."
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
        <Register searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function HeaderActions({ searchParams }: { searchParams: SP }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const qs = violationFiltersToQuery({ ...parseViolationFilters(await searchParams), page: 1 });
  const sep = qs ? "&" : "";
  return (
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
      {can.manageRecords(user.role) && (
        <ButtonLink href="/violations/new" variant="primary">
          <Plus className="size-4" aria-hidden /> Record violation
        </ButtonLink>
      )}
    </>
  );
}

async function Register({ searchParams }: { searchParams: SP }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const filters = parseViolationFilters(await searchParams);
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
          <Table>
            <thead>
              <tr>
                <Th>Case</Th>
                <Th>Student</Th>
                <Th>Violation</Th>
                <Th>Action / fine</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((v) => (
                <tr key={v.id} className="hover:bg-surface-2/50">
                  <Td className="whitespace-nowrap">
                    <Link href={`/violations/${v.id}`} className="font-medium hover:underline">
                      #{v.id}
                    </Link>
                    <span className="block text-[12px] text-muted tabular">{formatDate(fromDbDate(v.incidentDate))}</span>
                  </Td>
                  <Td>
                    <Link href={`/students/${encodeURIComponent(v.rollNo)}`} className="group flex items-center gap-3">
                      <span className="no-print">
                        <Avatar name={v.student.fullName} photoUrl={v.student.photoUrl} size="sm" />
                      </span>
                      <span>
                        <span className="block font-medium group-hover:underline">{v.student.fullName}</span>
                        <span className="block text-[12px] text-muted">
                          <span className="font-mono">{v.rollNo}</span> · {v.student.program} {v.student.section}
                        </span>
                      </span>
                    </Link>
                  </Td>
                  <Td className="max-w-72">
                    <span className="flex flex-wrap items-center gap-2">
                      <Link href={`/violations/${v.id}`} className="font-medium hover:underline">
                        {v.type.name}
                      </Link>
                      <StrikeBadge level={SEVERITY_LEVEL[v.severity]} label={SEVERITY_LABELS[v.severity]} />
                    </span>
                    <span className="mt-0.5 block truncate text-[12px] text-muted" title={v.description}>
                      {v.description}
                    </span>
                    {v.studentTotal > 1 && <span className="block text-[12px] text-danger-ink">{v.studentTotal} violations by this student</span>}
                  </Td>
                  <Td className="text-[13px]">
                    <span className="block">
                      {v.actionTaken === "SUSPENSION" ? `Suspension · ${v.suspensionDays} days` : VIOLATION_ACTION_LABELS[v.actionTaken]}
                    </span>
                    {v.fineAmount > 0 && (
                      <span className="mt-1 block">
                        <Pill tone={v.finePaid ? "good" : "critical"}>
                          Rs. {v.fineAmount} · {v.finePaid ? "Paid" : "Unpaid"}
                        </Pill>
                      </span>
                    )}
                  </Td>
                  <Td>
                    <Pill tone={v.status === "OPEN" ? "accent" : "neutral"}>{v.status === "OPEN" ? "Open" : "Closed"}</Pill>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {pages > 1 && (
          <div className="no-print flex items-center justify-between border-t border-line px-5 py-3">
            {filters.page > 1 ? (
              <ButtonLink size="sm" href={`/violations?${violationFiltersToQuery(filters, { page: filters.page - 1 })}`}>
                <ChevronLeft className="size-4" aria-hidden /> Previous
              </ButtonLink>
            ) : (
              <span />
            )}
            {filters.page < pages && (
              <ButtonLink size="sm" href={`/violations?${violationFiltersToQuery(filters, { page: filters.page + 1 })}`}>
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
            <Link href="/violations" className="ml-auto text-[13px] font-medium text-accent-ink hover:underline">
              Clear filters
            </Link>
          )}
        </div>
      </FilterForm>
    </Card>
  );
}
