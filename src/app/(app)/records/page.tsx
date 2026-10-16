import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
  FileText,
  Printer,
  SearchX,
  Ticket,
} from "lucide-react";
import { FilterForm, PrintButton } from "@/components/filter-form";
import { RecordManager } from "@/components/record-manager";
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
import { ACTION_LABELS, REASON_LABELS } from "@/lib/labels";
import {
  PAGE_SIZE,
  RANGES,
  filtersToQuery,
  getClassOptions,
  parseRecordFilters,
  queryLedger,
  type RecordFilters,
} from "@/lib/records";
import { getSettings, type Settings } from "@/lib/settings";
import { ordinal, strikeLevel } from "@/lib/strikes";
import { formatDate, formatTime } from "@/lib/time";

export const metadata: Metadata = { title: "Late records" };

export default function RecordsPage(props: PageProps<"/records">) {
  return (
    <div>
      <PageHeader
        title="Late records"
        description="Search, filter and export every late arrival."
        actions={
          <Suspense>
            <ExportActions searchParams={props.searchParams} />
          </Suspense>
        }
      />
      <Suspense fallback={<LedgerSkeleton />}>
        <Ledger searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

type SP = PageProps<"/records">["searchParams"];

async function ExportActions({ searchParams }: { searchParams: SP }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const qs = filtersToQuery({ ...parseRecordFilters(await searchParams), page: 1 });
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

async function Ledger({ searchParams }: { searchParams: SP }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const filters = parseRecordFilters(await searchParams);
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
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Class</Th>
                <Th>Date &amp; arrival</Th>
                <Th>Strike</Th>
                <Th>Reason / action</Th>
                <Th>ID card</Th>
                <Th>Fine</Th>
                <Th className="no-print text-right">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-surface-2/50">
                  <Td>
                    <Link href={`/students/${encodeURIComponent(r.rollNo)}`} className="group flex items-center gap-3">
                      <span className="no-print">
                        <Avatar name={r.fullName} photoUrl={r.photoUrl} size="sm" />
                      </span>
                      <span>
                        <span className="block font-medium group-hover:underline">{r.fullName}</span>
                        <span className="block font-mono text-[12px] text-muted">{r.rollNo}</span>
                      </span>
                    </Link>
                  </Td>
                  <Td>
                    <span className="block">{r.program}</span>
                    <span className="block text-[12px] text-muted">{r.section}</span>
                  </Td>
                  <Td className="whitespace-nowrap">
                    <span className="block">{formatDate(r.lateDate)}</span>
                    <span className="block text-[12px] text-muted tabular">
                      {formatTime(r.arrivedAt, settings.timezone)} · {r.minutesLate} min late
                    </span>
                  </Td>
                  <Td>
                    <StrikeBadge level={strikeLevel(r.strikeNo, settings)} label={`${ordinal(r.strikeNo)} of ${r.monthCount}`} />
                  </Td>
                  <Td>
                    <span className="block">{REASON_LABELS[r.reason]}</span>
                    <span className="block text-[12px] text-muted">{ACTION_LABELS[r.actionTaken]}</span>
                  </Td>
                  <Td>
                    {r.cardStatus === "HELD" ? (
                      <Pill tone="warning">Held</Pill>
                    ) : r.cardStatus === "RETURNED" ? (
                      <Pill tone="good">Returned</Pill>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td>
                    {r.fineAmount > 0 ? (
                      <Pill tone={r.finePaid ? "good" : "critical"}>
                        Rs. {r.fineAmount} · {r.finePaid ? "Paid" : "Unpaid"}
                      </Pill>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </Td>
                  <Td className="no-print">
                    <div className="flex justify-end gap-1.5">
                      <a href={`/pass/${r.id}`} target="_blank" rel="noreferrer" className={buttonClass("ghost", "sm")} title="Print gate pass">
                        <Ticket className="size-3.5" aria-hidden />
                        <span className="sr-only">Gate pass</span>
                      </a>
                      {manage && (
                        <RecordManager
                          compact
                          record={{
                            id: r.id,
                            fullName: r.fullName,
                            dateLabel: formatDate(r.lateDate),
                            reason: r.reason,
                            actionTaken: r.actionTaken,
                            cardStatus: r.cardStatus,
                            fineAmount: r.fineAmount,
                            finePaid: r.finePaid,
                            remarks: r.remarks,
                          }}
                        />
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
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
    <ButtonLink size="sm" href={`/records?${filtersToQuery(filters, { page })}`} scroll={false}>
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
    { name: "card", value: "held", active: filters.card === "held", label: "ID card held" },
    { name: "fines", value: "unpaid", active: filters.fines === "unpaid", label: "Unpaid fines" },
  ];
  return (
    <Card className="no-print p-4">
      <FilterForm action="/records" className="flex flex-col gap-3">
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
            <Link href="/records" className="ml-auto text-[13px] font-medium text-accent-ink hover:underline">
              Clear filters
            </Link>
          )}
        </div>
      </FilterForm>
    </Card>
  );
}
