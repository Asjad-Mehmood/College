import type { Metadata } from "next";
import { Suspense } from "react";
import { PrintToolbar } from "@/components/print-toolbar";
import { Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CASE_STATUS_LABELS, SEVERITY_LABELS, VIOLATION_ACTION_LABELS } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { formatDate, fromDbDate, localParts } from "@/lib/time";
import { parseViolationFilters, queryViolations } from "@/lib/violations";

export const metadata: Metadata = { title: "Violations — print" };

export default function ViolationPrintPage(props: PageProps<"/violation-print">) {
  return (
    <>
      <PrintToolbar title="Discipline violations" />
      <Suspense fallback={<Skeleton className="mx-auto mt-8 h-[800px] w-full max-w-[297mm] rounded-none" />}>
        <Sheet searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Sheet({ searchParams }: { searchParams: PageProps<"/violation-print">["searchParams"] }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const filters = parseViolationFilters(await searchParams);
  const settings = await getSettings();
  const { rows, total, range } = await queryViolations(filters, settings, { limit: 3000 });
  const list = [...rows].reverse();
  const single = range.from && range.from === range.to;
  const title = single
    ? formatDate(range.from!, { weekday: true })
    : range.from && range.to
      ? `${formatDate(range.from)} – ${formatDate(range.to)}`
      : range.from
        ? `From ${formatDate(range.from)}`
        : "All cases";
  const fines = list.reduce((a, r) => a + r.fineAmount, 0);
  const extras = [
    filters.severity && SEVERITY_LABELS[filters.severity],
    filters.status && `${CASE_STATUS_LABELS[filters.status]} cases`,
    filters.program && `Program: ${filters.program}`,
    filters.section && `Section: ${filters.section}`,
    filters.shift && `${filters.shift === "EVENING" ? "Evening" : "Morning"} shift`,
    filters.q && `Search: “${filters.q}”`,
    filters.fines && "Unpaid fines only",
  ].filter(Boolean);

  return (
    <div className="px-4 py-8 print:p-0">
      <style>{`@page { size: A4 landscape; margin: 15mm 16mm; }`}</style>
      <article className="mx-auto max-w-[297mm] bg-white p-[15mm] text-[12px] leading-snug text-black shadow-pop print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-black pb-2 text-center">
          <p className="text-lg font-bold tracking-tight uppercase">{settings.collegeName}</p>
          {settings.collegeAddress && <p className="text-[12px]">{settings.collegeAddress}</p>}
          <p className="mt-0.5 text-[12px] font-semibold tracking-[0.15em] uppercase">Discipline violation register</p>
        </header>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[15px] font-semibold">{title}</p>
            {extras.length > 0 && <p>{extras.join(" · ")}</p>}
          </div>
          <p className="text-right">
            {total} {total === 1 ? "case" : "cases"}
            {fines > 0 && ` · fines Rs. ${fines.toLocaleString()}`}
            <br />
            Printed {formatDate(localParts(new Date(), settings.timezone).date)}
          </p>
        </div>

        {list.length === 0 ? (
          <p className="mt-10 text-center text-[14px]">No violations.</p>
        ) : (
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr>
                {["#", "Case", ...(single ? [] : ["Date"]), "Roll no.", "Name", "Class", "Violation", "What happened", "Action", "Fine (Rs.)", "Status"].map((h) => (
                  <th key={h} className="border border-black bg-neutral-100 px-1.5 py-1 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((v, i) => (
                <tr key={v.id} className="break-inside-avoid align-top">
                  <td className="border border-black px-1.5 py-1">{i + 1}</td>
                  <td className="border border-black px-1.5 py-1">#{v.id}</td>
                  {!single && <td className="border border-black px-1.5 py-1 whitespace-nowrap">{formatDate(fromDbDate(v.incidentDate))}</td>}
                  <td className="border border-black px-1.5 py-1 font-mono whitespace-nowrap">{v.rollNo}</td>
                  <td className="border border-black px-1.5 py-1">
                    {v.student.fullName}
                    <span className="block text-[11px]">S/O {v.student.fatherName}</span>
                  </td>
                  <td className="border border-black px-1.5 py-1">
                    {v.student.program} · {v.student.section}
                  </td>
                  <td className="border border-black px-1.5 py-1">
                    {v.type.name}
                    <span className="block text-[11px]">{SEVERITY_LABELS[v.severity]}</span>
                  </td>
                  <td className="border border-black px-1.5 py-1">
                    {v.description}
                    {v.location && <span className="block text-[11px]">At {v.location}</span>}
                  </td>
                  <td className="border border-black px-1.5 py-1">
                    {VIOLATION_ACTION_LABELS[v.actionTaken]}
                    {v.suspensionDays ? ` (${v.suspensionDays} days)` : ""}
                  </td>
                  <td className="border border-black px-1.5 py-1 text-right">{v.fineAmount > 0 ? `${v.fineAmount}${v.finePaid ? " (paid)" : ""}` : "—"}</td>
                  <td className="border border-black px-1.5 py-1">{CASE_STATUS_LABELS[v.status]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > list.length && <p className="mt-2">Showing the first {list.length} of {total} cases.</p>}

        <div className="mt-14 flex justify-between text-[12px]">
          {["Discipline In-Charge", "Principal"].map((s) => (
            <div key={s} className="text-center">
              <div className="mb-1 w-48 border-b border-black" />
              <p className="font-semibold">{s}</p>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
