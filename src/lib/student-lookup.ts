import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Turns what was typed into a roll number: an exact match wins; otherwise a
 * short entry such as "114" picks the one active student whose roll number
 * ends with it (e.g. 24-PE-114). When several match it returns null, so the
 * caller shows the suggestion list instead.
 */
export async function resolveRoll(raw: string): Promise<string | null> {
  const q = raw.trim().replace(/\s+/g, "");
  if (!q) return null;
  const exact = await prisma.student.findFirst({ where: { rollNo: { equals: q, mode: "insensitive" } }, select: { rollNo: true } });
  if (exact) return exact.rollNo;
  const ends = await prisma.student.findMany({
    where: { rollNo: { endsWith: q, mode: "insensitive" }, status: "ACTIVE" },
    select: { rollNo: true },
    take: 2,
  });
  return ends.length === 1 ? ends[0].rollNo : null;
}
