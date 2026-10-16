"use server";

import { refresh } from "next/cache";
import type { Role, Severity } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";
import { importStudents, type ImportReport } from "@/lib/student-import";

export type SettingsState = { ok?: boolean; message?: string } | null;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

function int(value: FormDataEntryValue | null, min: number, max: number) {
  const n = Number(value);
  return Number.isInteger(n) && n >= min && n <= max ? n : null;
}

export async function saveSettings(_: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireUser(["ADMIN"]);
  const collegeName = String(formData.get("collegeName") ?? "").trim();
  const collegeAddress = String(formData.get("collegeAddress") ?? "").trim();
  const timezone = String(formData.get("timezone") ?? "").trim();
  const summerStartTime = String(formData.get("summerStartTime") ?? "");
  const winterStartTime = String(formData.get("winterStartTime") ?? "");
  const gracePeriodMins = int(formData.get("gracePeriodMins"), 0, 120);
  const habitualThreshold = int(formData.get("habitualThreshold"), 2, 31);
  const criticalThreshold = int(formData.get("criticalThreshold"), 2, 31);
  const defaultFineAmount = int(formData.get("defaultFineAmount"), 0, 100_000);

  if (!collegeName) return { ok: false, message: "College name is required." };
  if (!TIME.test(summerStartTime) || !TIME.test(winterStartTime)) {
    return { ok: false, message: "Start times must be in HH:MM format." };
  }
  try {
    new Intl.DateTimeFormat("en", { timeZone: timezone });
  } catch {
    return { ok: false, message: `Unknown timezone “${timezone}”.` };
  }
  if (gracePeriodMins === null || habitualThreshold === null || criticalThreshold === null || defaultFineAmount === null) {
    return { ok: false, message: "Check the numbers: grace 0–120 min, thresholds 2–31, fine 0–100,000." };
  }
  if (criticalThreshold <= habitualThreshold) {
    return { ok: false, message: "The critical threshold must be higher than the habitual threshold." };
  }

  const data = {
    collegeName: collegeName.slice(0, 150),
    collegeAddress: collegeAddress.slice(0, 255),
    timezone,
    summerStartTime,
    winterStartTime,
    gracePeriodMins,
    habitualThreshold,
    criticalThreshold,
    defaultFineAmount,
  };
  await prisma.portalSettings.upsert({ where: { id: 1 }, update: data, create: { id: 1, ...data } });
  refresh();
  return { ok: true, message: "Settings saved." };
}

export async function setSchedule(schedule: "SUMMER" | "WINTER") {
  await requireUser(["ADMIN"]);
  await prisma.portalSettings.upsert({
    where: { id: 1 },
    update: { schedule },
    create: { id: 1, schedule },
  });
  refresh();
}

export async function uploadStudents(_: ImportReport | null, formData: FormData): Promise<ImportReport> {
  await requireUser(["ADMIN"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, message: "Choose a file to upload." };
  }
  const report = await importStudents(file);
  if (report.ok) refresh();
  return report;
}

const ROLES: Role[] = ["ADMIN", "GATE", "PRINCIPAL"];

export async function createUser(_: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireUser(["ADMIN"]);
  const fullName = String(formData.get("fullName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = String(formData.get("role") ?? "") as Role;

  if (!fullName || !username || !ROLES.includes(role)) return { ok: false, message: "Fill in every field." };
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    return { ok: false, message: "Username: 3–50 letters, numbers, dots, dashes or underscores." };
  }
  if (password.length < 8) return { ok: false, message: "Password must be at least 8 characters." };
  if (await prisma.user.findUnique({ where: { username } })) {
    return { ok: false, message: `The username “${username}” is taken.` };
  }
  await prisma.user.create({
    data: { fullName: fullName.slice(0, 100), username, role, passwordHash: await hashPassword(password) },
  });
  refresh();
  return { ok: true, message: `Account created for ${fullName}.` };
}

export async function resetPassword(userId: number, password: string): Promise<SettingsState> {
  await requireUser(["ADMIN"]);
  if (password.length < 8) return { ok: false, message: "Password must be at least 8 characters." };
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(password) } }),
    // Sign the user out everywhere.
    prisma.session.deleteMany({ where: { userId } }),
  ]);
  return { ok: true, message: "Password changed." };
}

export async function setUserActive(userId: number, active: boolean): Promise<SettingsState> {
  const me = await requireUser(["ADMIN"]);
  if (userId === me.id) return { ok: false, message: "You can't deactivate your own account." };
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { active } }),
    ...(active ? [] : [prisma.session.deleteMany({ where: { userId } })]),
  ]);
  refresh();
  return { ok: true, message: active ? "Account re-activated." : "Account deactivated." };
}

const SEVERITIES: Severity[] = ["MINOR", "MAJOR", "SEVERE"];

/** Creates a violation type, or updates one when `id` is present. */
export async function saveViolationType(_: SettingsState, formData: FormData): Promise<SettingsState> {
  await requireUser(["ADMIN"]);
  const id = Number(formData.get("id")) || null;
  const name = String(formData.get("name") ?? "").trim();
  const severity = String(formData.get("severity") ?? "") as Severity;
  const fine = Number(formData.get("defaultFineAmount"));
  if (!name || name.length > 80) return { ok: false, message: "Give the violation a name (up to 80 characters)." };
  if (!SEVERITIES.includes(severity)) return { ok: false, message: "Choose a severity." };
  if (!Number.isFinite(fine) || fine < 0 || fine > 100_000) return { ok: false, message: "Enter a fine between 0 and 100,000." };
  const data = { name, severity, defaultFineAmount: Math.round(fine) };
  try {
    if (id) await prisma.violationType.update({ where: { id }, data });
    else await prisma.violationType.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: `“${name}” already exists.` };
    }
    throw e;
  }
  refresh();
  return { ok: true, message: id ? "Violation type updated." : `Added “${name}”.` };
}

export async function setViolationTypeActive(id: number, active: boolean) {
  await requireUser(["ADMIN"]);
  await prisma.violationType.update({ where: { id }, data: { active } });
  refresh();
}
