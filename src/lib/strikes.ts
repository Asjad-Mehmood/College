export type StrikeLevel = "good" | "warning" | "serious" | "critical";

type Thresholds = { habitualThreshold: number; criticalThreshold: number };

/**
 * Escalation level for a student's monthly late count:
 * below the warning step → good, one short of habitual → warning,
 * habitual threshold → serious (habitual offender), critical threshold → critical.
 */
export function strikeLevel(count: number, t: Thresholds): StrikeLevel {
  if (count >= t.criticalThreshold) return "critical";
  if (count >= t.habitualThreshold) return "serious";
  if (count >= t.habitualThreshold - 1 && count > 1) return "warning";
  return "good";
}

export const STRIKE_LABELS: Record<StrikeLevel, string> = {
  good: "On record",
  warning: "Warning",
  serious: "Habitual offender",
  critical: "Critical",
};

/** What the escalation engine recommends at each level. */
export const STRIKE_GUIDANCE: Record<StrikeLevel, string> = {
  good: "Record with a verbal warning.",
  warning: "Verbal warning — next late makes the student a habitual offender.",
  serious: "Habitual offender: confiscate the ID card or issue a written warning.",
  critical: "Critical: impose a fine, detention, or call parents to the Discipline Committee.",
};

export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
