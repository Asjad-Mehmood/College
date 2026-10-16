// Date/time helpers. Late records are keyed by the college-local calendar
// date, which can differ from the server's (UTC) date, so every "today" or
// "this month" calculation goes through the configured timezone.

const MS_PER_DAY = 86_400_000;

export type LocalParts = {
  /** YYYY-MM-DD in the college timezone */
  date: string;
  /** Minutes since local midnight */
  minutes: number;
};

export function localParts(instant: Date, timeZone: string): LocalParts {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** A YYYY-MM-DD string as the Date Prisma uses for `@db.Date` columns. */
export function toDbDate(ymd: string): Date {
  return new Date(`${ymd}T00:00:00.000Z`);
}

/** A `@db.Date` value back to YYYY-MM-DD. */
export function fromDbDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(ymd: string, days: number): string {
  return fromDbDate(new Date(toDbDate(ymd).getTime() + days * MS_PER_DAY));
}

export function monthStart(ymd: string): string {
  return `${ymd.slice(0, 7)}-01`;
}

export function nextMonthStart(ymd: string): string {
  const d = toDbDate(monthStart(ymd));
  d.setUTCMonth(d.getUTCMonth() + 1);
  return fromDbDate(d);
}

export function isValidYmd(value: string | undefined): value is string {
  return !!value && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(toDbDate(value).getTime());
}

/** "08:30" -> 510 */
export function parseHHMM(value: string): number {
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

/** 510 -> "08:30 AM" */
export function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60) % 24;
  const m = minutes % 60;
  const suffix = h < 12 ? "AM" : "PM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${String(h12).padStart(2, "0")}:${String(m).padStart(2, "0")} ${suffix}`;
}

export function formatTime(instant: Date, timeZone: string): string {
  return formatMinutes(localParts(instant, timeZone).minutes);
}

/** "2026-10-16" -> "16 Oct 2026" */
export function formatDate(ymd: string, opts: { weekday?: boolean } = {}): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
    year: "numeric",
    weekday: opts.weekday ? "short" : undefined,
  }).format(toDbDate(ymd));
}

/** "2026-10-16" -> "October 2026" */
export function formatMonth(ymd: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    month: "long",
    year: "numeric",
  }).format(toDbDate(ymd));
}

/** "2026-10" style month keys. */
export function isValidMonth(value: string | undefined): value is string {
  return !!value && /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function addMonths(month: string, n: number): string {
  const d = toDbDate(`${month}-01`);
  d.setUTCMonth(d.getUTCMonth() + n);
  return fromDbDate(d).slice(0, 7);
}

/**
 * The days of a month laid out Monday-first for a calendar grid; null cells
 * pad the first and last weeks.
 */
export function monthGrid(month: string): (string | null)[] {
  const first = toDbDate(`${month}-01`);
  const lead = (first.getUTCDay() + 6) % 7;
  const days: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let ymd = `${month}-01`; ymd.startsWith(month); ymd = addDays(ymd, 1)) days.push(ymd);
  while (days.length % 7) days.push(null);
  return days;
}
