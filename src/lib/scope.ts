import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { fromDbDate, localParts, toDbDate } from "@/lib/time";

export const SCOPE_COOKIE = "cp_scope";

export type YearInfo = { id: number; name: string; from: string; to: string; closed: boolean };
export type BatchInfo = { id: number; name: string; startYear: number; endYear: number; passedOut: boolean; students: number };

export type Scope = {
  year: YearInfo;
  /** null = all batches */
  batch: BatchInfo | null;
  years: YearInfo[];
  batches: BatchInfo[];
  /** Today, or the last day of the selected year when it is in the past. */
  anchor: string;
  /** True while the user hasn't picked a year and batch yet. */
  unset: boolean;
};

/** Academic years run 1 August – 31 July. */
function yearFor(ymd: string) {
  const y = Number(ymd.slice(0, 4));
  const start = Number(ymd.slice(5, 7)) >= 8 ? y : y - 1;
  return { name: `${start}–${String(start + 1).slice(2)}`, from: `${start}-08-01`, to: `${start + 1}-07-31`, start };
}

/**
 * First run: create the academic year(s) covering existing records and
 * today, and put existing students into batches by their section's year.
 */
async function ensureDefaults(today: string) {
  if ((await prisma.academicYear.count()) === 0) {
    const [late, viol] = await Promise.all([
      prisma.lateRecord.findFirst({ orderBy: { lateDate: "asc" }, select: { lateDate: true } }),
      prisma.violation.findFirst({ orderBy: { incidentDate: "asc" }, select: { incidentDate: true } }),
    ]);
    const earliest = [late && fromDbDate(late.lateDate), viol && fromDbDate(viol.incidentDate), today].filter(Boolean).sort()[0] as string;
    const first = yearFor(earliest).start;
    const last = yearFor(today).start;
    for (let y = first; y <= last; y++) {
      const info = yearFor(`${y}-08-01`);
      await prisma.academicYear.createMany({
        data: [{ name: info.name, startDate: toDbDate(info.from), endDate: toDbDate(info.to) }],
        skipDuplicates: true,
      });
    }
  }
  if ((await prisma.batch.count()) === 0 && (await prisma.student.count()) > 0) {
    const cur = yearFor(today).start;
    const newer = await prisma.batch.create({ data: { name: `Batch ${cur}–${String(cur + 2).slice(2)}`, startYear: cur, endYear: cur + 2 } });
    const older = await prisma.batch.create({ data: { name: `Batch ${cur - 1}–${String(cur + 1).slice(2)}`, startYear: cur - 1, endYear: cur + 1 } });
    const second = (await prisma.section.findMany({ where: { year: "SECOND" }, select: { name: true } })).map((s) => s.name);
    await prisma.$transaction([
      prisma.student.updateMany({ where: { section: { in: second }, batchId: null }, data: { batchId: older.id } }),
      prisma.student.updateMany({ where: { batchId: null }, data: { batchId: newer.id } }),
    ]);
  }
}

export const getScope = cache(async (): Promise<Scope> => {
  const settings = await getSettings();
  const today = localParts(new Date(), settings.timezone).date;
  await ensureDefaults(today);
  const [yearRows, batchRows, counts] = await Promise.all([
    prisma.academicYear.findMany({ orderBy: { startDate: "desc" } }),
    prisma.batch.findMany({ orderBy: [{ startYear: "desc" }, { name: "asc" }] }),
    prisma.student.groupBy({ by: ["batchId"], _count: { _all: true } }),
  ]);
  const years: YearInfo[] = yearRows.map((y) => ({ id: y.id, name: y.name, from: fromDbDate(y.startDate), to: fromDbDate(y.endDate), closed: y.closed }));
  const countBy = new Map(counts.map((c) => [c.batchId, c._count._all]));
  const batches: BatchInfo[] = batchRows.map((b) => ({
    id: b.id,
    name: b.name,
    startYear: b.startYear,
    endYear: b.endYear,
    passedOut: b.passedOut,
    students: countBy.get(b.id) ?? 0,
  }));

  const raw = (await cookies()).get(SCOPE_COOKIE)?.value ?? "";
  const [yearId, batchId] = raw.split(".").map(Number);
  const current = years.find((y) => y.from <= today && today <= y.to) ?? years[0];
  const year = years.find((y) => y.id === yearId) ?? current;
  const batch = batches.find((b) => b.id === batchId) ?? null;
  return {
    year,
    batch,
    years,
    batches,
    anchor: year.to < today ? year.to : today,
    unset: !raw,
  };
});

