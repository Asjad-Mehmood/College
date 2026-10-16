"use server";

import { randomUUID } from "node:crypto";
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

export type SavedCase = {
  id: number;
  rollNo: string;
  fullName: string;
  notify: { message: string; whatsapp: string; sms: string } | null;
};

export type CreateResult = { ok: true; id: number; cases: SavedCase[] } | { ok: false; error: string };

/** Record one incident for one or more students: one case per student, linked by an incident group. */
export async function createViolation(rollNos: string[], input: ViolationInput): Promise<CreateResult> {
  const user = await requireUser(["ADMIN"]);
  const unique = [...new Set(rollNos)].slice(0, 50);
  if (unique.length === 0) return { ok: false, error: "Add at least one student." };
  const students = await prisma.student.findMany({ where: { rollNo: { in: unique } } });
  if (students.length !== unique.length) return { ok: false, error: "One of the students was not found." };
  const inactive = students.find((s) => s.status !== "ACTIVE");
  if (inactive) return { ok: false, error: `${inactive.fullName} is not active (struck off or graduated).` };
  const v = await validate(input);
  if (!v.ok) return v;
  const { typeName, ...data } = v.data;
  const incidentGroup = unique.length > 1 ? randomUUID() : null;
  const settings = input.notifyParent ? await getSettings() : null;

  const ordered = unique.map((r) => students.find((s) => s.rollNo === r)!);
  const cases = await prisma.$transaction(
    ordered.map((student) =>
      prisma.violation.create({
        data: { ...data, rollNo: student.rollNo, incidentGroup, parentNotified: !!input.notifyParent, recordedById: user.id },
        select: { id: true, rollNo: true },
      }),
    ),
  );

  const saved: SavedCase[] = cases.map((c) => {
    const student = ordered.find((s) => s.rollNo === c.rollNo)!;
    let notify = null;
    if (settings) {
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
    return { id: c.id, rollNo: student.rollNo, fullName: student.fullName, notify };
  });
  refresh();
  return { ok: true, id: saved[0].id, cases: saved };
}

/** Add another student to an existing incident: copies the case details for them. */
export async function addStudentToIncident(caseId: number, rawRoll: string): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser(["ADMIN"]);
  const base = await prisma.violation.findUnique({ where: { id: caseId } });
  if (!base) return { ok: false, error: "Case not found." };
  const roll = (await resolveRoll(rawRoll.trim().toUpperCase())) ?? rawRoll.trim().toUpperCase();
  const student = await prisma.student.findFirst({ where: { rollNo: { equals: roll, mode: "insensitive" } } });
  if (!student) return { ok: false, error: `No student found with roll number “${rawRoll.trim()}”.` };
  if (student.status !== "ACTIVE") return { ok: false, error: `${student.fullName} is not active.` };
  const group = base.incidentGroup ?? randomUUID();
  if (student.rollNo === base.rollNo) return { ok: false, error: "This student is already in the case." };
  if (base.incidentGroup) {
    const dup = await prisma.violation.findFirst({ where: { incidentGroup: group, rollNo: student.rollNo } });
    if (dup) return { ok: false, error: `${student.fullName} is already in this incident.` };
  }
  await prisma.$transaction([
    ...(base.incidentGroup ? [] : [prisma.violation.update({ where: { id: base.id }, data: { incidentGroup: group } })]),
    prisma.violation.create({
      data: {
        rollNo: student.rollNo,
        typeId: base.typeId,
        severity: base.severity,
        incidentDate: base.incidentDate,
        incidentTime: base.incidentTime,
        location: base.location,
        description: base.description,
        reportedBy: base.reportedBy,
        actionTaken: base.actionTaken,
        suspensionDays: base.suspensionDays,
        fineAmount: base.fineAmount,
        status: base.status,
        closedAt: base.closedAt,
        closingNote: base.closingNote,
        incidentGroup: group,
        recordedById: user.id,
      },
    }),
  ]);
  refresh();
  return { ok: true };
}

export async function updateViolation(id: number, input: ViolationInput): Promise<{ ok: boolean; error?: string }> {
  await requireUser(["ADMIN"]);
  const existing = await prisma.violation.findUnique({ where: { id } });
  if (!existing) return { ok: false, error: "Case not found." };
  const v = await validate(input, existing.typeId);
  if (!v.ok) return v;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- only used for messages
  const { typeName, ...data } = v.data;
  // Students recorded together share one case: the details change for all of them.
  await prisma.violation.updateMany({
    where: existing.incidentGroup ? { incidentGroup: existing.incidentGroup } : { id },
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

/** The case and every case recorded with it for the same incident. */
async function wholeCase(id: number) {
  const v = await prisma.violation.findUnique({ where: { id }, select: { incidentGroup: true } });
  return v?.incidentGroup ? { incidentGroup: v.incidentGroup } : { id };
}

export async function closeViolation(id: number, note: string) {
  await requireUser(["ADMIN"]);
  const data = { status: "CLOSED" as const, closedAt: new Date(), closingNote: note.trim().slice(0, 300) || null };
  await prisma.violation.updateMany({ where: await wholeCase(id), data });
  refresh();
}

export async function reopenViolation(id: number) {
  await requireUser(["ADMIN"]);
  await prisma.violation.updateMany({ where: await wholeCase(id), data: { status: "OPEN", closedAt: null, closingNote: null } });
  refresh();
}

/** Deletes the whole case (all students recorded together), or removes just this student. */
export async function deleteViolation(id: number, onlyThisStudent = false) {
  await requireUser(["ADMIN"]);
  if (onlyThisStudent) {
    const v = await prisma.violation.findUnique({ where: { id }, select: { incidentGroup: true } });
    const others = v?.incidentGroup ? await prisma.violation.findFirst({ where: { incidentGroup: v.incidentGroup, id: { not: id } }, select: { id: true } }) : null;
    // Keep the shared documents with the rest of the case.
    if (others) await prisma.violationAttachment.updateMany({ where: { violationId: id }, data: { violationId: others.id } });
    await prisma.violation.delete({ where: { id } });
    redirect(others ? `/violations/${others.id}` : "/violations");
  }
  await prisma.violation.deleteMany({ where: await wholeCase(id) });
  redirect("/violations");
}

const ATTACHMENT_TYPES: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/png": "PNG",
  "image/webp": "WEBP",
  "application/msword": "DOC",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "DOCX",
};
const MAX_ATTACHMENT_BYTES = 3.5 * 1024 * 1024;

/** Attach a file (application, undertaking, parent letter…) to a case. */
export async function uploadViolationFile(id: number, formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const user = await requireUser(["ADMIN"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Choose a file to upload." };
  if (!ATTACHMENT_TYPES[file.type]) return { ok: false, error: "Upload a PDF, photo (JPG/PNG) or Word file." };
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: "The file is larger than 3.5 MB. Scan at a lower quality or as PDF." };
  const exists = await prisma.violation.findUnique({ where: { id }, select: { id: true } });
  if (!exists) return { ok: false, error: "Case not found." };
  const note = String(formData.get("note") ?? "").trim().slice(0, 200) || null;
  await prisma.violationAttachment.create({
    data: {
      violationId: id,
      fileName: file.name.slice(0, 200) || "document",
      mimeType: file.type,
      size: file.size,
      data: new Uint8Array(await file.arrayBuffer()),
      note,
      uploadedBy: user.fullName,
    },
  });
  refresh();
  return { ok: true };
}

export async function deleteViolationFile(fileId: number) {
  await requireUser(["ADMIN"]);
  await prisma.violationAttachment.delete({ where: { id: fileId } });
  refresh();
}
