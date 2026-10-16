"use server";

import { refresh } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type { DisciplineAction, LateReason } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { parentLateMessage, smsLink, whatsAppLink } from "@/lib/messages";
import { prisma } from "@/lib/prisma";
import { SHIFT_LABELS, getSettings, shiftStart, type ShiftKey } from "@/lib/settings";
import { strikeLevel, type StrikeLevel } from "@/lib/strikes";
import { closedYearMessage } from "@/lib/scope";
import { resolveRoll } from "@/lib/student-lookup";
import {
  formatMinutes,
  fromDbDate,
  localParts,
  monthStart,
  nextMonthStart,
  toDbDate,
} from "@/lib/time";
import { REASONS } from "@/lib/labels";

export type GateStudent = {
  rollNo: string;
  fullName: string;
  fatherName: string;
  program: string;
  section: string;
  photoUrl: string | null;
  status: "ACTIVE" | "STRUCK_OFF" | "GRADUATED";
};

export type LookupResult =
  | {
      ok: true;
      student: GateStudent;
      /** Lates already recorded this month (before this one) */
      monthCount: number;
      /** Strike number this entry would become */
      nextStrike: number;
      level: StrikeLevel;
      alreadyToday: { id: number; time: string } | null;
      arrivalTime: string;
      minutesLate: number;
      withinGrace: boolean;
      startTime: string;
      /** "Morning" or "Evening" */
      shift: string;
      defaultFine: number;
      /** Latest late arrivals of this student (newest first) */
      recent: { date: string; minutesLate: number }[];
    }
  | { ok: false; error: string; suggestions: GateStudent[] };

const studentSelect = {
  rollNo: true,
  fullName: true,
  fatherName: true,
  program: true,
  section: true,
  photoUrl: true,
  status: true,
} as const;

function normalizeRoll(raw: string) {
  return raw.trim().toUpperCase().replace(/\s+/g, "");
}

function arrival(settings: Awaited<ReturnType<typeof getSettings>>, shift: ShiftKey) {
  const now = new Date();
  const local = localParts(now, settings.timezone);
  return {
    now,
    today: local.date,
    arrivalTime: formatMinutes(local.minutes),
    minutesLate: local.minutes - shiftStart(settings, shift).startMinutes,
  };
}

/** A student's shift comes from their section (morning if the section isn't set up). */
async function shiftOf(section: string): Promise<ShiftKey> {
  const row = await prisma.section.findUnique({ where: { name: section }, select: { shift: true } });
  return row?.shift ?? "MORNING";
}

export async function lookupStudent(rawRoll: string): Promise<LookupResult> {
  await requireUser(["ADMIN", "GATE"]);
  const rollNo = normalizeRoll(rawRoll);
  if (!rollNo) return { ok: false, error: "Enter a roll number.", suggestions: [] };

  const settings = await getSettings();
  const student = await prisma.student.findFirst({
    where: { rollNo: { equals: (await resolveRoll(rollNo)) ?? rollNo, mode: "insensitive" } },
    select: studentSelect,
  });

  if (!student) {
    const suggestions = await prisma.student.findMany({
      where: { rollNo: { contains: rollNo, mode: "insensitive" }, status: "ACTIVE" },
      select: studentSelect,
      take: 5,
      orderBy: { rollNo: "asc" },
    });
    return { ok: false, error: `No student found with roll number “${rollNo}”.`, suggestions };
  }

  const shift = await shiftOf(student.section);
  const { today, arrivalTime, minutesLate } = arrival(settings, shift);
  const [monthCount, todayRecord, recentRows] = await Promise.all([
    prisma.lateRecord.count({
      where: {
        rollNo: student.rollNo,
        lateDate: { gte: toDbDate(monthStart(today)), lt: toDbDate(nextMonthStart(today)) },
      },
    }),
    prisma.lateRecord.findUnique({
      where: { rollNo_lateDate: { rollNo: student.rollNo, lateDate: toDbDate(today) } },
      select: { id: true, arrivedAt: true },
    }),
    prisma.lateRecord.findMany({
      where: { rollNo: student.rollNo },
      orderBy: { lateDate: "desc" },
      take: 4,
      select: { lateDate: true, minutesLate: true },
    }),
  ]);

  const nextStrike = todayRecord ? monthCount : monthCount + 1;
  return {
    ok: true,
    student,
    monthCount,
    nextStrike,
    level: strikeLevel(nextStrike, settings),
    alreadyToday: todayRecord
      ? {
          id: todayRecord.id,
          time: formatMinutes(localParts(todayRecord.arrivedAt, settings.timezone).minutes),
        }
      : null,
    arrivalTime,
    minutesLate,
    withinGrace: minutesLate <= settings.gracePeriodMins,
    startTime: formatMinutes(shiftStart(settings, shift).startMinutes),
    shift: SHIFT_LABELS[shift],
    defaultFine: settings.defaultFineAmount,
    recent: recentRows.map((r) => ({ date: fromDbDate(r.lateDate), minutesLate: r.minutesLate })),
  };
}

