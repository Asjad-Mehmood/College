"use server";

import { refresh } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import type { DisciplineAction, LateReason } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { parentLateMessage, smsLink, whatsAppLink } from "@/lib/messages";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { strikeLevel, type StrikeLevel } from "@/lib/strikes";
import {
  formatMinutes,
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
      defaultFine: number;
      cardHeld: boolean;
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

function arrival(settings: Awaited<ReturnType<typeof getSettings>>) {
  const now = new Date();
  const local = localParts(now, settings.timezone);
  return {
    now,
    today: local.date,
    arrivalTime: formatMinutes(local.minutes),
    minutesLate: local.minutes - settings.startMinutes,
  };
}

export async function lookupStudent(rawRoll: string): Promise<LookupResult> {
  await requireUser(["ADMIN", "GATE"]);
  const rollNo = normalizeRoll(rawRoll);
  if (!rollNo) return { ok: false, error: "Enter a roll number.", suggestions: [] };

  const settings = await getSettings();
  const student = await prisma.student.findFirst({
    where: { rollNo: { equals: rollNo, mode: "insensitive" } },
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

  const { today, arrivalTime, minutesLate } = arrival(settings);
  const [monthCount, todayRecord, heldCard] = await Promise.all([
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
    prisma.lateRecord.findFirst({
      where: { rollNo: student.rollNo, cardStatus: "HELD" },
      select: { id: true },
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
    startTime: formatMinutes(settings.startMinutes),
    defaultFine: settings.defaultFineAmount,
    cardHeld: !!heldCard,
  };
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
  holdCard: boolean;
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
  const { now, today, arrivalTime, minutesLate } = arrival(settings);
  if (minutesLate <= settings.gracePeriodMins) {
    return {
      ok: false,
      error: `Within the ${settings.gracePeriodMins}-minute grace period — not counted as late.`,
    };
  }

  const fineAmount = input.fine
    ? Math.max(0, Math.round(Number(input.fineAmount ?? settings.defaultFineAmount) || 0))
    : 0;
  const actionTaken: DisciplineAction =
    fineAmount > 0 ? "FINE" : input.holdCard ? "ID_CONFISCATED" : "VERBAL_WARNING";

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
        cardStatus: input.holdCard ? "HELD" : "NONE",
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

  const strike = await prisma.lateRecord.count({
    where: {
      rollNo: student.rollNo,
      lateDate: { gte: toDbDate(monthStart(today)), lt: toDbDate(nextMonthStart(today)) },
    },
  });

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
