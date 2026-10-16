import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDate, fromDbDate } from "@/lib/time";

/** Open severe violations that need a written reason before a student joins a squad. */
export async function openSevereWarnings(rollNo: string) {
  const severe = await prisma.violation.findMany({
    where: { rollNo, status: "OPEN", severity: "SEVERE" },
    include: { type: { select: { name: true } } },
  });
  return severe.map((v) => `Open severe violation: ${v.type.name} (${formatDate(fromDbDate(v.incidentDate))}, case #${v.id}).`);
}

export const ROLES = ["Captain", "Vice-captain", "Player"] as const;
