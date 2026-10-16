"use server";

import { refresh } from "next/cache";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export type PromoteState = { ok?: boolean; message?: string } | null;

/**
 * End of session: 2nd-year students graduate, 1st-year sections become
 * 2nd year, and (optionally) the emptied 2nd-year sections are reused as
 * 1st-year sections for the new intake.
 */
export async function promoteSession(_: PromoteState, fd: FormData): Promise<PromoteState> {
  await requireUser(["ADMIN"]);
  if (String(fd.get("confirm") ?? "").trim().toUpperCase() !== "PROMOTE") {
    return { ok: false, message: "Type PROMOTE to confirm." };
  }
  const recycle = fd.get("recycle") === "on";
  const [first, second] = await Promise.all([
    prisma.section.findMany({ where: { year: "FIRST" }, select: { id: true, name: true } }),
    prisma.section.findMany({ where: { year: "SECOND" }, select: { id: true, name: true } }),
  ]);
  if (first.length === 0 && second.length === 0) return { ok: false, message: "No sections have a year set." };

  const [graduated] = await prisma.$transaction([
    prisma.student.updateMany({ where: { section: { in: second.map((s) => s.name) }, status: "ACTIVE" }, data: { status: "GRADUATED" } }),
    prisma.section.updateMany({ where: { id: { in: first.map((s) => s.id) } }, data: { year: "SECOND" } }),
    prisma.section.updateMany({ where: { id: { in: second.map((s) => s.id) } }, data: { year: recycle ? "FIRST" : null } }),
  ]);
  refresh();
  return {
    ok: true,
    message: `Done: ${graduated.count} students graduated, ${first.length} sections moved to 2nd year${
      second.length ? `, ${second.length} sections ${recycle ? "ready for the new 1st year" : "left without a year"}` : ""
    }.`,
  };
}
