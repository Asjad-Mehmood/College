"use server";

import { requireUser } from "@/lib/auth";
import { ACTION_LABELS, CASE_STATUS_LABELS, CONSENT_LABELS, REASON_LABELS, SEVERITY_LABELS, STUDENT_STATUS_LABELS, VIOLATION_ACTION_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatTime, fromDbDate } from "@/lib/time";

export type AuditEvent = {
  /** YYYY-MM-DD, used for ordering */
  date: string;
  kind: "late" | "violation" | "trip" | "sport" | "achievement";
  title: string;
  detail: string;
  /** Short status label such as "Open" or "Fine unpaid" */
  badge?: string;
  href?: string;
};

export type StudentAudit = {
  student: {
    rollNo: string;
    fullName: string;
    fatherName: string;
    program: string;
    section: string;
    parentPhone: string;
    studentPhone: string | null;
    photoUrl: string | null;
    status: string;
    addedOn: string;
  };
  totals: {
    lates: number;
    latesThisYear: number;
    violations: number;
    openCases: number;
    unpaidFines: number;
    trips: number;
    teams: number;
    achievements: number;
  };
  events: AuditEvent[];
};

const money = (n: number) => `Rs. ${n.toLocaleString()}`;

export async function getStudentAudit(rollNo: string): Promise<StudentAudit | null> {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const settings = await getSettings();
  const s = await prisma.student.findUnique({
    where: { rollNo },
    include: {
      lateRecords: { orderBy: { lateDate: "desc" }, include: { recordedBy: { select: { fullName: true } } } },
      violations: { orderBy: { incidentDate: "desc" }, include: { type: true, recordedBy: { select: { fullName: true } } } },
      trips: { include: { trip: true }, orderBy: { createdAt: "desc" } },
      teams: { include: { team: { include: { sport: true, event: true } } }, orderBy: { createdAt: "desc" } },
      achievements: { orderBy: { achievedOn: "desc" } },
    },
  });
  if (!s) return null;

  const events: AuditEvent[] = [];
  for (const r of s.lateRecords) {
    const fine = Number(r.fineAmount);
    events.push({
      date: fromDbDate(r.lateDate),
      kind: "late",
      title: `Late ${r.minutesLate} min · ${REASON_LABELS[r.reason]}`,
      detail: `Arrived ${formatTime(r.arrivedAt, settings.timezone)} · ${ACTION_LABELS[r.actionTaken]}${fine ? ` · fine ${money(fine)}` : ""}${r.remarks ? ` · “${r.remarks}”` : ""} · by ${r.recordedBy.fullName}`,
      badge: fine ? (r.finePaid ? "Fine paid" : "Fine unpaid") : undefined,
    });
  }
  for (const v of s.violations) {
    const fine = Number(v.fineAmount);
    events.push({
      date: fromDbDate(v.incidentDate),
      kind: "violation",
      title: `${v.type.name} · ${SEVERITY_LABELS[v.severity]}`,
      detail: `${v.description}${v.location ? ` · at ${v.location}` : ""} · ${VIOLATION_ACTION_LABELS[v.actionTaken]}${v.suspensionDays ? ` (${v.suspensionDays} days)` : ""}${fine ? ` · fine ${money(fine)} ${v.finePaid ? "paid" : "unpaid"}` : ""}${v.closingNote ? ` · closed: ${v.closingNote}` : ""} · by ${v.recordedBy.fullName}`,
      badge: CASE_STATUS_LABELS[v.status],
      href: `/violations/${v.id}`,
    });
  }
  for (const p of s.trips) {
    const fee = Number(p.trip.feeAmount);
    events.push({
      date: fromDbDate(p.trip.departDate),
      kind: "trip",
      title: `Trip: ${p.trip.title}`,
      detail: `${p.trip.destination} · ${p.status.toLowerCase()} · consent ${CONSENT_LABELS[p.consent].toLowerCase()}${fee ? ` · fee ${money(Number(p.feePaid))} of ${money(fee)}` : ""}${p.overrideNote ? ` · override: ${p.overrideNote}` : ""}`,
      href: `/trips/${p.tripId}`,
    });
  }
  for (const m of s.teams) {
    events.push({
      date: fromDbDate(m.team.event.startDate),
      kind: "sport",
      title: `${m.team.sport.name} · ${m.team.event.name}`,
      detail: `${m.role}${m.position ? `, ${m.position}` : ""}${m.jerseyNo ? ` · #${m.jerseyNo}` : ""} · ${m.status.toLowerCase()} · consent ${CONSENT_LABELS[m.consent].toLowerCase()}${m.overrideNote ? ` · override: ${m.overrideNote}` : ""}`,
      href: `/sports/teams/${m.teamId}`,
    });
  }
  for (const a of s.achievements) {
    events.push({
      date: fromDbDate(a.achievedOn),
      kind: "achievement",
      title: `${a.position} · ${a.event}`,
      detail: a.notes ?? "",
    });
  }
  events.sort((a, b) => (a.date < b.date ? 1 : -1));

  const year = fromDbDate(new Date()).slice(0, 4);
  const unpaid =
    s.lateRecords.filter((r) => Number(r.fineAmount) > 0 && !r.finePaid).reduce((a, r) => a + Number(r.fineAmount), 0) +
    s.violations.filter((v) => Number(v.fineAmount) > 0 && !v.finePaid).reduce((a, v) => a + Number(v.fineAmount), 0);

  return {
    student: {
      rollNo: s.rollNo,
      fullName: s.fullName,
      fatherName: s.fatherName,
      program: s.program,
      section: s.section,
      parentPhone: s.parentPhone,
      studentPhone: s.studentPhone,
      photoUrl: s.photoUrl,
      status: STUDENT_STATUS_LABELS[s.status],
      addedOn: fromDbDate(s.createdAt),
    },
    totals: {
      lates: s.lateRecords.length,
      latesThisYear: s.lateRecords.filter((r) => fromDbDate(r.lateDate).startsWith(year)).length,
      violations: s.violations.length,
      openCases: s.violations.filter((v) => v.status === "OPEN").length,
      unpaidFines: unpaid,
      trips: s.trips.length,
      teams: s.teams.length,
      achievements: s.achievements.length,
    },
    events,
  };
}
