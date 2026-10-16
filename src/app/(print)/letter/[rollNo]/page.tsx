import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintToolbar } from "@/components/print-toolbar";
import { Skeleton, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ACTION_LABELS, REASON_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { strikeLevel } from "@/lib/strikes";
import { formatDate, formatMinutes, formatMonth, formatTime, fromDbDate, localParts } from "@/lib/time";

export const metadata: Metadata = { title: "Warning letter" };

export default function LetterPage(props: PageProps<"/letter/[rollNo]">) {
  return (
    <Suspense
      fallback={
        <>
          <PrintToolbar title="Parent warning letter" />
          <Skeleton className="mx-auto mt-8 h-[1000px] w-full max-w-[210mm] rounded-none" />
        </>
      }
    >
      <Letter params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Letter({
  params,
  searchParams,
}: {
  params: PageProps<"/letter/[rollNo]">["params"];
  searchParams: PageProps<"/letter/[rollNo]">["searchParams"];
}) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const rollNo = decodeURIComponent((await params).rollNo);
  const sp = await searchParams;
  const settings = await getSettings();
  const student = await prisma.student.findUnique({
    where: { rollNo },
    include: { lateRecords: { orderBy: [{ lateDate: "asc" }, { arrivedAt: "asc" }] } },
  });
  if (!student) notFound();

  const today = localParts(new Date(), settings.timezone).date;
  const months = [...new Set(student.lateRecords.map((r) => fromDbDate(r.lateDate).slice(0, 7)))].sort().reverse();
  const requested = typeof sp.month === "string" && /^\d{4}-\d{2}$/.test(sp.month) ? sp.month : undefined;
  const month = requested ?? (months.includes(today.slice(0, 7)) ? today.slice(0, 7) : (months[0] ?? today.slice(0, 7)));
  const records = student.lateRecords.filter((r) => fromDbDate(r.lateDate).startsWith(month));
  const level = strikeLevel(records.length, settings);
  const severe = level === "critical";
  const refNo = `DISC/${today.slice(0, 4)}/${student.rollNo}/${month.slice(5)}`;

  return (
    <>
      <PrintToolbar title="Parent warning letter">
        {months.length > 1 && (
          <div className="flex flex-wrap gap-1">
            {months.slice(0, 6).map((m) => (
              <Link
                key={m}
                href={`/letter/${encodeURIComponent(student.rollNo)}?month=${m}`}
                className={cx(
                  "rounded-lg px-2.5 py-1.5 text-[13px] font-medium",
                  m === month ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2",
                )}
              >
                {formatMonth(`${m}-01`)}
              </Link>
            ))}
          </div>
        )}
      </PrintToolbar>
      <div className="px-4 py-8 print:p-0">
        <style>{`@page { size: A4; margin: 18mm 16mm; }`}</style>
        <article className="mx-auto max-w-[210mm] bg-white px-[16mm] py-[16mm] text-[14px] leading-relaxed text-black shadow-pop print:max-w-none print:p-0 print:shadow-none">
          <header className="border-b-2 border-black pb-4 text-center">
            <p className="text-2xl font-bold tracking-tight uppercase">{settings.collegeName}</p>
            {settings.collegeAddress && <p className="text-[13px]">{settings.collegeAddress}</p>}
            <p className="mt-1 text-[13px] font-semibold tracking-[0.15em] uppercase">Office of the Discipline In-Charge</p>
          </header>

          <div className="mt-6 flex justify-between text-[13px]">
            <p>
              Ref. No. <span className="font-mono">{refNo}</span>
            </p>
            <p>Dated: {formatDate(today)}</p>
          </div>

          <div className="mt-6">
            <p>To,</p>
            <p className="font-semibold">Mr. {student.fatherName}</p>
            <p>Father / Guardian of {student.fullName}</p>
            <p>Contact: {student.parentPhone}</p>
          </div>

          <p className="mt-6">
            <span className="font-semibold">Subject: </span>
            <span className="font-semibold underline">
              {severe ? "Final warning and summons" : "Warning"} regarding repeated late arrival of your ward
            </span>
          </p>

          <p className="mt-5">Respected Sir / Madam,</p>
          <p className="mt-3 text-justify">
            This is to inform you that your ward <span className="font-semibold">{student.fullName}</span>, Roll No.{" "}
            <span className="font-semibold">{student.rollNo}</span>, student of{" "}
            <span className="font-semibold">
              {student.program} ({student.section})
            </span>
            , arrived late to college on <span className="font-semibold">{records.length}</span>{" "}
            {records.length === 1 ? "occasion" : "occasions"} during {formatMonth(`${month}-01`)}, as detailed below.
            College starts at {formatMinutes(settings.startMinutes)}.
          </p>

          <table className="mt-4 w-full border-collapse text-[13px]">
            <thead>
              <tr>
                {["#", "Date", "Arrival time", "Late by", "Reason given", "Action taken"].map((h) => (
                  <th key={h} className="border border-black bg-neutral-100 px-2 py-1.5 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {records.map((r, i) => (
                <tr key={r.id}>
                  <td className="border border-black px-2 py-1">{i + 1}</td>
                  <td className="border border-black px-2 py-1">{formatDate(fromDbDate(r.lateDate), { weekday: true })}</td>
                  <td className="border border-black px-2 py-1">{formatTime(r.arrivedAt, settings.timezone)}</td>
                  <td className="border border-black px-2 py-1">{r.minutesLate} min</td>
                  <td className="border border-black px-2 py-1">{REASON_LABELS[r.reason]}</td>
                  <td className="border border-black px-2 py-1">{ACTION_LABELS[r.actionTaken]}</td>
                </tr>
              ))}
              {records.length === 0 && (
                <tr>
                  <td colSpan={6} className="border border-black px-2 py-3 text-center">
                    No late arrivals recorded this month.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          <p className="mt-5 text-justify">
            Punctuality is a basic requirement of college discipline, and repeated late arrival disturbs your
            ward&apos;s studies as well as the class.{" "}
            {severe ? (
              <>
                As the number of late arrivals has crossed the permissible limit, you are requested to{" "}
                <span className="font-semibold">
                  meet the Discipline Committee in person on ____________ at ________
                </span>
                . Failure to do so may result in a fine, detention or further disciplinary action as per college rules.
              </>
            ) : (
              <>
                You are requested to ensure that your ward reaches college on time. Further late arrivals will lead to
                confiscation of the ID card, a fine, or a summons to the Discipline Committee as per college rules.
              </>
            )}
          </p>
          <p className="mt-3">Your cooperation in this matter is highly appreciated.</p>

          <div className="mt-16 flex justify-between gap-8 text-[13px]">
            <div className="text-center">
              <div className="mb-1 w-48 border-b border-black" />
              <p className="font-semibold">Discipline In-Charge</p>
            </div>
            <div className="text-center">
              <div className="mb-1 w-48 border-b border-black" />
              <p className="font-semibold">Principal</p>
            </div>
          </div>

          <div className="mt-12 border-t border-dashed border-black pt-4 text-[13px]">
            <p className="font-semibold">Parent acknowledgement (to be returned to the Discipline Office)</p>
            <p className="mt-2">
              I have received the letter regarding the late arrival of my ward {student.fullName} (Roll No.{" "}
              {student.rollNo}).
            </p>
            <div className="mt-8 flex justify-between">
              <p>Signature: ______________________</p>
              <p>Date: ______________</p>
            </div>
          </div>
        </article>
      </div>
    </>
  );
}
