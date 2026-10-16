"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ViolationAction } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { VIOLATION_ACTION_LABELS } from "@/lib/labels";
import { smsLink, whatsAppLink } from "@/lib/messages";
import { prisma } from "@/lib/prisma";
import { resolveRoll } from "@/lib/student-lookup";
import { getSettings } from "@/lib/settings";
import { formatDate, isValidYmd, localParts, toDbDate } from "@/lib/time";
import { violationParentMessage } from "@/lib/violations";

export type ViolationStudent = {
  rollNo: string;
  fullName: string;
  fatherName: string;
  program: string;
  section: string;
  photoUrl: string | null;
  status: "ACTIVE" | "STRUCK_OFF" | "GRADUATED";
  totalViolations: number;
  openCases: number;
  recent: { id: number; date: string; type: string; severity: "MINOR" | "MAJOR" | "SEVERE" }[];
};

export type FindStudentResult =
  | { ok: true; student: ViolationStudent }
  | { ok: false; error: string; suggestions: { rollNo: string; fullName: string; program: string; section: string }[] };

export async function findStudentForViolation(rawRoll: string): Promise<FindStudentResult> {
  await requireUser(["ADMIN"]);
  const rollNo = rawRoll.trim().toUpperCase().replace(/\s+/g, "");
  if (!rollNo) return { ok: false, error: "Enter a roll number.", suggestions: [] };

  const student = await prisma.student.findFirst({
    where: { rollNo: { equals: (await resolveRoll(rollNo)) ?? rollNo, mode: "insensitive" } },
    include: {
      violations: {
        orderBy: { incidentDate: "desc" },
        take: 3,
        include: { type: { select: { name: true } } },
      },
      _count: { select: { violations: true } },
    },
  });
  if (!student) {
    const suggestions = await prisma.student.findMany({
      where: { rollNo: { contains: rollNo, mode: "insensitive" } },
      select: { rollNo: true, fullName: true, program: true, section: true },
      take: 5,
      orderBy: { rollNo: "asc" },
    });
    return { ok: false, error: `No student found with roll number “${rollNo}”.`, suggestions };
  }
  const openCases = await prisma.violation.count({ where: { rollNo: student.rollNo, status: "OPEN" } });
  return {
    ok: true,
    student: {
      rollNo: student.rollNo,
      fullName: student.fullName,
      fatherName: student.fatherName,
      program: student.program,
      section: student.section,
      photoUrl: student.photoUrl,
      status: student.status,
      totalViolations: student._count.violations,
      openCases,
      recent: student.violations.map((v) => ({
        id: v.id,
        date: formatDate(v.incidentDate.toISOString().slice(0, 10)),
        type: v.type.name,
        severity: v.severity,
      })),
    },
  };
}

export type ViolationInput = {
  typeId: number;
  incidentDate: string;
  incidentTime: string;
  location: string;
  description: string;
  reportedBy: string;
  actionTaken: ViolationAction;
  suspensionDays: number | null;
  fineAmount: number;
  notifyParent?: boolean;
};

type Validated =
  | { ok: false; error: string }
  | {
      ok: true;
      data: {
        typeId: number;
        severity: "MINOR" | "MAJOR" | "SEVERE";
        typeName: string;
        incidentDate: Date;
        incidentTime: string | null;
        location: string | null;
        description: string;
        reportedBy: string | null;
        actionTaken: ViolationAction;
        suspensionDays: number | null;
        fineAmount: number;
      };
    };