/** Type-ahead for the roll box: matches roll number (any part) or name. */
export async function searchStudents(raw: string): Promise<GateStudent[]> {
  await requireUser(["ADMIN", "GATE"]);
  const q = raw.trim().slice(0, 60);
  if (q.length < 2) return [];
  return prisma.student.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { rollNo: { contains: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
      ],
    },
    select: studentSelect,
    take: 6,
    orderBy: { rollNo: "asc" },
  });
}

/** Undo a mistaken entry. Only today's records can be removed from the gate. */
export async function undoLateArrival(id: number): Promise<{ ok: boolean; error?: string }> {
  await requireUser(["ADMIN", "GATE"]);
  const settings = await getSettings();
  const today = localParts(new Date(), settings.timezone).date;
  const record = await prisma.lateRecord.findUnique({ where: { id }, select: { lateDate: true } });
  if (!record) return { ok: false, error: "Entry not found." };
  if (fromDbDate(record.lateDate) !== today) return { ok: false, error: "Only today's entries can be removed here." };
  await prisma.lateRecord.delete({ where: { id } });
  refresh();
  return { ok: true };
}

export type LogResult =
  | {
      ok: true;
      recordId: number;
      strike: number;
      level: StrikeLevel;
      arrivalTime: string;
      minutesLate: number;
      notify: { whatsapp: string; sms: string; message: string } | null;
    }
  | { ok: false; error: string };

export async function logLateArrival(input: {
  rollNo: string;
  reason: LateReason;
  fine: boolean;
  fineAmount?: number;
  notifyParent: boolean;
  remarks?: string;
}): Promise<LogResult> {
  const user = await requireUser(["ADMIN", "GATE"]);
  const settings = await getSettings();

  if (!REASONS.some((r) => r.value === input.reason)) {
    return { ok: false, error: "Choose a reason." };
  }
  const student = await prisma.student.findUnique({ where: { rollNo: input.rollNo } });
  if (!student) return { ok: false, error: "Student not found." };
  if (student.status !== "ACTIVE") {
    return { ok: false, error: "This student is not active (struck off or graduated)." };
  }

  // Time is always taken on the server, never trusted from the device.
  const { now, today, arrivalTime, minutesLate } = arrival(settings, await shiftOf(student.section));
  const locked = await closedYearMessage(today);
  if (locked) return { ok: false, error: locked };
  if (minutesLate <= settings.gracePeriodMins) {
    return {
      ok: false,
      error: `Within the ${settings.gracePeriodMins}-minute grace period — not counted as late.`,
    };
  }

  const fineAmount = input.fine
    ? Math.max(0, Math.round(Number(input.fineAmount ?? settings.defaultFineAmount) || 0))
    : 0;
  // Escalation: habitual offenders get a written warning instead of a verbal one.
  const monthRange = { gte: toDbDate(monthStart(today)), lt: toDbDate(nextMonthStart(today)) };
  const strikeNow = (await prisma.lateRecord.count({ where: { rollNo: student.rollNo, lateDate: monthRange } })) + 1;
  const actionTaken: DisciplineAction =
    fineAmount > 0 ? "FINE" : strikeNow >= settings.habitualThreshold ? "WRITTEN_WARNING" : "VERBAL_WARNING";

  let recordId: number;
  try {
    const record = await prisma.lateRecord.create({
      data: {
        rollNo: student.rollNo,
        lateDate: toDbDate(today),
        arrivedAt: now,
        minutesLate,
        reason: input.reason,
        actionTaken,
        fineAmount,
        parentNotified: input.notifyParent,
        remarks: input.remarks?.trim() || null,
        recordedById: user.id,
      },
    });
    recordId = record.id;
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "This student has already been logged late today." };
    }
    throw e;
  }

  const strike = await prisma.lateRecord.count({ where: { rollNo: student.rollNo, lateDate: monthRange } });

  let notify = null;
  if (input.notifyParent) {
    const message = parentLateMessage({
      studentName: student.fullName,
      rollNo: student.rollNo,
      className: `${student.program} ${student.section}`,
      time: arrivalTime,
      monthCount: strike,
      collegeName: settings.collegeName,
    });
    notify = {
      message,
      whatsapp: whatsAppLink(student.parentPhone, message),
      sms: smsLink(student.parentPhone, message),
    };
  }

  refresh();
  return {
    ok: true,
    recordId,
    strike,
    level: strikeLevel(strike, settings),
    arrivalTime,
    minutesLate,
    notify,
  };
}

