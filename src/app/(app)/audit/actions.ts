"use server";

import { requireUser } from "@/lib/auth";
import {
  ACTION_LABELS,
  CASE_STATUS_LABELS,
  CONSENT_LABELS,
  REASON_LABELS,
  SEVERITY_LABELS,
  STUDENT_STATUS_LABELS,
  TRIP_STATUS_LABELS,
  VIOLATION_ACTION_LABELS,
} from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { strikeLevel, type StrikeLevel } from "@/lib/strikes";
import { formatTime, fromDbDate, localParts } from "@/lib/time";

export type StudentAudit = {
  student: {
    rollNo: string;
    fullName: string;
    fatherName: string;
    program: string;
    section: string;
    sectionYear: string | null;
    shift: string;
    parentPhone: string;
    studentPhone: string | null;
    photoUrl: string | null;
    status: string;
    active: boolean;
    addedOn: string;
    updatedOn: string;
  };
  totals: {
    lates: number;
    latesThisMonth: number;
    monthLevel: StrikeLevel;
    avgMinutesLate: number;
    violations: number;
    openCases: number;
    severeCases: number;
    finesTotal: number;
    finesUnpaid: number;
    trips: number;
    teams: number;
    achievements: number;
  };
  /** Late arrivals per month for the last 12 months, oldest first. */
  lateTrend: { month: string; count: number }[];
  lates: {
    id: number;
    date: string;
    time: string;
    minutesLate: number;
    reason: string;
    action: string;
    fine: number;
    finePaid: boolean;
    parentNotified: boolean;
    remarks: string | null;
    recordedBy: string;
  }[];
  violations: {
    id: number;
    date: string;
    time: string | null;
    type: string;
    severity: string;
    severityKey: string;
    location: string | null;
    description: string;
    reportedBy: string | null;
    action: string;
    suspensionDays: number | null;
    fine: number;
    finePaid: boolean;
    status: string;
    open: boolean;
    closingNote: string | null;
    recordedBy: string;
  }[];
  trips: {
    id: number;
    title: string;
    destination: string;
    departDate: string;
    returnDate: string;
    tripStatus: string;
    registered: boolean;
    consent: string;
    fee: number;
    feePaid: number;
    receiptNo: string | null;
    departed: boolean;
    returned: boolean;
    overrideNote: string | null;
  }[];
  teams: {
    id: number;
    sport: string;
    event: string;
    date: string;
    role: string;
    position: string | null;
    jerseyNo: number | null;
    status: string;
    consent: string;
  }[];
  achievements: { id: number; date: string; event: string; position: string; notes: string | null }[];
  fines: { key: string; date: string; source: "Late arrival" | "Violation"; detail: string; amount: number; paid: boolean; href?: string }[];
};

const cap = (s: string) => s.charAt(0) + s.slice(1).toLowerCase();

