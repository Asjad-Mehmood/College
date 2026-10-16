import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintToolbar } from "@/components/print-toolbar";
import { Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { REASON_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { ordinal } from "@/lib/strikes";
import { formatDate, formatTime, fromDbDate, monthStart, toDbDate } from "@/lib/time";

export const metadata: Metadata = { title: "Gate pass" };

export default function GatePassPage(props: PageProps<"/pass/[id]">) {
  return (
    <>
      <PrintToolbar title="Classroom entry slip" />
      <Suspense fallback={<Skeleton className="mx-auto mt-8 h-[480px] w-[380px] rounded-2xl" />}>
        <Pass params={props.params} />
      </Suspense>
    </>
  );
}

async function Pass({ params }: { params: PageProps<"/pass/[id]">["params"] }) {
  await requireUser();
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const settings = await getSettings();
  const record = await prisma.lateRecord.findUnique({
    where: { id },
    include: { student: true, recordedBy: { select: { fullName: true } } },
  });
  if (!record) notFound();

  const date = fromDbDate(record.lateDate);
  const strike = await prisma.lateRecord.count({
    where: { rollNo: record.rollNo, lateDate: { gte: toDbDate(monthStart(date)), lte: record.lateDate } },
  });
  const s = record.student;

  return (
    <div className="flex justify-center px-4 py-8 print:p-0">
      <style>{`@page { size: A6 portrait; margin: 0; }`}</style>
      <article className="w-[380px] rounded-2xl border border-line bg-white p-6 text-black shadow-pop print:w-full print:rounded-none print:border-0 print:p-[7mm] print:shadow-none">
        <header className="border-b-2 border-black pb-3 text-center">
          <p className="text-[15px] font-bold tracking-tight uppercase">{settings.collegeName}</p>
          <p className="mt-0.5 text-[12px] font-semibold tracking-[0.2em] uppercase">Late entry slip</p>
        </header>
        <div className="mt-3 flex justify-between text-[12px]">
          <span>
            No. <span className="font-mono font-semibold">{String(record.id).padStart(5, "0")}</span>
          </span>
          <span>{formatDate(date, { weekday: true })}</span>
        </div>
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-[13px]">
          <dt className="text-neutral-600">Name</dt>
          <dd className="font-semibold">{s.fullName}</dd>
          <dt className="text-neutral-600">Father</dt>
          <dd>{s.fatherName}</dd>
          <dt className="text-neutral-600">Roll no.</dt>
          <dd className="font-mono font-semibold">{s.rollNo}</dd>
          <dt className="text-neutral-600">Class</dt>
          <dd>
            {s.program} · {s.section}
          </dd>
          <dt className="text-neutral-600">Arrived</dt>
          <dd className="font-semibold">
            {formatTime(record.arrivedAt, settings.timezone)} ({record.minutesLate} min late)
          </dd>
          <dt className="text-neutral-600">Reason</dt>
          <dd>{REASON_LABELS[record.reason]}</dd>
          <dt className="text-neutral-600">This month</dt>
          <dd className="font-semibold">{ordinal(strike)} late arrival</dd>
        </dl>
        <p className="mt-5 rounded-lg border border-black px-3 py-2 text-center text-[12px] leading-snug">
          The student has reported to the Discipline In-Charge and may be allowed into class.
        </p>
        <footer className="mt-8 flex items-end justify-between text-[11px]">
          <div>
            <p className="text-neutral-600">Recorded by</p>
            <p className="font-medium">{record.recordedBy.fullName}</p>
          </div>
          <div className="text-center">
            <div className="mb-1 w-36 border-b border-black" />
            <p>Discipline In-Charge</p>
          </div>
        </footer>
      </article>
    </div>
  );
}
