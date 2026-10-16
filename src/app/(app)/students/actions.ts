"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import type { StudentStatus, StudyYear } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { localParts } from "@/lib/time";
import { getSettings } from "@/lib/settings";
import { academicYearStart } from "@/lib/scope";

export type StudentFormState = { ok?: boolean; message?: string } | null;

const STATUSES: StudentStatus[] = ["ACTIVE", "STRUCK_OFF", "GRADUATED"];

export async function saveStudent(_: StudentFormState, formData: FormData): Promise<StudentFormState> {
  await requireUser(["ADMIN"]);
  const get = (k: string) => String(formData.get(k) ?? "").trim();
  const originalRollNo = get("originalRollNo");
  const data = {
    rollNo: get("rollNo").toUpperCase().replace(/\s+/g, ""),
    fullName: get("fullName"),
    fatherName: get("fatherName"),
    program: get("program"),
    section: get("section"),
    parentPhone: get("parentPhone"),
    studentPhone: get("studentPhone") || null,
    photoUrl: get("photoUrl") || null,
    status: (STATUSES.includes(get("status") as StudentStatus) ? get("status") : "ACTIVE") as StudentStatus,
    batchId: Number(get("batchId")) || null,
  };

  if (!data.rollNo || !data.fullName || !data.fatherName || !data.program || !data.section || !data.parentPhone) {
    return { ok: false, message: "Fill in every required field." };
  }
  if (data.rollNo.length > 20) return { ok: false, message: "Roll number must be 20 characters or fewer." };
  if (!(await prisma.program.findUnique({ where: { name: data.program } }))) {
    return { ok: false, message: "Choose a program from the list." };
  }
  if (data.batchId && !(await prisma.batch.findUnique({ where: { id: data.batchId } }))) {
    return { ok: false, message: "Choose a batch from the list." };
  }
  const sectionRow = await prisma.section.findUnique({ where: { name: data.section } });
  // A batch can only be in the sections of the year it is studying now.
  if (sectionRow?.year && data.batchId) {
    const b = await prisma.batch.findUnique({ where: { id: data.batchId } });
    const today = localParts(new Date(), (await getSettings()).timezone).date;
    const studying = b && !b.passedOut ? academicYearStart(today) - b.startYear : null;
    const expected = sectionRow.year === "FIRST" ? 0 : 1;
    if (b && studying !== null && studying !== expected && (studying === 0 || studying === 1)) {
      return {
        ok: false,
        message: `${b.name} is in ${studying === 0 ? "1st" : "2nd"} year now, but section ${data.section} is a ${expected === 0 ? "1st" : "2nd"}-year section. Choose a matching section or batch.`,
      };
    }
  }
  if (!sectionRow) {
    return { ok: false, message: "Choose a section from the list. Create the section first if it doesn't exist." };
  }
  // An uploaded photo follows the student if the roll number changes.
  if (data.photoUrl?.startsWith(PHOTO_PATH) && originalRollNo && originalRollNo !== data.rollNo) {
    data.photoUrl = photoUrlFor(data.rollNo);
  }
  if (data.photoUrl && !data.photoUrl.startsWith(PHOTO_PATH) && !/^https?:\/\//i.test(data.photoUrl)) {
    return { ok: false, message: "Photo URL must start with http:// or https://" };
  }

  try {
    if (originalRollNo) {
      await prisma.student.update({ where: { rollNo: originalRollNo }, data });
    } else {
      await prisma.student.create({ data });
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, message: `Roll number ${data.rollNo} is already in use.` };
    }
    throw e;
  }

  if (originalRollNo && originalRollNo !== data.rollNo) {
    redirect(`/students/${encodeURIComponent(data.rollNo)}`);
  }
  refresh();
  return { ok: true, message: originalRollNo ? "Student updated." : `Added ${data.fullName}.` };
}

/* ---------- Sections ---------- */

const YEARS: StudyYear[] = ["FIRST", "SECOND"];