export async function getStudentAudit(rollNo: string): Promise<StudentAudit | null> {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const settings = await getSettings();
  const s = await prisma.student.findUnique({
    where: { rollNo },
    include: {
      lateRecords: { orderBy: [{ lateDate: "desc" }], include: { recordedBy: { select: { fullName: true } } } },
      violations: { orderBy: { incidentDate: "desc" }, include: { type: true, recordedBy: { select: { fullName: true } } } },
      trips: { include: { trip: true } },
      teams: { include: { team: { include: { sport: true, event: true } } } },
      achievements: { orderBy: { achievedOn: "desc" } },
    },
  });
  if (!s) return null;
  const sectionRow = await prisma.section.findUnique({ where: { name: s.section }, select: { year: true, shift: true } });

  const today = localParts(new Date(), settings.timezone).date;
  const thisMonth = today.slice(0, 7);

  const lates = s.lateRecords.map((r) => ({
    id: r.id,
    date: fromDbDate(r.lateDate),
    time: formatTime(r.arrivedAt, settings.timezone),
    minutesLate: r.minutesLate,
    reason: REASON_LABELS[r.reason],
    action: ACTION_LABELS[r.actionTaken],
    fine: Number(r.fineAmount),
    finePaid: r.finePaid,
    parentNotified: r.parentNotified,
    remarks: r.remarks,
    recordedBy: r.recordedBy.fullName,
  }));
  const violations = s.violations.map((v) => ({
    id: v.id,
    date: fromDbDate(v.incidentDate),
    time: v.incidentTime,
    type: v.type.name,
    severity: SEVERITY_LABELS[v.severity],
    severityKey: v.severity,
    location: v.location,
    description: v.description,
    reportedBy: v.reportedBy,
    action: VIOLATION_ACTION_LABELS[v.actionTaken],
    suspensionDays: v.suspensionDays,
    fine: Number(v.fineAmount),
    finePaid: v.finePaid,
    status: CASE_STATUS_LABELS[v.status],
    open: v.status === "OPEN",
    closingNote: v.closingNote,
    recordedBy: v.recordedBy.fullName,
  }));
  const trips = s.trips
    .map((p) => ({
      id: p.tripId,
      title: p.trip.title,
      destination: p.trip.destination,
      departDate: fromDbDate(p.trip.departDate),
      returnDate: fromDbDate(p.trip.returnDate),
      tripStatus: TRIP_STATUS_LABELS[p.trip.status],
      registered: p.status === "REGISTERED",
      consent: CONSENT_LABELS[p.consent],
      fee: Number(p.trip.feeAmount),
      feePaid: Number(p.feePaid),
      receiptNo: p.receiptNo,
      departed: !!p.departedAt,
      returned: !!p.returnedAt,
      overrideNote: p.overrideNote,
    }))
    .sort((a, b) => (a.departDate < b.departDate ? 1 : -1));
  const teams = s.teams
    .map((m) => ({
      id: m.teamId,
      sport: m.team.sport.name,
      event: m.team.event.name,
      date: fromDbDate(m.team.event.startDate),
      role: m.role,
      position: m.position,
      jerseyNo: m.jerseyNo,
      status: cap(m.status),
      consent: CONSENT_LABELS[m.consent],
    }))
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const achievements = s.achievements.map((a) => ({
    id: a.id,
    date: fromDbDate(a.achievedOn),
    event: a.event,
    position: a.position,
    notes: a.notes,
  }));
  const fines: StudentAudit["fines"] = [
    ...lates.filter((l) => l.fine > 0).map((l) => ({ key: `l${l.id}`, date: l.date, source: "Late arrival" as const, detail: `${l.minutesLate} min late · ${l.reason}`, amount: l.fine, paid: l.finePaid })),
    ...violations.filter((v) => v.fine > 0).map((v) => ({ key: `v${v.id}`, date: v.date, source: "Violation" as const, detail: v.type, amount: v.fine, paid: v.finePaid, href: `/violations/${v.id}` })),
  ].sort((a, b) => (a.date < b.date ? 1 : -1));

  const lateTrend: StudentAudit["lateTrend"] = [];
  const [y, m] = thisMonth.split("-").map(Number);
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const key = d.toISOString().slice(0, 7);
    lateTrend.push({ month: key, count: lates.filter((l) => l.date.startsWith(key)).length });
  }
  const latesThisMonth = lateTrend[11].count;

  return {
    student: {
      rollNo: s.rollNo,
      fullName: s.fullName,
      fatherName: s.fatherName,
      program: s.program,
      section: s.section,
      shift: sectionRow?.shift === "EVENING" ? "Evening" : "Morning",
      sectionYear: sectionRow?.year === "FIRST" ? "1st year" : sectionRow?.year === "SECOND" ? "2nd year" : null,
      parentPhone: s.parentPhone,
      studentPhone: s.studentPhone,
      photoUrl: s.photoUrl,
      status: STUDENT_STATUS_LABELS[s.status],
      active: s.status === "ACTIVE",
      addedOn: fromDbDate(s.createdAt),
      updatedOn: fromDbDate(s.updatedAt),
    },
    totals: {
      lates: lates.length,
      latesThisMonth,
      monthLevel: strikeLevel(latesThisMonth, settings),
      avgMinutesLate: lates.length ? Math.round(lates.reduce((a, l) => a + l.minutesLate, 0) / lates.length) : 0,
      violations: violations.length,
      openCases: violations.filter((v) => v.open).length,
      severeCases: s.violations.filter((v) => v.severity === "MAJOR" || v.severity === "SEVERE").length,
      finesTotal: fines.reduce((a, f) => a + f.amount, 0),
      finesUnpaid: fines.filter((f) => !f.paid).reduce((a, f) => a + f.amount, 0),
      trips: trips.length,
      teams: teams.length,
      achievements: achievements.length,
    },
    lateTrend,
    lates,
    violations,
    trips,
    teams,
    achievements,
    fines,
  };
}
