import "server-only";
import { prisma } from "@/lib/prisma";
import { compareSections } from "@/lib/sections";

export const YEAR_LABELS = { FIRST: "1st year", SECOND: "2nd year" } as const;

export type SectionOption = { id: number; name: string; year: "FIRST" | "SECOND" | null; shift: "MORNING" | "EVENING" };

/** All sections in natural order (CD1 … CD10, CD 54). */
export async function getSectionOptions(): Promise<SectionOption[]> {
  const rows = await prisma.section.findMany({ select: { id: true, name: true, year: true, shift: true } });
  return rows.sort((a, b) => compareSections(a.name, b.name));
}