async function validate(input: ViolationInput, allowInactiveTypeId?: number): Promise<Validated> {
  const settings = await getSettings();
  const type = await prisma.violationType.findUnique({ where: { id: Number(input.typeId) } });
  if (!type || (!type.active && type.id !== allowInactiveTypeId)) {
    return { ok: false, error: "Choose the type of violation." };
  }
  const today = localParts(new Date(), settings.timezone).date;
  if (!isValidYmd(input.incidentDate)) return { ok: false, error: "Enter the date of the incident." };
  if (input.incidentDate > today) return { ok: false, error: "The incident date can't be in the future." };
  const time = input.incidentTime.trim();
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) return { ok: false, error: "Time must be HH:MM." };
  const description = input.description.trim();
  if (description.length < 5) return { ok: false, error: "Describe what happened." };
  if (!(input.actionTaken in VIOLATION_ACTION_LABELS)) return { ok: false, error: "Choose the action taken." };
  let suspensionDays: number | null = null;
  if (input.actionTaken === "SUSPENSION") {
    suspensionDays = Number(input.suspensionDays);
    if (!Number.isInteger(suspensionDays) || suspensionDays < 1 || suspensionDays > 60) {
      return { ok: false, error: "Suspension must be between 1 and 60 days." };
    }
  }
  const fineAmount = Math.round(Number(input.fineAmount) || 0);
  if (fineAmount < 0 || fineAmount > 999_999) return { ok: false, error: "Enter a valid fine amount." };

  return {
    ok: true,
    data: {
      typeId: type.id,
      severity: type.severity,
      typeName: type.name,
      incidentDate: toDbDate(input.incidentDate),
      incidentTime: time || null,
      location: input.location.trim().slice(0, 100) || null,
      description: description.slice(0, 2000),
      reportedBy: input.reportedBy.trim().slice(0, 100) || null,
      actionTaken: input.actionTaken,
      suspensionDays,
      fineAmount,
    },
  };
}

export type CreateResult =
  | { ok: true; id: number; notify: { message: string; whatsapp: string; sms: string } | null }
  | { ok: false; error: string };

export async function createViolation(rollNo: string, input: ViolationInput): Promise<CreateResult> {
  const user = await requireUser(["ADMIN"]);
  const student = await prisma.student.findUnique({ where: { rollNo } });
  if (!student) return { ok: false, error: "Student not found." };
  const v = await validate(input);
  if (!v.ok) return v;
  const { typeName, ...data } = v.data;

  const violation = await prisma.violation.create({
    data: { ...data, rollNo: student.rollNo, parentNotified: !!input.notifyParent, recordedById: user.id },
  });

  let notify = null;
  if (input.notifyParent) {
    const settings = await getSettings();
    const message = violationParentMessage({
      studentName: student.fullName,
      rollNo: student.rollNo,
      className: `${student.program} ${student.section}`,
      typeName,
      date: formatDate(input.incidentDate),
      action:
        data.actionTaken === "SUSPENSION"
          ? `Suspension for ${data.suspensionDays} day(s)`
          : VIOLATION_ACTION_LABELS[data.actionTaken],
      fineAmount: data.fineAmount,
      collegeName: settings.collegeName,
    });
    notify = { message, whatsapp: whatsAppLink(student.parentPhone, message), sms: smsLink(student.parentPhone, message) };
  }
  refresh();
  return { ok: true, id: violation.id, notify };
}

export async function updateViolation(id: number, input: ViolationInput): Promise<{ ok: boolean; error?: string }> {
  await requireUser(["ADMIN"]);
  const existing = await prisma.violation.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Case not found." };
  const v = await validate(input, existing.typeId);
  if (!v.ok) return v;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- only used for messages
  const { typeName, ...data } = v.data;
  await prisma.violation.update({
    where: { id },
    data: {
      ...data,
      ...(data.fineAmount === 0 ? { finePaid: false, finePaidAt: null } : {}),
    },
  });
  redirect(`/violations/${id}`);
}

export async function setViolationFinePaid(id: number, paid: boolean) {
  await requireUser(["ADMIN"]);
  await prisma.violation.update({ where: { id }, data: { finePaid: paid, finePaidAt: paid ? new Date() : null } });
  refresh();
}

export async function closeViolation(id: number, note: string) {
  await requireUser(["ADMIN"]);
  await prisma.violation.update({
    where: { id },
    data: { status: "CLOSED", closedAt: new Date(), closingNote: note.trim().slice(0, 300) || null },
  });
  refresh();
}

export async function reopenViolation(id: number) {
  await requireUser(["ADMIN"]);
  await prisma.violation.update({ where: { id }, data: { status: "OPEN", closedAt: null, closingNote: null } });
  refresh();
}

export async function deleteViolation(id: number) {
  await requireUser(["ADMIN"]);
  await prisma.violation.delete({ where: { id } });
  redirect("/violations");
}