/** Batch for new students: the selected one, else the newest batch still studying. */
export async function defaultBatchId() {
  const s = await getScope();
  return s.batch?.id ?? s.batches.find((b) => !b.passedOut)?.id ?? null;
}

/** Label for the sidebar, e.g. "2026–27 · Batch 2026–28". */
export function scopeLabel(s: Scope) {
  return `${s.year.name} · ${s.batch ? s.batch.name : "All batches"}`;
}

/**
 * A database client that only sees the selected academic year and batch:
 * students are limited to the batch; late arrivals, violations, trips,
 * sports events and trials to the year (and batch). Unique lookups
 * (findUnique) are not filtered. The gate and other actions keep using
 * the plain client.
 */
export async function scoped() {
  const s = await getScope();
  const from = toDbDate(s.year.from);
  const to = toDbDate(s.year.to);
  const studentWhere = s.batch ? { batchId: s.batch.id } : {};
  const add = (args: { where?: unknown }, extra: object) => ({ ...args, where: args.where ? { AND: [args.where, extra] } : extra });
  const ops = ["findMany", "findFirst", "count", "groupBy", "aggregate"] as const;
  type Q = { args: { where?: unknown }; query: (a: unknown) => Promise<unknown> };
  const filtered = (extra: object) =>
    Object.fromEntries(ops.map((op) => [op, ({ args, query }: Q) => query(add(args, extra))])) as Record<(typeof ops)[number], (q: Q) => Promise<unknown>>;

  return prisma.$extends({
    query: {
      student: filtered(studentWhere),
      lateRecord: filtered({ lateDate: { gte: from, lte: to }, ...(s.batch ? { student: studentWhere } : {}) }),
      violation: filtered({ incidentDate: { gte: from, lte: to }, ...(s.batch ? { student: studentWhere } : {}) }),
      trip: filtered({ departDate: { gte: from, lte: to } }),
      sportsEvent: filtered({ startDate: { gte: from, lte: to } }),
      trial: filtered({ trialDate: { gte: from, lte: to } }),
    },
  });
}

/** Raw SQL condition limiting a students alias to the selected batch (empty for all batches). */
export async function batchSql(alias: string) {
  const s = await getScope();
  return s.batch ? Prisma.sql`AND ${Prisma.raw(alias)}.batch_id = ${s.batch.id}` : Prisma.empty;
}

/** SQL fragments for raw queries: the year's dates and (optional) batch. */
export async function scopeSql() {
  const s = await getScope();
  return { from: toDbDate(s.year.from), to: toDbDate(s.year.to), batchId: s.batch?.id ?? null, scope: s };
}

/** Throws if the date falls in a closed (archived) year. */
export async function assertOpenDate(ymd: string) {
  const y = await prisma.academicYear.findFirst({ where: { startDate: { lte: toDbDate(ymd) }, endDate: { gte: toDbDate(ymd) } } });
  if (y?.closed) throw new Error(`The ${y.name} year is closed (archived). Reopen it in Settings to make changes.`);
}

/** Like assertOpenDate, but returns a message instead of throwing. */
export async function closedYearMessage(ymd: string): Promise<string | null> {
  try {
    await assertOpenDate(ymd);
    return null;
  } catch (e) {
    return (e as Error).message;
  }
}
