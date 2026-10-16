"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import type { StudentStatus, StudyYear } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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
  };

  if (!data.rollNo || !data.fullName || !data.fatherName || !data.program || !data.section || !data.parentPhone) {
    return { ok: false, message: "Fill in every required field." };
  }
  if (data.rollNo.length > 20) return { ok: false, message: "Roll number must be 20 characters or fewer." };
  if (!(await prisma.program.findUnique({ where: { name: data.program } }))) {
    return { ok: false, message: "Choose a program from the list." };
  }
  if (!(await prisma.section.findUnique({ where: { name: data.section } }))) {
    return { ok: false, message: "Choose a section from the list. Create the section first if it doesn't exist." };
  }
  if (data.photoUrl && !/^https?:\/\//i.test(data.photoUrl)) {
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
  return { name, year: YEARS.includes(y as StudyYear) ? (y as StudyYear) : null };
}

export async function createSection(_: StudentFormState, fd: FormData): Promise<StudentFormState> {
  await requireUser(["ADMIN"]);
  const { name, year } = sectionInput(fd);
  if (!name) return { ok: false, message: "Enter the section name, e.g. CD1." };
  if (!year) return { ok: false, message: "Choose the year (1st or 2nd)." };
  try {
    await prisma.section.create({ data: { name, year } });
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
  const { name, year } = sectionInput(fd);
  const current = await prisma.section.findUnique({ where: { id } });
  if (!current) return { ok: false, message: "Section not found." };
  if (!name) return { ok: false, message: "Enter the section name." };
  try {
    await prisma.$transaction([
      prisma.section.update({ where: { id }, data: { name, year } }),
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
