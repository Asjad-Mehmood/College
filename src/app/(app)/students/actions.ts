"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import type { StudentStatus } from "@/generated/prisma/enums";
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
