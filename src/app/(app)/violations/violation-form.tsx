"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle2,
  FileText,
  Loader2,
  MessageCircle,
  MessageSquareText,
  Plus,
  Printer,
  Search,
  TriangleAlert,
} from "lucide-react";
import type { Severity, ViolationAction } from "@/generated/prisma/enums";
import {
  Avatar,
  Button,
  Card,
  CardHeader,
  Field,
  Input,
  Select,
  StrikeBadge,
  Textarea,
  buttonClass,
  cx,
  inputClass,
} from "@/components/ui";
import { SEVERITY_LABELS, SEVERITY_LEVEL, VIOLATION_ACTION_LABELS } from "@/lib/labels";
import {
  createViolation,
  findStudentForViolation,
  updateViolation,
  type CreateResult,
  type ViolationInput,
  type ViolationStudent,
} from "./actions";

export type TypeOption = { id: number; name: string; severity: Severity; defaultFineAmount: number; active: boolean };

const LOCATIONS = ["Classroom", "Corridor", "Canteen", "Library", "Laboratory", "Ground", "Exam hall", "Main gate", "Hostel", "Bus"];
const SEVERITIES: Severity[] = ["MINOR", "MAJOR", "SEVERE"];

type Props =
  | { mode: "create"; types: TypeOption[]; today: string; initialRoll?: string }
  | {
      mode: "edit";
      types: TypeOption[];
      today: string;
      violationId: number;
      student: { rollNo: string; fullName: string; program: string; section: string; photoUrl: string | null };
      initial: ViolationInput;
    };

