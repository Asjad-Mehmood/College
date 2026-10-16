import type {
  DisciplineAction,
  LateReason,
  Role,
  StudentStatus,
} from "@/generated/prisma/enums";

export const REASONS: { value: LateReason; label: string; key: string }[] = [
  { value: "TRANSPORT", label: "Transport delay", key: "1" },
  { value: "TRAFFIC", label: "Traffic", key: "2" },
  { value: "MEDICAL", label: "Medical", key: "3" },
  { value: "WEATHER", label: "Weather", key: "4" },
  { value: "NO_EXCUSE", label: "No valid excuse", key: "5" },
];

export const REASON_LABELS: Record<LateReason, string> = Object.fromEntries(
  REASONS.map((r) => [r.value, r.label]),
) as Record<LateReason, string>;

export const ACTION_LABELS: Record<DisciplineAction, string> = {
  VERBAL_WARNING: "Verbal warning",
  WRITTEN_WARNING: "Written warning",
  FINE: "Fine imposed",
  PARENT_CALLED: "Parent called",
  DETENTION: "Detention",
  PARENT_MEETING: "Parent meeting",
};

export const ROLE_LABELS: Record<Role, string> = {
  ADMIN: "Discipline In-Charge",
  GATE: "Gate staff",
  PRINCIPAL: "Principal (viewer)",
};

export const STUDENT_STATUS_LABELS: Record<StudentStatus, string> = {
  ACTIVE: "Active",
  STRUCK_OFF: "Struck off",
  GRADUATED: "Graduated",
};
