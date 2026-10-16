import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { CardStatus, DisciplineAction, LateReason } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import type { Settings } from "@/lib/settings";
import { addDays, fromDbDate, isValidYmd, localParts, monthStart } from "@/lib/time";

export const RANGES = [
  { value: "today", label: "Today" },
  { value: "yesterday", label: "Yesterday" },
  { value: "7d", label: "Last 7 days" },
  { value: "month", label: "This month" },
  { value: "custom", label: "Custom range" },
  { value: "all", label: "All time" },
] as const;

export type RangeKey = (typeof RANGES)[number]["value"];
export type StrikeFilter = "low" | "habitual" | "critical";

export type RecordFilters = {
  q: string;
  range: RangeKey;
  from: string;
  to: string;
  program: string;
  section: string;
  strike: StrikeFilter | "";
  card: "held" | "";
  fines: "unpaid" | "";
  habitual: boolean;
  page: number;
};

export const PAGE_SIZE = 50;

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string) {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export function parseRecordFilters(params: Params): RecordFilters {
  const range = one(params, "range");
  const strike = one(params, "strike");
  return {
    q: one(params, "q").slice(0, 100),
    range: RANGES.some((r) => r.value === range) ? (range as RangeKey) : "month",
    from: one(params, "from"),
    to: one(params, "to"),
    program: one(params, "program"),
    section: one(params, "section"),
    strike: strike === "low" || strike === "habitual" || strike === "critical" ? strike : "",
    card: one(params, "card") === "held" ? "held" : "",
    fines: one(params, "fines") === "unpaid" ? "unpaid" : "",
    habitual: one(params, "habitual") === "1",
    page: Math.max(1, Number.parseInt(one(params, "page"), 10) || 1),
  };
}

/** Filters back to a query string (without page unless asked). */
export function filtersToQuery(f: RecordFilters, overrides: Partial<RecordFilters> = {}) {
  const merged = { ...f, ...overrides };
  const qs = new URLSearchParams();
  if (merged.q) qs.set("q", merged.q);
  if (merged.range !== "month") qs.set("range", merged.range);
  if (merged.range === "custom") {
    if (merged.from) qs.set("from", merged.from);
    if (merged.to) qs.set("to", merged.to);
  }
  if (merged.program) qs.set("program", merged.program);
  if (merged.section) qs.set("section", merged.section);
  if (merged.strike) qs.set("strike", merged.strike);
  if (merged.card) qs.set("card", merged.card);
  if (merged.fines) qs.set("fines", merged.fines);
  if (merged.habitual) qs.set("habitual", "1");
  if (merged.page > 1) qs.set("page", String(merged.page));
  return qs.toString();
}

/** Inclusive YYYY-MM-DD bounds for the selected range; undefined = unbounded. */
export function resolveRange(f: RecordFilters, timeZone: string): { from?: string; to?: string } {
  const today = localParts(new Date(), timeZone).date;
  switch (f.range) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y };
    }
    case "7d":
      return { from: addDays(today, -6), to: today };
    case "month":
      return { from: monthStart(today), to: today };
    case "custom":
      return {
        from: isValidYmd(f.from) ? f.from : undefined,
        to: isValidYmd(f.to) ? f.to : undefined,
      };
    case "all":
      return {};
  }
}

export type LedgerRow = {
  id: number;
  rollNo: string;
  fullName: string;
  fatherName: string;
  program: string;
  section: string;
  photoUrl: string | null;
  parentPhone: string;
  lateDate: string;
  arrivedAt: Date;
  minutesLate: number;
  reason: LateReason;
  actionTaken: DisciplineAction;
  cardStatus: CardStatus;
  fineAmount: number;
  finePaid: boolean;
  remarks: string | null;
  /** Nth late arrival of that student in that calendar month */
  strikeNo: number;
  /** Total lates of that student in that calendar month */
  monthCount: number;
  recordedBy: string;
};

type RawRow = Omit<LedgerRow, "lateDate" | "fineAmount" | "strikeNo" | "monthCount"> & {
  lateDate: Date;
  fineAmount: Prisma.Decimal;
  strikeNo: bigint;
  monthCount: bigint;
  totalCount: bigint;
};

