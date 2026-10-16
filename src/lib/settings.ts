import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { parseHHMM } from "@/lib/time";

export type ShiftKey = "MORNING" | "EVENING";
export const SHIFT_LABELS: Record<ShiftKey, string> = { MORNING: "Morning", EVENING: "Evening" };

export type Settings = {
  collegeName: string;
  collegeAddress: string;
  timezone: string;
  schedule: "SUMMER" | "WINTER";
  summerStartTime: string;
  winterStartTime: string;
  eveningSummerStartTime: string;
  eveningWinterStartTime: string;
  gracePeriodMins: number;
  habitualThreshold: number;
  criticalThreshold: number;
  defaultFineAmount: number;
  /** Morning shift start time of the active schedule, "HH:MM" */
  startTime: string;
  /** Morning shift start time of the active schedule in minutes since midnight */
  startMinutes: number;
  /** Start of each shift under the active schedule. */
  shifts: Record<ShiftKey, { startTime: string; startMinutes: number }>;
};

/** Start of the given shift (morning when unknown). */
export function shiftStart(settings: Settings, shift: ShiftKey | null | undefined) {
  return settings.shifts[shift ?? "MORNING"];
}

export const getSettings = cache(async (): Promise<Settings> => {
  const row =
    (await prisma.portalSettings.findUnique({ where: { id: 1 } })) ??
    (await prisma.portalSettings.create({ data: { id: 1 } }));
  const winter = row.schedule === "WINTER";
  const startTime = winter ? row.winterStartTime : row.summerStartTime;
  const eveningStart = winter ? row.eveningWinterStartTime : row.eveningSummerStartTime;
  return {
    collegeName: row.collegeName,
    collegeAddress: row.collegeAddress,
    timezone: row.timezone,
    schedule: row.schedule,
    summerStartTime: row.summerStartTime,
    winterStartTime: row.winterStartTime,
    eveningSummerStartTime: row.eveningSummerStartTime,
    eveningWinterStartTime: row.eveningWinterStartTime,
    gracePeriodMins: row.gracePeriodMins,
    habitualThreshold: row.habitualThreshold,
    criticalThreshold: row.criticalThreshold,
    defaultFineAmount: Number(row.defaultFineAmount),
    startTime,
    startMinutes: parseHHMM(startTime),
    shifts: {
      MORNING: { startTime, startMinutes: parseHHMM(startTime) },
      EVENING: { startTime: eveningStart, startMinutes: parseHHMM(eveningStart) },
    },
  };
});
