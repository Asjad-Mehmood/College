import "server-only";
import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { parseHHMM } from "@/lib/time";

export type Settings = {
  collegeName: string;
  collegeAddress: string;
  timezone: string;
  schedule: "SUMMER" | "WINTER";
  summerStartTime: string;
  winterStartTime: string;
  gracePeriodMins: number;
  habitualThreshold: number;
  criticalThreshold: number;
  defaultFineAmount: number;
  /** Start time of the active schedule, "HH:MM" */
  startTime: string;
  /** Start time of the active schedule in minutes since midnight */
  startMinutes: number;
};

export const getSettings = cache(async (): Promise<Settings> => {
  const row =
    (await prisma.portalSettings.findUnique({ where: { id: 1 } })) ??
    (await prisma.portalSettings.create({ data: { id: 1 } }));
  const startTime = row.schedule === "WINTER" ? row.winterStartTime : row.summerStartTime;
  return {
    collegeName: row.collegeName,
    collegeAddress: row.collegeAddress,
    timezone: row.timezone,
    schedule: row.schedule,
    summerStartTime: row.summerStartTime,
    winterStartTime: row.winterStartTime,
    gracePeriodMins: row.gracePeriodMins,
    habitualThreshold: row.habitualThreshold,
    criticalThreshold: row.criticalThreshold,
    defaultFineAmount: Number(row.defaultFineAmount),
    startTime,
    startMinutes: parseHHMM(startTime),
  };
});
