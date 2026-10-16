import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EditableLetter } from "@/components/editable-letter";
import { PrintToolbar } from "@/components/print-toolbar";
import { Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { SEVERITY_LABELS, VIOLATION_ACTION_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatDate, formatMinutes, fromDbDate, localParts, parseHHMM } from "@/lib/time";

export const metadata: Metadata = { title: "Violation notice" };

export default function NoticePage(props: PageProps<"/notice/[id]">) {
  return (
    <>
      <PrintToolbar title="Discipline violation notice" />
      <Suspense fallback={<Skeleton className="mx-auto mt-8 h-[1000px] w-full max-w-[210mm] rounded-none" />}>
        <Notice params={props.params} />
      </Suspense>
    </>
  );
}

async function Notice({ params }: { params: PageProps<"/notice/[id]">["params"] }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const settings = await getSettings();
  const v = await prisma.violation.findUnique({ where: { id }, include: { student: true, type: true } });
  if (!v) notFound();
  const previous = await prisma.violation.count({ where: { rollNo: v.rollNo, id: { not: v.id }, incidentDate: { lte: v.incidentDate } } });
  const s = v.student;
  const today = localParts(new Date(), settings.timezone).date;
  const date = fromDbDate(v.incidentDate);
  const fine = Number(v.fineAmount);
  const summons = v.severity === "SEVERE" || v.actionTaken === "PARENT_MEETING" || v.actionTaken === "REFERRED_TO_COMMITTEE";
  const action =
    v.actionTaken === "SUSPENSION" ? `Suspension from college for ${v.suspensionDays} day(s)` : VIOLATION_ACTION_LABELS[v.actionTaken];

  return (
    <div className="px-4 py-8 print:p-0">
      <style>{`@page { size: A4; margin: 0; }`}</style>
      <EditableLetter storageKey={`notice-${v.id}`} className="mx-auto max-w-[210mm] bg-white px-[16mm] py-[16mm] text-[14px] leading-relaxed text-black shadow-pop print:max-w-none print:px-[20mm] print:py-[18mm] print:shadow-none">
        <header className="border-b-2 border-black pb-4 text-center">
          <p className="text-2xl font-bold tracking-tight uppercase">{settings.collegeName}</p>
          {settings.collegeAddress && <p className="text-[13px]">{settings.collegeAddress}</p>}
          <p className="mt-1 text-[13px] font-semibold tracking-[0.15em] uppercase">Office of the Discipline In-Charge</p>
        </header>

        <div className="mt-6 flex justify-between text-[13px]">
          <p>
            Ref. No. <span className="font-mono">DISC/V/{today.slice(0, 4)}/{String(v.id).padStart(4, "0")}</span>
          </p>
          <p>Dated: {formatDate(today)}</p>
        </div>

        <div className="mt-6">
          <p>To,</p>
          <p className="font-semibold">Mr. {s.fatherName}</p>
          <p>Father / Guardian of {s.fullName}</p>
          <p>Contact: {s.parentPhone}</p>
        </div>

        <p className="mt-6">
          <span className="font-semibold">Subject: </span>
          <span className="font-semibold underline">Complaint about your son/daughter</span>
        </p>

        <p className="mt-5">Respected Sir / Madam,</p>
        <p className="mt-3 text-justify">
          We want to inform you that your son/daughter <span className="font-semibold">{s.fullName}</span>, Roll No.{" "}
          <span className="font-semibold">{s.rollNo}</span>, class{" "}
          <span className="font-semibold">
            {s.program} ({s.section})
          </span>
          , has broken a college rule. The details are below:
        </p>

        <table className="mt-4 w-full border-collapse text-[13px]">
          <tbody>
            {[
              ["What he/she did", `${v.type.name} (${SEVERITY_LABELS[v.severity]})`],
              ["Date & time", `${formatDate(date, { weekday: true })}${v.incidentTime ? `, ${formatMinutes(parseHHMM(v.incidentTime))}` : ""}`],
              ...(v.location ? [["Place", v.location]] : []),
              ["What happened", v.description],
              ["Action taken", action],
              ...(fine > 0 ? [["Fine", `Rs. ${fine.toLocaleString()} ${v.finePaid ? "(paid)" : "(please pay at the Discipline Office)"}`]] : []),
            ].map(([k, val]) => (
              <tr key={k}>
                <th className="w-36 border border-black bg-neutral-100 px-3 py-1.5 text-left align-top font-semibold">{k}</th>
                <td className="border border-black px-3 py-1.5 whitespace-pre-line">{val}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {previous > 0 && (
          <p className="mt-4 text-justify">
            This is not the first time. Your child already has {previous} {previous === 1 ? "complaint" : "complaints"} on college record.
          </p>
        )}

        <p className="mt-4 text-justify">
          {summons ? (
            <>
              Please <span className="font-semibold">come to the Discipline Office yourself on ____________ at ________</span>{" "}
              to talk about this matter. If you do not come, the college may take stricter action.
            </>
          ) : (
            <>
              Please talk to your child and make sure this does not happen again. If it happens again, the college will take
              strict action.
            </>
          )}
        </p>
        <p className="mt-3">Thank you for your cooperation.</p>

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
          <p className="font-semibold">Parent receipt (cut and send back to the Discipline Office)</p>
          <p className="mt-2">
            I have received this letter about my son/daughter {s.fullName} (Roll No. {s.rollNo}), case no. {v.id}. I will make sure
            it does not happen again.
          </p>
          <div className="mt-8 flex justify-between">
            <p>Signature: ______________________</p>
            <p>Date: ______________</p>
          </div>
        </div>
      </EditableLetter>
    </div>
  );
}