function sectionInput(fd: FormData) {
  const name = String(fd.get("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 20);
  const y = String(fd.get("year") ?? "");
  const shift = fd.get("shift") === "EVENING" ? ("EVENING" as const) : ("MORNING" as const);
  return { name, year: YEARS.includes(y as StudyYear) ? (y as StudyYear) : null, shift };
}

export async function createSection(_: StudentFormState, fd: FormData): Promise<StudentFormState> {
  await requireUser(["ADMIN"]);
  const { name, year, shift } = sectionInput(fd);
  if (!name) return { ok: false, message: "Enter the section name, e.g. CD1." };
  if (!year) return { ok: false, message: "Choose the year (1st or 2nd)." };
  try {
    await prisma.section.create({ data: { name, year, shift } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, message: `Section ${name} already exists.` };
    throw e;
  }
  refresh();
  return { ok: true, message: `Added section ${name}.` };
}

/** Renames a section (moving its students with it) and/or changes its year. */
export async function updateSection(id: number, fd: FormData): Promise<StudentFormState> {
  await requireUser(["ADMIN"]);
  const { name, year, shift } = sectionInput(fd);
  const current = await prisma.section.findUnique({ where: { id } });
  if (!current) return { ok: false, message: "Section not found." };
  if (!name) return { ok: false, message: "Enter the section name." };
  try {
    await prisma.$transaction([
      prisma.section.update({ where: { id }, data: { name, year, shift } }),
      ...(name !== current.name ? [prisma.student.updateMany({ where: { section: current.name }, data: { section: name } })] : []),
    ]);
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, message: `Section ${name} already exists.` };
    throw e;
  }
  if (name !== current.name) redirect(`/students?section=${encodeURIComponent(name)}`);
  refresh();
  return { ok: true, message: "Section updated." };
}

export async function deleteSection(id: number): Promise<StudentFormState> {
  await requireUser(["ADMIN"]);
  const section = await prisma.section.findUnique({ where: { id } });
  if (!section) return { ok: false, message: "Section not found." };
  const students = await prisma.student.count({ where: { section: section.name } });
  if (students > 0) return { ok: false, message: `${students} students are in ${section.name}. Move them first.` };
  await prisma.section.delete({ where: { id } });
  redirect("/students");
}

/* ---------- Programs ---------- */

export async function createProgram(_: StudentFormState, fd: FormData): Promise<StudentFormState> {
  await requireUser(["ADMIN"]);
  const name = String(fd.get("name") ?? "").trim().replace(/\s+/g, " ").slice(0, 50);
  if (!name) return { ok: false, message: "Enter the program name." };
  try {
    await prisma.program.create({ data: { name } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, message: `${name} already exists.` };
    throw e;
  }
  refresh();
  return { ok: true, message: `Added ${name}.` };
}

export async function deleteProgram(id: number): Promise<StudentFormState> {
  await requireUser(["ADMIN"]);
  const program = await prisma.program.findUnique({ where: { id } });
  if (!program) return { ok: false, message: "Program not found." };
  const students = await prisma.student.count({ where: { program: program.name } });
  if (students > 0) return { ok: false, message: `${students} students are in ${program.name}.` };
  await prisma.program.delete({ where: { id } });
  refresh();
  return { ok: true };
}

/* ---------- Photos ---------- */

const PHOTO_PATH = "/api/student-photo/";
const photoUrlFor = (rollNo: string) => `${PHOTO_PATH}${encodeURIComponent(rollNo)}?v=${Date.now().toString(36)}`;

/** Saves a photo taken or chosen on the device (already resized to a small JPEG in the browser). */
export async function uploadStudentPhoto(rollNo: string, formData: FormData): Promise<StudentFormState> {
  await requireUser(["ADMIN"]);
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return { ok: false, message: "Choose a photo." };
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) return { ok: false, message: "Use a JPG or PNG photo." };
  if (file.size > 1024 * 1024) return { ok: false, message: "The photo is too large (over 1 MB)." };
  if (!(await prisma.student.findUnique({ where: { rollNo }, select: { rollNo: true } }))) return { ok: false, message: "Student not found." };
  const data = new Uint8Array(await file.arrayBuffer());
  await prisma.$transaction([
    prisma.studentPhoto.upsert({ where: { rollNo }, create: { rollNo, mimeType: file.type, data }, update: { mimeType: file.type, data } }),
    prisma.student.update({ where: { rollNo }, data: { photoUrl: photoUrlFor(rollNo) } }),
  ]);
  refresh();
  return { ok: true, message: "Photo saved." };
}

export async function removeStudentPhoto(rollNo: string): Promise<StudentFormState> {
  await requireUser(["ADMIN"]);
  await prisma.$transaction([
    prisma.studentPhoto.deleteMany({ where: { rollNo } }),
    prisma.student.update({ where: { rollNo }, data: { photoUrl: null } }),
  ]);
  refresh();
  return { ok: true, message: "Photo removed." };
}
