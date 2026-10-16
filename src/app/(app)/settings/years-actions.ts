"use server";

import { refresh } from "next/cache";
import { Prisma } from "@/generated/prisma/client";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { isValidYmd, toDbDate } from "@/lib/time";

export type YearsState = { ok?: boolean; message?: string } | null;

export async function createYear(_: YearsState, fd: FormData): Promise<YearsState> {
  await requireUser(["ADMIN"]);
  const from = String(fd.get("from") ?? "");
  const to = String(fd.get("to") ?? "");
  if (!isValidYmd(from) || !isValidYmd(to) || to <= from) return { ok: false, message: "Enter a start date and a later end date." };
  const overlap = await prisma.academicYear.findFirst({ where: { startDate: { lte: toDbDate(to) }, endDate: { gte: toDbDate(from) } } });
  if (overlap) return { ok: false, message: `These dates overlap ${overlap.name}.` };
  const name = String(fd.get("name") ?? "").trim() || `${from.slice(0, 4)}–${to.slice(2, 4)}`;
  try {
    await prisma.academicYear.create({ data: { name: name.slice(0, 20), startDate: toDbDate(from), endDate: toDbDate(to) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, message: `${name} already exists.` };
    throw e;
  }
  refresh();
  return { ok: true, message: `Added academic year ${name}.` };
}

export async function setYearClosed(id: number, closed: boolean) {
  await requireUser(["ADMIN"]);
  await prisma.academicYear.update({ where: { id }, data: { closed } });
  refresh();
}

export async function createBatch(_: YearsState, fd: FormData): Promise<YearsState> {
  await requireUser(["ADMIN"]);
  const start = Number(fd.get("startYear"));
  if (!Number.isInteger(start) || start < 2000 || start > 2100) return { ok: false, message: "Enter the year the batch joined, e.g. 2026." };
  const end = start + 2;
  const name = `Batch ${start}–${String(end).slice(2)}`;
  try {
    await prisma.batch.create({ data: { name, startYear: start, endYear: end } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, message: `${name} already exists.` };
    throw e;
  }
  refresh();
  return { ok: true, message: `Added ${name}.` };
}

/** A batch passes out: its active students are marked Graduated (and back again when undone). */
export async function setBatchPassedOut(id: number, passedOut: boolean) {
  await requireUser(["ADMIN"]);
  await prisma.$transaction([
    prisma.batch.update({ where: { id }, data: { passedOut } }),
    prisma.student.updateMany({
      where: { batchId: id, status: passedOut ? "ACTIVE" : "GRADUATED" },
      data: { status: passedOut ? "GRADUATED" : "ACTIVE" },
    }),
  ]);
  refresh();
}

export async function deleteBatch(id: number): Promise<YearsState> {
  await requireUser(["ADMIN"]);
  if (await prisma.student.count({ where: { batchId: id } })) return { ok: false, message: "Move or remove its students first." };
  await prisma.batch.delete({ where: { id } });
  refresh();
  return { ok: true };
}
