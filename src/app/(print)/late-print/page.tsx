import type { Metadata } from "next";
import { Suspense } from "react";
import { PrintToolbar } from "@/components/print-toolbar";
import { Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ACTION_LABELS, REASON_LABELS } from "@/lib/labels";
import { parseRecordFilters, queryLedger } from "@/lib/records";
import { getSettings } from "@/lib/settings";
import { ordinal } from "@/lib/strikes";
import { formatDate, formatTime, localParts } from "@/lib/time";

export const metadata: Metadata = { title: "Late arrivals — print" };

export default function LatePrintPage(props: PageProps<"/late-print">) {
  return (
    <>
      <PrintToolbar title="Late arrivals" />
      <Suspense fallback={<Skeleton className="mx-auto mt-8 h-[800px] w-full max-w-[297mm] rounded-none" />}>
        <Sheet searchParams={props.searchParams} />
      </Suspense>
    </>
  );
}

async function Sheet({ searchParams }: { searchParams: PageProps<"/late-print">["searchParams"] }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const filters = parseRecordFilters(await searchParams);
  const settings = await getSettings();
  const { rows, total, range } = await queryLedger(filters, settings, { limit: 3000 });
  // Oldest first reads naturally on paper.
  const list = [...rows].reverse();
  const single = range.from && range.from === range.to;
  const title = single
    ? formatDate(range.from!, { weekday: true })
    : range.from && range.to
      ? `${formatDate(range.from)} – ${formatDate(range.to)}`
      : range.from
        ? `From ${formatDate(range.from)}`
        : "All records";
  const fines = list.reduce((a, r) => a + r.fineAmount, 0);
  const extras = [
    filters.program && `Program: ${filters.program}`,
    filters.section && `Section: ${filters.section}`,
    filters.shift && `${filters.shift === "EVENING" ? "Evening" : "Morning"} shift`,
    filters.q && `Search: “${filters.q}”`,
    filters.habitual && "Habitual late-comers only",
    filters.fines && "Unpaid fines only",
  ].filter(Boolean);

  return (
    <div className="px-4 py-8 print:p-0">
      <style>{`@page { size: A4 landscape; margin: 12mm; }`}</style>
      <article className="mx-auto max-w-[297mm] bg-white p-[12mm] text-[12px] leading-snug text-black shadow-pop print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-black pb-2 text-center">
          <p className="text-lg font-bold tracking-tight uppercase">{settings.collegeName}</p>
          {settings.collegeAddress && <p className="text-[12px]">{settings.collegeAddress}</p>}
          <p className="mt-0.5 text-[12px] font-semibold tracking-[0.15em] uppercase">Late arrival register</p>
        </header>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-2">
          <div>
            <p className="text-[15px] font-semibold">{title}</p>
            {extras.length > 0 && <p>{extras.join(" · ")}</p>}
          </div>
          <p className="text-right">
            {total} {total === 1 ? "student" : "students"} late
            {fines > 0 && ` · fines Rs. ${fines.toLocaleString()}`}
            <br />
            Printed {formatDate(localParts(new Date(), settings.timezone).date)}
          </p>
        </div>

        {list.length === 0 ? (
          <p className="mt-10 text-center text-[14px]">No late arrivals.</p>
        ) : (
          <table className="mt-3 w-full border-collapse">
            <thead>
              <tr>
                {["#", ...(single ? [] : ["Date"]), "Roll no.", "Name", "Father's name", "Class", "Arrived", "Late by", "Reason", "Times late this month", "Action", "Fine (Rs.)"].map((h) => (
                  <th key={h} className="border border-black bg-neutral-100 px-1.5 py-1 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map((r, i) => (
                <tr key={r.id} className="break-inside-avoid">
                  <td className="border border-black px-1.5 py-1">{i + 1}</td>
                  {!single && <td className="border border-black px-1.5 py-1 whitespace-nowrap">{formatDate(r.lateDate)}</td>}
                  <td className="border border-black px-1.5 py-1 font-mono whitespace-nowrap">{r.rollNo}</td>
                  <td className="border border-black px-1.5 py-1">{r.fullName}</td>
                  <td className="border border-black px-1.5 py-1">{r.fatherName}</td>
                  <td className="border border-black px-1.5 py-1">
                    {r.program} · {r.section}
                  </td>
                  <td className="border border-black px-1.5 py-1 whitespace-nowrap">{formatTime(r.arrivedAt, settings.timezone)}</td>
                  <td className="border border-black px-1.5 py-1 whitespace-nowrap">{r.minutesLate} min</td>
                  <td className="border border-black px-1.5 py-1">{REASON_LABELS[r.reason]}</td>
                  <td className="border border-black px-1.5 py-1 whitespace-nowrap">{ordinal(r.strikeNo)} time</td>
                  <td className="border border-black px-1.5 py-1">{ACTION_LABELS[r.actionTaken]}</td>
                  <td className="border border-black px-1.5 py-1 text-right">{r.fineAmount > 0 ? `${r.fineAmount}${r.finePaid ? " (paid)" : ""}` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {total > list.length && <p className="mt-2">Showing the first {list.length} of {total} records.</p>}

        <div className="mt-14 flex justify-between text-[12px]">
          {["Gate staff", "Discipline In-Charge", "Principal"].map((s) => (
            <div key={s} className="text-center">
              <div className="mb-1 w-44 border-b border-black" />
              <p className="font-semibold">{s}</p>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
