import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, MessageCircle, Phone, Printer } from "lucide-react";
import { Avatar, Card, CardHeader, Pill, Skeleton, StrikeBadge, buttonClass } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { CASE_STATUS_LABELS, SEVERITY_LABELS, SEVERITY_LEVEL, VIOLATION_ACTION_LABELS } from "@/lib/labels";
import { telLink, whatsAppLink } from "@/lib/messages";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatDate, formatMinutes, fromDbDate, localParts, parseHHMM } from "@/lib/time";
import { CaseActions } from "./case-actions";

export const metadata: Metadata = { title: "Violation case" };

export default function ViolationPage(props: PageProps<"/violations/[id]">) {
  return (
    <div>
      <Link href="/violations" className="no-print mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Violations
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Case params={props.params} />
      </Suspense>
    </div>
  );
}

async function Case({ params }: { params: PageProps<"/violations/[id]">["params"] }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const settings = await getSettings();
  const v = await prisma.violation.findUnique({
    where: { id },
    include: { student: true, type: true, recordedBy: { select: { fullName: true } } },
  });
  if (!v) notFound();
  const [others, total] = await Promise.all([
    prisma.violation.findMany({
      where: { rollNo: v.rollNo, id: { not: v.id } },
      orderBy: { incidentDate: "desc" },
      take: 5,
      include: { type: { select: { name: true } } },
    }),
    prisma.violation.count({ where: { rollNo: v.rollNo } }),
  ]);
  const s = v.student;
  const fine = Number(v.fineAmount);
  const action =
    v.actionTaken === "SUSPENSION" ? `Suspension for ${v.suspensionDays} day(s)` : VIOLATION_ACTION_LABELS[v.actionTaken];

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="flex flex-col gap-5">
        <Card className="p-5 sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[13px] text-muted">Case #{v.id}</p>
              <h1 className="mt-0.5 text-2xl font-semibold tracking-tight">{v.type.name}</h1>
            </div>
            <div className="flex flex-wrap gap-2">
              <StrikeBadge level={SEVERITY_LEVEL[v.severity]} label={SEVERITY_LABELS[v.severity]} size="lg" />
              <Pill tone={v.status === "OPEN" ? "accent" : "neutral"}>{CASE_STATUS_LABELS[v.status]}</Pill>
            </div>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
            <Info label="Date" value={formatDate(fromDbDate(v.incidentDate), { weekday: true })} />
            <Info label="Time" value={v.incidentTime ? formatMinutes(parseHHMM(v.incidentTime)) : "—"} />
            <Info label="Place" value={v.location ?? "—"} />
            <Info label="Reported by" value={v.reportedBy ?? "—"} />
          </dl>
          <div className="mt-5 rounded-xl bg-surface-2/60 p-4">
            <p className="text-[12px] font-medium tracking-wide text-muted uppercase">What happened</p>
            <p className="mt-1.5 text-sm leading-relaxed whitespace-pre-line">{v.description}</p>
          </div>
          <dl className="mt-5 grid grid-cols-2 gap-x-6 gap-y-4 text-sm sm:grid-cols-4">
            <Info label="Action taken" value={action} />
            <Info label="Fine" value={fine > 0 ? `Rs. ${fine.toLocaleString()} · ${v.finePaid ? "Paid" : "Unpaid"}` : "None"} />
            <Info label="Parent informed" value={v.parentNotified ? "Yes" : "No"} />
            <Info label="Recorded by" value={`${v.recordedBy.fullName}, ${formatDate(localParts(v.createdAt, settings.timezone).date)}`} />
          </dl>
          {v.status === "CLOSED" && (
            <p className="mt-5 rounded-xl border border-line px-4 py-3 text-[13px] text-ink-2">
              <span className="font-medium text-ink">Closed</span>
              {v.closedAt && ` on ${formatDate(localParts(v.closedAt, settings.timezone).date)}`}
              {v.closingNote && ` — ${v.closingNote}`}
            </p>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Student"
            actions={
              <Link href={`/students/${encodeURIComponent(s.rollNo)}`} className="text-[13px] font-medium text-accent-ink hover:underline">
                Full profile
              </Link>
            }
          />
          <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
            <Avatar name={s.fullName} photoUrl={s.photoUrl} size="md" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{s.fullName}</p>
              <p className="text-[13px] text-muted">
                S/O {s.fatherName} · <span className="font-mono">{s.rollNo}</span> · {s.program} {s.section}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={telLink(s.parentPhone)} className={buttonClass("secondary", "sm")}>
                <Phone className="size-3.5" aria-hidden /> Call father
              </a>
              <a href={whatsAppLink(s.parentPhone)} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
                <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
              </a>
            </div>
          </div>
          <div className="border-t border-line px-5 py-4">
            <p className="text-[13px] font-medium text-ink-2">
              {total === 1 ? "This is the student's only violation." : `${total} violations in total. Other cases:`}
            </p>
            {others.length > 0 && (
              <ul className="mt-2 flex flex-col gap-1.5 text-[13px]">
                {others.map((o) => (
                  <li key={o.id} className="flex flex-wrap items-center gap-2">
                    <span className="w-28 text-muted tabular">{formatDate(fromDbDate(o.incidentDate))}</span>
                    <Link href={`/violations/${o.id}`} className="hover:underline">
                      {o.type.name}
                    </Link>
                    <StrikeBadge level={SEVERITY_LEVEL[o.severity]} label={SEVERITY_LABELS[o.severity]} />
                    {o.status === "OPEN" && <Pill tone="accent">Open</Pill>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <div className="no-print flex flex-col gap-5 lg:sticky lg:top-6">
        <Card className="p-5">
          <a href={`/notice/${v.id}`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "md", "w-full")}>
            <Printer className="size-4" aria-hidden /> Print parent notice
          </a>
        </Card>
        {can.manageRecords(user.role) && (
          <Card className="p-5">
            <p className="mb-3 text-sm font-semibold">Manage case</p>
            <CaseActions id={v.id} status={v.status} fineAmount={fine} finePaid={v.finePaid} />
          </Card>
        )}
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}