export async function queryLedger(
  f: RecordFilters,
  settings: Settings,
  opts: { limit?: number; offset?: number } = {},
): Promise<{ rows: LedgerRow[]; total: number; range: { from?: string; to?: string } }> {
  const range = resolveRange(f, settings.timezone);

  // Strike numbers must count every record in the month, not just the
  // filtered ones, so the window runs over whole months around the range.
  const scope: Prisma.Sql[] = [];
  if (range.from) scope.push(Prisma.sql`r.late_date >= date_trunc('month', ${range.from}::date)`);
  if (range.to) scope.push(Prisma.sql`r.late_date <= ${range.to}::date`);

  const where: Prisma.Sql[] = [];
  if (range.from) where.push(Prisma.sql`c.late_date >= ${range.from}::date`);
  if (range.to) where.push(Prisma.sql`c.late_date <= ${range.to}::date`);
  if (f.q) {
    const like = `%${f.q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const digits = f.q.replace(/\D/g, "");
    where.push(Prisma.sql`(
      s.roll_no ILIKE ${like} OR s.full_name ILIKE ${like} OR s.father_name ILIKE ${like}
      ${digits.length >= 4 ? Prisma.sql`OR regexp_replace(s.parent_phone, '\\D', '', 'g') LIKE ${`%${digits}%`} OR regexp_replace(coalesce(s.student_phone, ''), '\\D', '', 'g') LIKE ${`%${digits}%`}` : Prisma.empty}
    )`);
  }
  if (f.program) where.push(Prisma.sql`s.program = ${f.program}`);
  if (f.section) where.push(Prisma.sql`s.section = ${f.section}`);
  if (f.strike === "low") where.push(Prisma.sql`c.strike_no < ${settings.habitualThreshold}`);
  if (f.strike === "habitual")
    where.push(Prisma.sql`c.strike_no >= ${settings.habitualThreshold} AND c.strike_no < ${settings.criticalThreshold}`);
  if (f.strike === "critical") where.push(Prisma.sql`c.strike_no >= ${settings.criticalThreshold}`);
  if (f.habitual) where.push(Prisma.sql`c.month_count >= ${settings.habitualThreshold}`);
  if (f.card === "held") where.push(Prisma.sql`c.id_card_status = 'HELD'`);
  if (f.fines === "unpaid") where.push(Prisma.sql`c.fine_amount > 0 AND NOT c.fine_paid`);

  const limit = opts.limit ?? PAGE_SIZE;
  const offset = opts.offset ?? 0;

  const raw = await prisma.$queryRaw<RawRow[]>`
    WITH c AS (
      SELECT r.*,
        ROW_NUMBER() OVER (PARTITION BY r.roll_no, date_trunc('month', r.late_date) ORDER BY r.late_date, r.arrived_at) AS strike_no,
        COUNT(*) OVER (PARTITION BY r.roll_no, date_trunc('month', r.late_date)) AS month_count
      FROM late_records r
      ${scope.length ? Prisma.sql`WHERE ${Prisma.join(scope, " AND ")}` : Prisma.empty}
    )
    SELECT
      c.id, c.roll_no AS "rollNo", s.full_name AS "fullName", s.father_name AS "fatherName",
      s.program, s.section, s.photo_url AS "photoUrl", s.parent_phone AS "parentPhone",
      c.late_date AS "lateDate", c.arrived_at AS "arrivedAt", c.minutes_late AS "minutesLate",
      c.reason::text AS reason, c.action_taken::text AS "actionTaken", c.id_card_status::text AS "cardStatus",
      c.fine_amount AS "fineAmount", c.fine_paid AS "finePaid", c.remarks,
      c.strike_no AS "strikeNo", c.month_count AS "monthCount",
      u.full_name AS "recordedBy",
      COUNT(*) OVER () AS "totalCount"
    FROM c
    JOIN students s ON s.roll_no = c.roll_no
    JOIN users u ON u.id = c.recorded_by
    ${where.length ? Prisma.sql`WHERE ${Prisma.join(where, " AND ")}` : Prisma.empty}
    ORDER BY c.late_date DESC, c.arrived_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `;

  const total = raw.length ? Number(raw[0].totalCount) : 0;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- dropped from each row
  const rows = raw.map(({ totalCount, ...r }) => ({
    ...r,
    lateDate: fromDbDate(r.lateDate),
    fineAmount: Number(r.fineAmount),
    strikeNo: Number(r.strikeNo),
    monthCount: Number(r.monthCount),
  }));
  return { rows, total, range };
}

/** Distinct programs and sections for filter dropdowns. */
export async function getClassOptions() {
  const rows = await prisma.student.findMany({
    distinct: ["program", "section"],
    select: { program: true, section: true },
    orderBy: [{ program: "asc" }, { section: "asc" }],
  });
  const programs = [...new Set(rows.map((r) => r.program))];
  const sections = [...new Set(rows.map((r) => r.section))].sort();
  return { programs, sections };
}
