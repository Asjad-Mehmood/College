import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, FilePlus2, FileWarning, History, MessageCircle, Phone, ShieldCheck, Ticket } from "lucide-react";
import { RecordManager } from "@/components/record-manager";
import { StudentDialog } from "@/components/student-dialog";
import {
  Avatar,
  Card,
  CardHeader,
  EmptyState,
  Pill,
  Skeleton,
  StrikeBadge,
  Table,
  Td,
  Th,
  buttonClass,
} from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import {
  ACTION_LABELS,
  REASON_LABELS,
  SEVERITY_LABELS,
  SEVERITY_LEVEL,
  STUDENT_STATUS_LABELS,
  VIOLATION_ACTION_LABELS,
} from "@/lib/labels";
import { telLink, whatsAppLink } from "@/lib/messages";
import { prisma } from "@/lib/prisma";
import { getClassOptions } from "@/lib/records";
import { getSectionOptions } from "@/lib/section-options";
import { SHIFT_LABELS, getSettings } from "@/lib/settings";
import { STRIKE_LABELS, ordinal, strikeLevel } from "@/lib/strikes";
import { formatDate, formatMonth, formatTime, fromDbDate, localParts } from "@/lib/time";

export const metadata: Metadata = { title: "Student profile" };

export default function StudentProfilePage(props: PageProps<"/students/[rollNo]">) {
  return (
    <div>
      <Link href="/students" className="no-print mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Students
      </Link>
      <Suspense
        fallback={
          <div className="flex flex-col gap-5">
            <Skeleton className="h-48 rounded-2xl" />
            <Skeleton className="h-24 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        }
      >
        <Profile params={props.params} />
      </Suspense>
    </div>
  );
}

async function Profile({ params }: { params: PageProps<"/students/[rollNo]">["params"] }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const rollNo = decodeURIComponent((await params).rollNo);
  const settings = await getSettings();
  const student = await prisma.student.findUnique({
    where: { rollNo },
    include: {
      teams: { include: { team: { include: { sport: true, event: true } } } },
      achievements: { orderBy: { achievedOn: "desc" } },
      trips: {
        orderBy: { trip: { departDate: "desc" } },
        include: { trip: { select: { id: true, title: true, destination: true, departDate: true, status: true, feeAmount: true } } },
      },
      violations: {
        orderBy: [{ incidentDate: "desc" }, { createdAt: "desc" }],
        include: { type: { select: { name: true } } },
      },
      lateRecords: {
        orderBy: [{ lateDate: "asc" }, { arrivedAt: "asc" }],
        include: { recordedBy: { select: { fullName: true } } },
      },
    },
  });
  if (!student) notFound();
  const sectionShift = (await prisma.section.findUnique({ where: { name: student.section }, select: { shift: true } }))?.shift;

  const today = localParts(new Date(), settings.timezone).date;
  const thisMonth = today.slice(0, 7);

  // Strike number = position within its calendar month.
  const perMonth = new Map<string, number>();
  const history = student.lateRecords.map((r) => {
    const date = fromDbDate(r.lateDate);
    const month = date.slice(0, 7);
    const strike = (perMonth.get(month) ?? 0) + 1;
    perMonth.set(month, strike);
    return { ...r, date, month, strike, fine: Number(r.fineAmount) };
  });
  const monthCount = perMonth.get(thisMonth) ?? 0;
  const level = strikeLevel(monthCount, settings);
  const violations = student.violations.map((v) => ({ ...v, fine: Number(v.fineAmount) }));
  const openCases = violations.filter((v) => v.status === "OPEN").length;
  // Unpaid fines from both late arrivals and violations.
  const unpaid = [...history, ...violations].filter((r) => r.fine > 0 && !r.finePaid).reduce((sum, r) => sum + r.fine, 0);
  const manage = can.manageRecords(user.role);

  // Newest month first, newest record first within each month.
  const months = [...perMonth.keys()].sort().reverse();
  const programs = manage ? (await getClassOptions()).programs : [];
  const sectionOptions = manage ? await getSectionOptions() : [];

  return (
    <div className="flex flex-col gap-5">
      <Card className="p-5 sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <Avatar name={student.fullName} photoUrl={student.photoUrl} size="lg" />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{student.fullName}</h1>
              {student.status !== "ACTIVE" && <Pill tone="warning">{STUDENT_STATUS_LABELS[student.status]}</Pill>}
            </div>
            <p className="text-ink-2">S/O {student.fatherName}</p>
            <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-[12px] text-muted">Roll no.</dt>
                <dd className="font-mono font-medium">{student.rollNo}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Program</dt>
                <dd className="font-medium">{student.program}</dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Section</dt>
                <dd className="font-medium">
                  {student.section}
                  {sectionShift && <span className="font-normal text-muted"> · {SHIFT_LABELS[sectionShift]} shift</span>}
                </dd>
              </div>
              <div>
                <dt className="text-[12px] text-muted">Parent phone</dt>
                <dd className="font-mono font-medium">{student.parentPhone}</dd>
              </div>
            </dl>
            <div className="no-print mt-5 flex flex-wrap gap-2">
              <a href={telLink(student.parentPhone)} className={buttonClass("secondary", "sm")}>
                <Phone className="size-3.5" aria-hidden /> Call father
              </a>
              <a href={whatsAppLink(student.parentPhone)} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
                <MessageCircle className="size-3.5" aria-hidden /> WhatsApp father
              </a>
              {student.studentPhone && (
                <a href={telLink(student.studentPhone)} className={buttonClass("ghost", "sm")}>
                  <Phone className="size-3.5" aria-hidden /> Call student
                </a>
              )}
            </div>
          </div>
          <div className="no-print flex flex-wrap gap-2 sm:justify-end">
            {manage && (
              <Link href={`/violations/new?roll=${encodeURIComponent(student.rollNo)}`} className={buttonClass("secondary")}>
                <FilePlus2 className="size-4" aria-hidden /> Record violation
              </Link>
            )}
            <a href={`/letter/${encodeURIComponent(student.rollNo)}`} target="_blank" rel="noreferrer" className={buttonClass("primary")}>
              <FileWarning className="size-4" aria-hidden /> Warning letter
            </a>
            {manage && (
              <StudentDialog
                programs={programs}
                sections={sectionOptions}
                student={{
                  rollNo: student.rollNo,
                  fullName: student.fullName,
                  fatherName: student.fatherName,
                  program: student.program,
                  section: student.section,
                  parentPhone: student.parentPhone,
                  studentPhone: student.studentPhone,
                  photoUrl: student.photoUrl,
                  status: student.status,
                }}
              />
            )}
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Late this month">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-3xl font-semibold">{monthCount}</span>
            {monthCount > 0 && <StrikeBadge level={level} label={STRIKE_LABELS[level]} />}
          </div>
        </Stat>
        <Stat label="Late all time">
          <span className="text-3xl font-semibold">{history.length}</span>
        </Stat>
        <Stat label="Violations">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-3xl font-semibold">{violations.length}</span>
            {openCases > 0 && <Pill tone="accent">{openCases} open</Pill>}
          </div>
        </Stat>
        <Stat label="Unpaid fines">
          <span className="text-3xl font-semibold">Rs. {unpaid.toLocaleString()}</span>
        </Stat>
      </div>

      <Card className="overflow-hidden">
        <CardHeader title="Late-arrival history" description="Every late arrival, excuse, action taken and fine." />
        {history.length === 0 ? (
          <EmptyState icon={<History className="size-5" />} title="No late arrivals on record">
            This student has never been logged late.
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date &amp; arrival</Th>
                <Th>Strike</Th>
                <Th>Reason / action</Th>
                <Th>Fine</Th>
                <Th>Remarks</Th>
                <Th className="no-print">
                  <span className="sr-only">Actions</span>
                </Th>
              </tr>
            </thead>
            {months.map((month) => {
              const rows = history.filter((r) => r.month === month).reverse();
              return (
                <tbody key={month}>
                  <tr>
                    <td colSpan={7} className="border-b border-line bg-surface-2/40 px-4 py-2 text-[12px] font-semibold text-ink-2">
                      {formatMonth(`${month}-01`)} · {rows.length} late
                    </td>
                  </tr>
                  {rows.map((r) => (
                    <tr key={r.id} className="hover:bg-surface-2/50">
                      <Td className="whitespace-nowrap">
                        <span className="block">{formatDate(r.date, { weekday: true })}</span>
                        <span className="block text-[12px] text-muted tabular">
                          {formatTime(r.arrivedAt, settings.timezone)} · {r.minutesLate} min late
                        </span>
                      </Td>
                      <Td>
                        <StrikeBadge level={strikeLevel(r.strike, settings)} label={ordinal(r.strike)} />
                      </Td>
                      <Td>
                        <span className="block">{REASON_LABELS[r.reason]}</span>
                        <span className="block text-[12px] text-muted">{ACTION_LABELS[r.actionTaken]}</span>
                      </Td>
                      <Td>
                        {r.fine > 0 ? (
                          <Pill tone={r.finePaid ? "good" : "critical"}>
                            Rs. {r.fine} · {r.finePaid ? "Paid" : "Unpaid"}
                          </Pill>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </Td>
                      <Td className="max-w-56 text-[13px] whitespace-normal">
                        {r.remarks && <p className="text-ink-2">{r.remarks}</p>}
                        <p className="text-[12px] text-muted">Logged by {r.recordedBy.fullName}</p>
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
                                fullName: student.fullName,
                                dateLabel: formatDate(r.date),
                                reason: r.reason,
                                actionTaken: r.actionTaken,
                                fineAmount: r.fine,
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
              );
            })}
          </Table>
        )}
      </Card>

      <Card className="overflow-hidden">
        <CardHeader title="Discipline violations" description="Recorded violations, actions and case status." />
        {violations.length === 0 ? (
          <EmptyState icon={<ShieldCheck className="size-5" />} title="No violations on record" />
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Violation</Th>
                <Th>Severity</Th>
                <Th>Action</Th>
                <Th>Fine</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {violations.map((v) => (
                <tr key={v.id} className="hover:bg-surface-2/50">
                  <Td className="whitespace-nowrap">
                    <span className="block">{formatDate(fromDbDate(v.incidentDate), { weekday: true })}</span>
                    <span className="block text-[12px] text-muted">Case #{v.id}</span>
                  </Td>
                  <Td className="max-w-72">
                    <Link href={`/violations/${v.id}`} className="block font-medium hover:underline">
                      {v.type.name}
                    </Link>
                    <span className="block truncate text-[12px] text-muted" title={v.description}>
                      {v.description}
                    </span>
                  </Td>
                  <Td>
                    <StrikeBadge level={SEVERITY_LEVEL[v.severity]} label={SEVERITY_LABELS[v.severity]} />
                  </Td>
                  <Td className="text-[13px]">
                    {v.actionTaken === "SUSPENSION" ? `Suspension · ${v.suspensionDays} days` : VIOLATION_ACTION_LABELS[v.actionTaken]}
                  </Td>
                  <Td>
                    {v.fine > 0 ? (
                      <Pill tone={v.finePaid ? "good" : "critical"}>
                        Rs. {v.fine} · {v.finePaid ? "Paid" : "Unpaid"}
                      </Pill>
                    ) : (
                      <span className="text-muted">—</span>
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
      </Card>

      <TripsCard trips={student.trips} />

      {(student.teams.length > 0 || student.achievements.length > 0) && (
        <Card className="overflow-hidden">
          <CardHeader title="Sports" description="Teams and achievements." />
          <ul className="divide-y divide-line">
            {student.teams.map((m) => (
              <li key={`t${m.id}`}>
                <Link href={`/sports/teams/${m.team.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-2/50">
                  <span className="min-w-0 flex-1 text-sm font-medium">
                    {m.team.sport.name}
                    <span className="ml-2 text-[12px] font-normal text-muted">{m.team.event.name}</span>
                  </span>
                  {m.role !== "Player" && <Pill tone="accent">{m.role}</Pill>}
                  <Pill tone={m.status === "SELECTED" ? "good" : "neutral"}>{m.status === "SELECTED" ? "In squad" : m.status === "WAITLIST" ? "Waitlist" : "Dropped"}</Pill>
                </Link>
              </li>
            ))}
            {student.achievements.map((a) => (
              <li key={`a${a.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                <span className="min-w-0 flex-1">
                  <span className="font-medium">{a.position}</span> · {a.event}
                </span>
                <span className="text-[12px] text-muted">{formatDate(fromDbDate(a.achievedOn))}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}

function TripsCard({
  trips,
}: {
  trips: {
    id: number;
    status: string;
    consent: string;
    feePaid: unknown;
    departedAt: Date | null;
    trip: { id: number; title: string; destination: string; departDate: Date; status: string; feeAmount: unknown };
  }[];
}) {
  if (trips.length === 0) return null;
  return (
    <Card className="overflow-hidden">
      <CardHeader title="Trips" description="Trips this student registered for." />
      <ul className="divide-y divide-line">
        {trips.map((p) => {
          const fee = Number(p.trip.feeAmount);
          return (
            <li key={p.id}>
              <Link href={`/trips/${p.trip.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-2/50">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{p.trip.title}</span>
                  <span className="block truncate text-[12px] text-muted">
                    {formatDate(fromDbDate(p.trip.departDate))} · {p.trip.destination}
                  </span>
                </span>
                {p.status === "WITHDRAWN" ? (
                  <Pill>Withdrawn</Pill>
                ) : (
                  <>
                    <Pill tone={p.consent === "RECEIVED" ? "good" : p.consent === "REFUSED" ? "critical" : "warning"}>
                      Consent {p.consent.toLowerCase()}
                    </Pill>
                    {fee > 0 && <Pill tone={Number(p.feePaid) >= fee ? "good" : "critical"}>{Number(p.feePaid) >= fee ? "Fee paid" : "Fee due"}</Pill>}
                    {p.trip.status === "RETURNED" && <Pill>{p.departedAt ? "Went" : "Did not go"}</Pill>}
                  </>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Card className="p-4">
      <p className="text-[13px] text-muted">{label}</p>
      <div className="mt-1">{children}</div>
    </Card>
  );
}