export function ViolationForm(props: Props) {
  const [student, setStudent] = useState<ViolationStudent | null>(null);
  const [saved, setSaved] = useState<Extract<CreateResult, { ok: true }> | null>(null);
  const [formKey, setFormKey] = useState(0);

  if (props.mode === "edit") {
    return (
      <DetailsForm
        types={props.types}
        today={props.today}
        initial={props.initial}
        header={<StudentStrip {...props.student} />}
        submitLabel="Save changes"
        cancelHref={`/violations/${props.violationId}`}
        onSubmit={async (input) => {
          const res = await updateViolation(props.violationId, input);
          return res.ok ? null : (res.error ?? "Couldn't save.");
        }}
      />
    );
  }

  if (saved && student) {
    return (
      <Card className="overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line bg-good/8 px-5 py-4">
          <CheckCircle2 className="size-6 text-good" aria-hidden />
          <div>
            <p className="font-semibold">Violation recorded</p>
            <p className="text-[13px] text-ink-2">
              {student.fullName} · case #{saved.id}
            </p>
          </div>
        </div>
        <div className="flex flex-col gap-4 p-5">
          {saved.notify && (
            <div className="rounded-xl border border-line bg-surface-2/60 p-4">
              <p className="text-[12px] font-medium tracking-wide text-muted uppercase">Message to parent</p>
              <p className="mt-1.5 text-sm leading-relaxed">{saved.notify.message}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={saved.notify.whatsapp} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1f8f4e] px-4 text-sm font-medium text-white hover:bg-[#1a7a43]">
                  <MessageCircle className="size-4" aria-hidden /> Send on WhatsApp
                </a>
                <a href={saved.notify.sms} className={buttonClass("secondary")}>
                  <MessageSquareText className="size-4" aria-hidden /> Send SMS
                </a>
              </div>
            </div>
          )}
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-between">
            <div className="flex flex-wrap gap-2">
              <a href={`/notice/${saved.id}`} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
                <Printer className="size-4" aria-hidden /> Print parent notice
              </a>
              <Link href={`/violations/${saved.id}`} className={buttonClass("secondary")}>
                <FileText className="size-4" aria-hidden /> Open case
              </Link>
            </div>
            <Button
              variant="primary"
              onClick={() => {
                setSaved(null);
                setStudent(null);
                setFormKey((k) => k + 1);
              }}
            >
              <Plus className="size-4" aria-hidden /> Record another
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <StudentLookup
        key={formKey}
        student={student}
        onFound={setStudent}
        initialRoll={formKey === 0 ? props.initialRoll : undefined}
      />
      {student && (
        <DetailsForm
          key={student.rollNo}
          types={props.types}
          today={props.today}
          submitLabel="Record violation"
          withNotify
          disabledReason={student.status !== "ACTIVE" ? "This student is not active (struck off or graduated)." : undefined}
          onSubmit={async (input) => {
            const res = await createViolation(student.rollNo, input);
            if (!res.ok) return res.error;
            setSaved(res);
            return null;
          }}
        />
      )}
    </div>
  );
}

function StudentLookup({
  student,
  onFound,
  initialRoll,
}: {
  student: ViolationStudent | null;
  onFound: (s: ViolationStudent | null) => void;
  initialRoll?: string;
}) {
  const [roll, setRoll] = useState(initialRoll ?? "");
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<{ rollNo: string; fullName: string; program: string; section: string }[]>([]);
  const [pending, start] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  // Opened from a student profile: look the student up straight away.
  const looked = useRef(false);
  useEffect(() => {
    if (initialRoll && !looked.current) {
      looked.current = true;
      find(initialRoll);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRoll]);

  function find(value: string) {
    if (!value.trim()) return;
    start(async () => {
      const res = await findStudentForViolation(value);
      if (res.ok) {
        setRoll(res.student.rollNo);
        setError(null);
        setSuggestions([]);
        onFound(res.student);
      } else {
        setError(res.error);
        setSuggestions(res.suggestions);
        onFound(null);
      }
    });
  }

  return (
    <Card>
      <CardHeader title="1. Student" description="Type the roll number or scan the ID card." />
      <div className="p-5">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            find(roll);
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4.5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              ref={inputRef}
              value={roll}
              onChange={(e) => setRoll(e.target.value)}
              autoFocus
              autoComplete="off"
              spellCheck={false}
              aria-label="Roll number"
              placeholder="Roll number"
              className={cx(inputClass, "h-12 pl-10 font-mono tracking-wide uppercase placeholder:font-sans placeholder:normal-case placeholder:tracking-normal")}
            />
          </div>
          <Button type="submit" variant="primary" disabled={pending || !roll.trim()} className="h-12 px-5">
            {pending ? <Loader2 className="size-4.5 animate-spin" aria-hidden /> : <ArrowRight className="size-4.5" aria-hidden />}
            Find
          </Button>
        </form>

        {error && (
          <div className="mt-4">
            <p className="flex items-center gap-2 text-sm text-danger-ink">
              <TriangleAlert className="size-4" aria-hidden /> {error}
            </p>
            {suggestions.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s.rollNo}
                    type="button"
                    onClick={() => {
                      setRoll(s.rollNo);
                      find(s.rollNo);
                    }}
                    className="rounded-lg border border-line px-3 py-1.5 text-left text-[13px] hover:bg-surface-2"
                  >
                    <span className="font-mono">{s.rollNo}</span> · {s.fullName}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {student && (
          <div className="mt-5 flex flex-col gap-4 rounded-xl border border-line p-4 sm:flex-row">
            <Avatar name={student.fullName} photoUrl={student.photoUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-lg font-semibold">{student.fullName}</p>
              <p className="text-[13px] text-ink-2">S/O {student.fatherName}</p>
              <p className="mt-1 text-[13px] text-muted">
                <span className="font-mono">{student.rollNo}</span> · {student.program} · {student.section}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[13px]">
                {student.totalViolations === 0 ? (
                  <StrikeBadge level="good" label="No previous violations" />
                ) : (
                  <StrikeBadge
                    level={student.totalViolations >= 3 ? "critical" : "serious"}
                    label={`${student.totalViolations} previous ${student.totalViolations === 1 ? "violation" : "violations"}`}
                  />
                )}
                {student.openCases > 0 && <span className="text-ink-2">{student.openCases} open</span>}
              </div>
              {student.recent.length > 0 && (
                <ul className="mt-3 flex flex-col gap-1 text-[13px]">
                  {student.recent.map((r) => (
                    <li key={r.id} className="flex items-center gap-2">
                      <span className="w-24 shrink-0 text-muted tabular">{r.date}</span>
                      <Link href={`/violations/${r.id}`} className="truncate hover:underline">
                        {r.type}
                      </Link>
                      <StrikeBadge level={SEVERITY_LEVEL[r.severity]} label={SEVERITY_LABELS[r.severity]} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}

function StudentStrip(s: { rollNo: string; fullName: string; program: string; section: string; photoUrl: string | null }) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-5 py-4">
      <Avatar name={s.fullName} photoUrl={s.photoUrl} size="md" />
      <div>
        <p className="font-semibold">{s.fullName}</p>
        <p className="text-[13px] text-muted">
          <span className="font-mono">{s.rollNo}</span> · {s.program} · {s.section}
        </p>
      </div>
    </div>
  );
}

function DetailsForm({
  types,
  today,
  initial,
  header,
  submitLabel,
  withNotify,
  disabledReason,
  cancelHref,
  onSubmit,
}: {
  types: TypeOption[];
  today: string;
  initial?: ViolationInput;
  header?: React.ReactNode;
  submitLabel: string;
  withNotify?: boolean;
  disabledReason?: string;
  cancelHref?: string;
  onSubmit: (input: ViolationInput) => Promise<string | null>;
}) {
  const [typeId, setTypeId] = useState(initial ? String(initial.typeId) : "");
  const [action, setAction] = useState<ViolationAction>(initial?.actionTaken ?? "VERBAL_WARNING");
  const [fine, setFine] = useState(initial ? String(initial.fineAmount) : "0");
  const [fineTouched, setFineTouched] = useState(!!initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const type = types.find((t) => String(t.id) === typeId);

  return (
    <Card>
      {header ?? <CardHeader title="2. What happened" description="Severity and the suggested fine come from the violation type." />}
      <form
        className="flex flex-col gap-4 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          setError(null);
          start(async () => {
            const err = await onSubmit({
              typeId: Number(typeId),
              incidentDate: String(fd.get("incidentDate") ?? ""),
              incidentTime: String(fd.get("incidentTime") ?? ""),
              location: String(fd.get("location") ?? ""),
              description: String(fd.get("description") ?? ""),
              reportedBy: String(fd.get("reportedBy") ?? ""),
              actionTaken: action,
              suspensionDays: action === "SUSPENSION" ? Number(fd.get("suspensionDays")) : null,
              fineAmount: Number(fine),
              notifyParent: fd.get("notifyParent") === "on",
            });
            if (err) setError(err);
          });
        }}
      >
        <fieldset disabled={!!disabledReason} className="flex flex-col gap-4 disabled:opacity-60">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <Field label="Type of violation *">
              <Select
                required
                value={typeId}
                onChange={(e) => {
                  setTypeId(e.target.value);
                  const t = types.find((x) => String(x.id) === e.target.value);
                  if (t && !fineTouched) setFine(String(t.defaultFineAmount));
                }}
              >
                <option value="" disabled>
                  Choose…
                </option>
                {SEVERITIES.map((sev) => {
                  const list = types.filter((t) => t.severity === sev && (t.active || String(t.id) === typeId));
                  if (list.length === 0) return null;
                  return (
                    <optgroup key={sev} label={SEVERITY_LABELS[sev]}>
                      {list.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
              </Select>
            </Field>
            <div className="flex flex-col gap-1.5">
              <span className="text-[13px] font-medium text-ink-2">Severity</span>
              <div className="flex h-10 items-center">
                {type ? (
                  <StrikeBadge level={SEVERITY_LEVEL[type.severity]} label={SEVERITY_LABELS[type.severity]} size="lg" />
                ) : (
                  <span className="text-[13px] text-muted">Set by the type</span>
                )}
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Date *">
              <Input name="incidentDate" type="date" required max={today} defaultValue={initial?.incidentDate ?? today} />
            </Field>
            <Field label="Time">
              <Input name="incidentTime" type="time" defaultValue={initial?.incidentTime ?? ""} />
            </Field>
            <Field label="Place">
              <Input name="location" list="violation-locations" maxLength={100} defaultValue={initial?.location ?? ""} placeholder="e.g. Canteen" />
              <datalist id="violation-locations">
                {LOCATIONS.map((l) => (
                  <option key={l} value={l} />
                ))}
              </datalist>
            </Field>
          </div>

          <Field label="What happened *">
            <Textarea
              name="description"
              required
              minLength={5}
              maxLength={2000}
              rows={4}
              defaultValue={initial?.description ?? ""}
              placeholder="Describe the incident: what the student did, who was involved, any witnesses."
            />
          </Field>

          <Field label="Reported by" hint="Teacher or staff member who reported it">
            <Input name="reportedBy" maxLength={100} defaultValue={initial?.reportedBy ?? ""} placeholder="e.g. Prof. Asif (Physics)" />
          </Field>

          <div className="grid gap-4 border-t border-line pt-4 sm:grid-cols-3">
            <Field label="Action taken *" className={action === "SUSPENSION" ? "" : "sm:col-span-2"}>
              <Select value={action} onChange={(e) => setAction(e.target.value as ViolationAction)}>
                {(Object.keys(VIOLATION_ACTION_LABELS) as ViolationAction[]).map((a) => (
                  <option key={a} value={a}>
                    {VIOLATION_ACTION_LABELS[a]}
                  </option>
                ))}
              </Select>
            </Field>
            {action === "SUSPENSION" && (
              <Field label="Suspension (days) *">
                <Input name="suspensionDays" type="number" min={1} max={60} required defaultValue={initial?.suspensionDays ?? 3} />
              </Field>
            )}
            <Field label="Fine (Rs.)" hint="0 for no fine">
              <Input
                type="number"
                min={0}
                step={50}
                value={fine}
                onChange={(e) => {
                  setFine(e.target.value);
                  setFineTouched(true);
                }}
              />
            </Field>
          </div>

          {withNotify && (
            <label className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-line px-3.5 py-3 hover:bg-surface-2">
              <input type="checkbox" name="notifyParent" defaultChecked className="size-4.5 accent-[var(--accent)]" />
              <MessageCircle className="size-4.5 text-muted" aria-hidden />
              <span className="text-sm font-medium">Message the parent</span>
              <span className="text-[12px] text-muted">WhatsApp or SMS after saving</span>
            </label>
          )}
        </fieldset>

        {(error || disabledReason) && (
          <p role="alert" className="flex items-center gap-2 rounded-lg bg-critical/10 px-3 py-2 text-sm text-danger-ink">
            <TriangleAlert className="size-4 shrink-0" aria-hidden /> {error ?? disabledReason}
          </p>
        )}

        <div className="flex justify-end gap-2">
          {cancelHref && (
            <Link href={cancelHref} className={buttonClass("ghost")}>
              Cancel
            </Link>
          )}
          <Button type="submit" variant="primary" size="lg" disabled={pending || !!disabledReason || !typeId}>
            {pending ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
            {submitLabel}
          </Button>
        </div>
      </form>
    </Card>
  );
}
