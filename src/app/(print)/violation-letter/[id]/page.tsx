import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { EditableLetter } from "@/components/editable-letter";
import { PrintToolbar } from "@/components/print-toolbar";
import { Skeleton, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { SEVERITY_LABELS, VIOLATION_ACTION_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { addDays, formatDate, formatMinutes, fromDbDate, localParts, parseHHMM } from "@/lib/time";

export const metadata: Metadata = { title: "Violation letter" };

const LETTER_KINDS = {
  warning: "Warning letter",
  showcause: "Show-cause notice",
  undertaking: "Undertaking",
  suspension: "Suspension order",
} as const;
type Kind = keyof typeof LETTER_KINDS;

export default function ViolationLetterPage(props: PageProps<"/violation-letter/[id]">) {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-[1000px] w-full max-w-[210mm] rounded-none" />}>
      <Letter params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Letter({
  params,
  searchParams,
}: {
  params: PageProps<"/violation-letter/[id]">["params"];
  searchParams: PageProps<"/violation-letter/[id]">["searchParams"];
}) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const k = (await searchParams).kind;
  const kind: Kind = typeof k === "string" && k in LETTER_KINDS ? (k as Kind) : "warning";
  const settings = await getSettings();
  const v = await prisma.violation.findUnique({ where: { id }, include: { student: true, type: true } });
  if (!v) notFound();
  const [previous, others] = await Promise.all([
    prisma.violation.count({ where: { rollNo: v.rollNo, id: { not: v.id }, incidentDate: { lte: v.incidentDate } } }),
    v.incidentGroup
      ? prisma.violation.findMany({
          where: { incidentGroup: v.incidentGroup, id: { not: v.id } },
          orderBy: { id: "asc" },
          select: { rollNo: true, student: { select: { fullName: true, section: true } } },
        })
      : [],
  ]);
  const s = v.student;
  const today = localParts(new Date(), settings.timezone).date;
  const date = fromDbDate(v.incidentDate);
  const fine = Number(v.fineAmount);
  const when = `${formatDate(date, { weekday: true })}${v.incidentTime ? ` at ${formatMinutes(parseHHMM(v.incidentTime))}` : ""}`;
  const action =
    v.actionTaken === "SUSPENSION" ? `Suspension from college for ${v.suspensionDays} day(s)` : VIOLATION_ACTION_LABELS[v.actionTaken];
  const ref = `DISC/${kind.slice(0, 2).toUpperCase()}/${today.slice(0, 4)}/${String(v.id).padStart(4, "0")}`;
  const ward = (
    <>
      <span className="font-semibold">{s.fullName}</span>, S/O {s.fatherName}, Roll No. <span className="font-semibold">{s.rollNo}</span>,{" "}
      {s.program} ({s.section})
    </>
  );
  const facts = (
    <table className="mt-4 w-full border-collapse text-[13px]">
      <tbody>
        {[
          ["What he/she did", `${v.type.name} (${SEVERITY_LABELS[v.severity]})`],
          ["Date & time", when],
          ...(v.location ? [["Place", v.location]] : []),
          ["What happened", v.description],
          ...(others.length > 0
            ? [
                [
                  "Students involved",
                  [`${s.fullName} (${s.rollNo}, ${s.section})`, ...others.map((o) => `${o.student.fullName} (${o.rollNo}, ${o.student.section})`)].join("\n"),
                ],
              ]
            : []),
          ["Action taken", action],
          ...(fine > 0 ? [["Fine", `Rs. ${fine.toLocaleString()} ${v.finePaid ? "(paid)" : "(please pay at the Discipline Office)"}`]] : []),
        ].map(([key, val]) => (
          <tr key={key}>
            <th className="w-36 border border-black bg-neutral-100 px-3 py-1.5 text-left align-top font-semibold">{key}</th>
            <td className="border border-black px-3 py-1.5 whitespace-pre-line">{val}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  const sign = (left: string, right: string) => (
    <div className="mt-16 flex justify-between gap-8 text-[13px]">
      {[left, right].map((who) => (
        <div key={who} className="text-center">
          <div className="mb-1 w-48 border-b border-black" />
          <p className="font-semibold">{who}</p>
        </div>
      ))}
    </div>
  );
  const replyBy = formatDate(addDays(today, 3));
  const returnOn = v.suspensionDays ? formatDate(addDays(today, v.suspensionDays)) : "____________";

  return (
    <>
      <PrintToolbar title={LETTER_KINDS[kind]}>
        <nav className="flex flex-wrap gap-1" aria-label="Letter type">
          {(Object.keys(LETTER_KINDS) as Kind[]).map((key) => (
            <Link
              key={key}
              href={`/violation-letter/${v.id}?kind=${key}`}
              className={cx(
                "rounded-lg px-2.5 py-1.5 text-[13px] font-medium",
                key === kind ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2",
              )}
            >
              {LETTER_KINDS[key]}
            </Link>
          ))}
          <a href={`/notice/${v.id}`} className="rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-surface-2">
            Parent notice
          </a>
        </nav>
      </PrintToolbar>
      <div className="px-4 py-6 print:p-0">
        <style>{`@page { size: A4; margin: 0; }`}</style>
        <EditableLetter storageKey={`${kind}-${v.id}`} className="mx-auto max-w-[210mm] bg-white px-[16mm] py-[16mm] text-[14px] leading-relaxed text-black shadow-pop print:max-w-none print:px-[20mm] print:py-[18mm] print:shadow-none">
          <header className="border-b-2 border-black pb-4 text-center">
            <p className="text-2xl font-bold tracking-tight uppercase">{settings.collegeName}</p>
            {settings.collegeAddress && <p className="text-[13px]">{settings.collegeAddress}</p>}
            <p className="mt-1 text-[13px] font-semibold tracking-[0.15em] uppercase">Office of the Discipline In-Charge</p>
          </header>

          <div className="mt-6 flex justify-between text-[13px]">
            <p>
              Ref. No. <span className="font-mono">{ref}</span>
            </p>
            <p>Dated: {formatDate(today)}</p>
          </div>

          {kind === "warning" && (
            <>
              <div className="mt-6">
                <p>To,</p>
                <p className="font-semibold">{s.fullName}</p>
                <p>
                  Roll No. {s.rollNo}, {s.program} ({s.section})
                </p>
              </div>
              <p className="mt-6 font-semibold">
                Subject: <span className="underline">Warning letter</span>
              </p>
              <p className="mt-5 text-justify">
                It has been found that you, {ward}, broke the college rules as given below:
              </p>
              {facts}
              {previous > 0 && (
                <p className="mt-4 text-justify">
                  This is not the first time. You already have {previous} {previous === 1 ? "complaint" : "complaints"} on college record.
                </p>
              )}
              <p className="mt-4 text-justify">
                This is a <span className="font-semibold">{previous > 0 ? "final warning" : "warning"}</span>. Do not do this again. If it happens again, the college will
                take strict action, such as a fine, suspension, or sending your case to the Discipline Committee. A copy of this letter is
                kept in your file and sent to your parents.
              </p>
              {sign("Discipline In-Charge", "Principal")}
              <div className="mt-12 border-t border-dashed border-black pt-4 text-[13px]">
                <p className="font-semibold">Student receipt</p>
                <p className="mt-2">I have received this warning letter (case no. {v.id}) and I understand it.</p>
                <div className="mt-8 flex justify-between">
                  <p>Student signature: ______________________</p>
                  <p>Date: ______________</p>
                </div>
              </div>
            </>
          )}

          {kind === "showcause" && (
            <>
              <div className="mt-6">
                <p>To,</p>
                <p className="font-semibold">{s.fullName}</p>
                <p>
                  Roll No. {s.rollNo}, {s.program} ({s.section})
                </p>
              </div>
              <p className="mt-6 font-semibold">
                Subject: <span className="underline">Explain your conduct (show-cause notice)</span>
              </p>
              <p className="mt-5 text-justify">
                It has been reported that you, {ward}, did the following:
              </p>
              {facts}
              <p className="mt-4 text-justify">
                Please <span className="font-semibold">explain in writing</span> why action should not be taken against you. Bring your
                written reply to the Discipline Office by <span className="font-semibold">{replyBy}</span>. If you do not reply by then, the
                college will take action according to its rules.
              </p>
              {sign("Discipline In-Charge", "Principal")}
              <div className="mt-10 border-t border-dashed border-black pt-4 text-[13px]">
                <p className="font-semibold">Your reply</p>
                {Array.from({ length: 6 }, (_, i) => (
                  <div key={i} className="mt-6 border-b border-black" />
                ))}
                <div className="mt-8 flex justify-between">
                  <p>Student signature: ______________________</p>
                  <p>Date: ______________</p>
                </div>
              </div>
            </>
          )}

          {kind === "undertaking" && (
            <>
              <p className="mt-8 text-center text-lg font-bold tracking-wide uppercase underline">Undertaking</p>
              <p className="mt-6 text-justify">
                I, {ward}, accept that I broke the college rules as given below:
              </p>
              {facts}
              <p className="mt-4 text-justify">
                I am sorry for what I did. I promise that I will not do this, or anything else against the rules, again. I will follow all the
                rules of {settings.collegeName}. If I break this promise, the college can take strict action against me, including
                suspension or removal from college, and I will not object.
              </p>
              <div className="mt-14 grid grid-cols-2 gap-x-10 gap-y-12 text-[13px]">
                <div>
                  <div className="mb-1 border-b border-black" />
                  <p className="font-semibold">Student: {s.fullName}</p>
                  <p>Roll No. {s.rollNo}</p>
                </div>
                <div>
                  <div className="mb-1 border-b border-black" />
                  <p className="font-semibold">Father / Guardian: {s.fatherName}</p>
                  <p>Phone: {s.parentPhone}</p>
                </div>
                <div>
                  <div className="mb-1 border-b border-black" />
                  <p className="font-semibold">Discipline In-Charge</p>
                </div>
                <div>
                  <div className="mb-1 border-b border-black" />
                  <p className="font-semibold">Date</p>
                </div>
              </div>
            </>
          )}

          {kind === "suspension" && (
            <>
              <div className="mt-6">
                <p>To,</p>
                <p className="font-semibold">Mr. {s.fatherName}</p>
                <p>Father / Guardian of {s.fullName}</p>
                <p>Contact: {s.parentPhone}</p>
              </div>
              <p className="mt-6 font-semibold">
                Subject: <span className="underline">Suspension of your son/daughter</span>
              </p>
              <p className="mt-5 text-justify">
                We are sorry to inform you that your son/daughter, {ward}, has seriously broken the college rules as given below:
              </p>
              {facts}
              <p className="mt-4 text-justify">
                For this reason, the college has{" "}
                <span className="font-semibold">
                  suspended your child for {v.suspensionDays ?? "____"} day(s), starting from {formatDate(today)}
                </span>
                . Your child can come back to classes on <span className="font-semibold">{returnOn}</span>, but only after you come to the
                college yourself, meet the Discipline In-Charge and sign an undertaking.
              </p>
              <p className="mt-3 text-justify">
                During these days your child must not come to the college. Any classes or tests missed during this time will be the
                student&apos;s own responsibility.
              </p>
              {sign("Discipline In-Charge", "Principal")}
              <div className="mt-12 border-t border-dashed border-black pt-4 text-[13px]">
                <p className="font-semibold">Parent receipt</p>
                <p className="mt-2">I have received the suspension letter of my son/daughter {s.fullName} (case no. {v.id}).</p>
                <div className="mt-8 flex justify-between">
                  <p>Signature: ______________________</p>
                  <p>Date: ______________</p>
                </div>
              </div>
            </>
          )}
        </EditableLetter>
      </div>
    </>
  );
}
