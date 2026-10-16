import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
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
      ? prisma.violation.count({ where: { incidentGroup: v.incidentGroup, id: { not: v.id } } })
      : 0,
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
          ["Violation", `${v.type.name} (${SEVERITY_LABELS[v.severity]})`],
          ["Date & time", when],
          ...(v.location ? [["Place", v.location]] : []),
          ["Details", v.description],
          ...(others > 0 ? [["Others involved", `${others} other student${others === 1 ? "" : "s"} in the same incident`]] : []),
          ["Action taken", action],
          ...(fine > 0 ? [["Fine", `Rs. ${fine.toLocaleString()} ${v.finePaid ? "(paid)" : "(to be paid at the Discipline Office)"}`]] : []),
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
      <p className="no-print mx-auto mt-4 max-w-[210mm] px-4 text-center text-[13px] text-muted">
        Tip: click anywhere on the letter to edit the wording before printing.
      </p>
      <div className="px-4 py-6 print:p-0">
        <style>{`@page { size: A4; margin: 0; }`}</style>
        <article
          contentEditable
          suppressContentEditableWarning
          className="mx-auto max-w-[210mm] bg-white px-[16mm] py-[16mm] text-[14px] leading-relaxed text-black shadow-pop outline-none print:max-w-none print:px-[20mm] print:py-[18mm] print:shadow-none"
        >
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
                Subject: <span className="underline">Warning for violation of college discipline</span>
              </p>
              <p className="mt-5 text-justify">
                It has been reported and verified that you, {ward}, were involved in the following violation of the college code of conduct:
              </p>
              {facts}
              {previous > 0 && (
                <p className="mt-4 text-justify">
                  This is not your first case: {previous} earlier {previous === 1 ? "violation is" : "violations are"} already on your record.
                </p>
              )}
              <p className="mt-4 text-justify">
                You are hereby <span className="font-semibold">strictly warned</span> to refrain from such conduct in future. Any repetition
                will lead to stricter disciplinary action, which may include fines, suspension or the matter being referred to the
                Discipline Committee, as per college rules. A copy of this letter is being placed on your record and sent to your parent/guardian.
              </p>
              {sign("Discipline In-Charge", "Principal")}
              <div className="mt-12 border-t border-dashed border-black pt-4 text-[13px]">
                <p className="font-semibold">Receipt by student</p>
                <p className="mt-2">I have received this warning letter (case no. {v.id}) and understood its contents.</p>
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
                Subject: <span className="underline">Show-cause notice</span>
              </p>
              <p className="mt-5 text-justify">
                Whereas it has been reported that you, {ward}, committed the following act of indiscipline:
              </p>
              {facts}
              <p className="mt-4 text-justify">
                You are hereby directed to <span className="font-semibold">show cause in writing</span> why disciplinary action should not be
                taken against you. Your written reply must reach the Discipline Office by <span className="font-semibold">{replyBy}</span>. If
                no satisfactory reply is received by that date, it will be presumed that you have nothing to say in your defence and action
                will be taken as per college rules.
              </p>
              {sign("Discipline In-Charge", "Principal")}
              <div className="mt-10 border-t border-dashed border-black pt-4 text-[13px]">
                <p className="font-semibold">Student&apos;s reply</p>
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
                I, {ward}, admit that I was involved in the following violation of college discipline:
              </p>
              {facts}
              <p className="mt-4 text-justify">
                I sincerely regret my conduct and apologise for it. I hereby undertake that I will not repeat this or any other act of
                indiscipline in future, and that I will abide by all the rules and regulations of {settings.collegeName}. I understand that
                if I violate this undertaking, the college may take strict action against me, including suspension or expulsion, and I will
                have no right to object.
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
                Subject: <span className="underline">Suspension of your ward from college</span>
              </p>
              <p className="mt-5 text-justify">
                This is to inform you that your ward, {ward}, has been found guilty of the following serious violation of college discipline:
              </p>
              {facts}
              <p className="mt-4 text-justify">
                In view of the above, the competent authority has decided to{" "}
                <span className="font-semibold">
                  suspend your ward from college for {v.suspensionDays ?? "____"} day(s), with effect from {formatDate(today)}
                </span>
                . Your ward may rejoin classes on <span className="font-semibold">{returnOn}</span>, only after you have personally met the
                Discipline In-Charge and submitted a written undertaking.
              </p>
              <p className="mt-3 text-justify">
                During the suspension period your ward is not allowed to enter the college premises. Absence from classes and tests during
                this period will be the responsibility of the student.
              </p>
              {sign("Discipline In-Charge", "Principal")}
              <div className="mt-12 border-t border-dashed border-black pt-4 text-[13px]">
                <p className="font-semibold">Parent acknowledgement</p>
                <p className="mt-2">I have received the suspension order of my ward {s.fullName} (case no. {v.id}).</p>
                <div className="mt-8 flex justify-between">
                  <p>Signature: ______________________</p>
                  <p>Date: ______________</p>
                </div>
              </div>
            </>
          )}
        </article>
      </div>
    </>
  );
}