export type OfflineEntry = { id: string; rollNo: string; reason: LateReason; arrivedAt: string; remarks?: string };
export type OfflineResult = { id: string; ok: boolean; message: string };

/**
 * Saves entries the gate phone recorded while offline. The arrival time is
 * the phone's clock at the moment of entry; it must be within the last two
 * days and not in the future.
 */
export async function syncOfflineArrivals(entries: OfflineEntry[]): Promise<OfflineResult[]> {
  const user = await requireUser(["ADMIN", "GATE"]);
  const settings = await getSettings();
  const now = Date.now();
  const results: OfflineResult[] = [];
  for (const e of entries.slice(0, 200)) {
    const at = new Date(e.arrivedAt);
    if (Number.isNaN(at.getTime()) || at.getTime() > now + 5 * 60_000 || at.getTime() < now - 2 * 86_400_000) {
      results.push({ id: e.id, ok: false, message: "The recorded time is not valid." });
      continue;
    }
    if (!REASONS.some((r) => r.value === e.reason)) {
      results.push({ id: e.id, ok: false, message: "Unknown reason." });
      continue;
    }
    const raw = normalizeRoll(e.rollNo);
    const student = await prisma.student.findFirst({ where: { rollNo: { equals: (await resolveRoll(raw)) ?? raw, mode: "insensitive" } } });
    if (!student) {
      results.push({ id: e.id, ok: false, message: `No student with roll number “${raw}”.` });
      continue;
    }
    if (student.status !== "ACTIVE") {
      results.push({ id: e.id, ok: false, message: `${student.fullName} is not active.` });
      continue;
    }
    const local = localParts(at, settings.timezone);
    const minutesLate = local.minutes - shiftStart(settings, await shiftOf(student.section)).startMinutes;
    if (minutesLate <= settings.gracePeriodMins) {
      results.push({
        id: e.id,
        ok: true,
        message: minutesLate <= 0 ? `${student.fullName}: arrived on time, not counted.` : `${student.fullName}: within the grace period, not counted.`,
      });
      continue;
    }
    const monthRange = { gte: toDbDate(monthStart(local.date)), lt: toDbDate(nextMonthStart(local.date)) };
    const strike = (await prisma.lateRecord.count({ where: { rollNo: student.rollNo, lateDate: monthRange } })) + 1;
    try {
      await prisma.lateRecord.create({
        data: {
          rollNo: student.rollNo,
          lateDate: toDbDate(local.date),
          arrivedAt: at,
          minutesLate,
          reason: e.reason,
          actionTaken: strike >= settings.habitualThreshold ? "WRITTEN_WARNING" : "VERBAL_WARNING",
          fineAmount: 0,
          parentNotified: false,
          remarks: [e.remarks?.trim(), "Recorded offline"].filter(Boolean).join(" · ").slice(0, 500),
          recordedById: user.id,
        },
      });
      results.push({ id: e.id, ok: true, message: `${student.fullName}: saved (${minutesLate} min late).` });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
        results.push({ id: e.id, ok: true, message: `${student.fullName} was already logged that day.` });
      } else {
        results.push({ id: e.id, ok: false, message: "Couldn't save. Will try again." });
      }
    }
  }
  if (results.some((r) => r.ok)) refresh();
  return results;
}
