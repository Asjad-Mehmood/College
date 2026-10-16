import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type { CaseStatus, Severity } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";
import { RANGES, resolveDateRange, type RangeKey } from "@/lib/records";
import type { Settings } from "@/lib/settings";
import { toDbDate } from "@/lib/time";

export type ViolationFilters = {
  q: string;
  range: RangeKey;
  from: string;
  to: string;
  type: number | null;
  severity: Severity | "";
  status: CaseStatus | "";
  program: string;
  section: string;
  fines: "unpaid" | "";
  page: number;
};

export const VIOLATION_PAGE_SIZE = 50;

type Params = Record<string, string | string[] | undefined>;

function one(params: Params, key: string) {
  const v = params[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() ?? "";
}

export function parseViolationFilters(params: Params): ViolationFilters {
  const range = one(params, "range");
  const severity = one(params, "severity");
  const status = one(params, "status");
  const type = Number.parseInt(one(params, "type"), 10);
  return {
    q: one(params, "q").slice(0, 100),
    range: RANGES.some((r) => r.value === range) ? (range as RangeKey) : "all",
    from: one(params, "from"),
    to: one(params, "to"),
    type: Number.isInteger(type) ? type : null,
    severity: severity === "MINOR" || severity === "MAJOR" || severity === "SEVERE" ? severity : "",
    status: status === "OPEN" || status === "CLOSED" ? status : "",
    program: one(params, "program"),
    section: one(params, "section"),
    fines: one(params, "fines") === "unpaid" ? "unpaid" : "",
    page: Math.max(1, Number.parseInt(one(params, "page"), 10) || 1),
  };
}

export function violationFiltersToQuery(f: ViolationFilters, overrides: Partial<ViolationFilters> = {}) {
  const m = { ...f, ...overrides };
  const qs = new URLSearchParams();
  if (m.q) qs.set("q", m.q);
  if (m.range !== "all") qs.set("range", m.range);
  if (m.range === "custom") {
    if (m.from) qs.set("from", m.from);
    if (m.to) qs.set("to", m.to);
  }
  if (m.type) qs.set("type", String(m.type));
  if (m.severity) qs.set("severity", m.severity);
  if (m.status) qs.set("status", m.status);
  if (m.program) qs.set("program", m.program);
  if (m.section) qs.set("section", m.section);
  if (m.fines) qs.set("fines", m.fines);
  if (m.page > 1) qs.set("page", String(m.page));
  return qs.toString();
}

export function violationWhere(f: ViolationFilters, settings: Settings) {
  const range = resolveDateRange(f, settings.timezone);
  const digits = f.q.replace(/\D/g, "");
  const where: Prisma.ViolationWhereInput = {
    ...((range.from || range.to) && {
      incidentDate: {
        ...(range.from && { gte: toDbDate(range.from) }),
        ...(range.to && { lte: toDbDate(range.to) }),
      },
    }),
    ...(f.type && { typeId: f.type }),
    ...(f.severity && { severity: f.severity }),
    ...(f.status && { status: f.status }),
    ...(f.fines && { fineAmount: { gt: 0 }, finePaid: false }),
    student: {
      ...(f.program && { program: f.program }),
      ...(f.section && { section: f.section }),
      ...(f.q && {
        OR: [
          { rollNo: { contains: f.q, mode: "insensitive" } },
          { fullName: { contains: f.q, mode: "insensitive" } },
          { fatherName: { contains: f.q, mode: "insensitive" } },
          ...(digits.length >= 4 ? [{ parentPhone: { contains: digits } }] : []),
        ],
      }),
    },
  };
  return { where, range };
}

export async function queryViolations(
  f: ViolationFilters,
  settings: Settings,
  opts: { limit?: number; offset?: number } = {},
) {
  const { where, range } = violationWhere(f, settings);
  const [rows, total] = await Promise.all([
    prisma.violation.findMany({
      where,
      orderBy: [{ incidentDate: "desc" }, { createdAt: "desc" }],
      skip: opts.offset ?? 0,
      take: opts.limit ?? VIOLATION_PAGE_SIZE,
      include: {
        student: { select: { fullName: true, fatherName: true, program: true, section: true, photoUrl: true, parentPhone: true } },
        type: { select: { name: true } },
        recordedBy: { select: { fullName: true } },
      },
    }),
    prisma.violation.count({ where }),
  ]);
  // How many violations each listed student has in total (repeat offenders).
  const counts = rows.length
    ? await prisma.violation.groupBy({
        by: ["rollNo"],
        where: { rollNo: { in: [...new Set(rows.map((r) => r.rollNo))] } },
        _count: { _all: true },
      })
    : [];
  const totalByRoll = new Map(counts.map((c) => [c.rollNo, c._count._all]));
  return {
    rows: rows.map((r) => ({ ...r, fineAmount: Number(r.fineAmount), studentTotal: totalByRoll.get(r.rollNo) ?? 1 })),
    total,
    range,
  };
}

export async function getViolationTypes(opts: { activeOnly?: boolean } = {}) {
  const types = await prisma.violationType.findMany({
    where: opts.activeOnly ? { active: true } : undefined,
    orderBy: [{ active: "desc" }, { severity: "asc" }, { name: "asc" }],
  });
  return types.map((t) => ({ ...t, defaultFineAmount: Number(t.defaultFineAmount) }));
}

export function violationParentMessage(args: {
  studentName: string;
  rollNo: string;
  className: string;
  typeName: string;
  date: string;
  action: string;
  fineAmount: number;
  collegeName: string;
}) {
  return (
    `Respected Parent, your ward ${args.studentName} (Roll No: ${args.rollNo}, ${args.className}) ` +
    `was found involved in a discipline violation (${args.typeName}) on ${args.date}. ` +
    `Action taken: ${args.action}${args.fineAmount > 0 ? `, fine Rs. ${args.fineAmount}` : ""}. ` +
    `Please contact the Discipline Office. – Discipline In-Charge, ${args.collegeName}`
  );
}
