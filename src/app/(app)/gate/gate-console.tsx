"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowRight,
  BadgeAlert,
  Banknote,
  CheckCircle2,
  Clock,
  CornerDownLeft,
  Loader2,
  MessageCircle,
  MessageSquareText,
  Printer,
  Search,
  TriangleAlert,
  X,
} from "lucide-react";
import type { LateReason } from "@/generated/prisma/enums";
import { Avatar, Button, Card, StrikeBadge, cx, fieldClass } from "@/components/ui";
import { REASONS } from "@/lib/labels";
import { STRIKE_GUIDANCE, STRIKE_LABELS, ordinal } from "@/lib/strikes";
import {
  logLateArrival,
  lookupStudent,
  type GateStudent,
  type LogResult,
  type LookupResult,
} from "./actions";

type Found = Extract<LookupResult, { ok: true }>;
type Saved = Extract<LogResult, { ok: true }>;

type Stage =
  | { kind: "idle" }
  | { kind: "notFound"; error: string; suggestions: GateStudent[] }
  | { kind: "preview"; data: Found }
  | { kind: "saved"; data: Found; result: Saved };

function isTextField(el: Element | null) {
  return (
    el instanceof HTMLTextAreaElement ||
    (el instanceof HTMLInputElement && !["checkbox", "radio", "button"].includes(el.type))
  );
}

export function GateConsole() {
  const [roll, setRoll] = useState("");
  const [stage, setStage] = useState<Stage>({ kind: "idle" });
  const [reason, setReason] = useState<LateReason | null>(null);
  const [fine, setFine] = useState(false);
  const [fineAmount, setFineAmount] = useState("");
  const [notifyParent, setNotifyParent] = useState(true);
  const [remarks, setRemarks] = useState("");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [looking, startLookup] = useTransition();
  const [saving, startSave] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const reset = useCallback(() => {
    setRoll("");
    setStage({ kind: "idle" });
    setReason(null);
    setFine(false);
    setFineAmount("");
    setNotifyParent(true);
    setRemarks("");
    setSaveError(null);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, []);

  const lookup = useCallback((value: string) => {
    if (!value.trim()) return;
    setSaveError(null);
    startLookup(async () => {
      const res = await lookupStudent(value);
      if (!res.ok) {
        setStage({ kind: "notFound", error: res.error, suggestions: res.suggestions });
        inputRef.current?.select();
        return;
      }
      setRoll(res.student.rollNo);
      setReason(null);
      setRemarks("");
      // Escalation engine: suggest a fine at the critical level.
      setFine(res.level === "critical");
      setFineAmount(String(res.defaultFine));
      setNotifyParent(true);
      setStage({ kind: "preview", data: res });
      inputRef.current?.blur();
    });
  }, []);

  const canSave =
    stage.kind === "preview" &&
    !!reason &&
    !stage.data.alreadyToday &&
    !stage.data.withinGrace &&
    stage.data.student.status === "ACTIVE";

  const save = useCallback(() => {
    if (stage.kind !== "preview" || !reason || !canSave) return;
    const data = stage.data;
    setSaveError(null);
    startSave(async () => {
      const result = await logLateArrival({
        rollNo: data.student.rollNo,
        reason,
        fine,
        fineAmount: Number(fineAmount),
        notifyParent,
        remarks,
      });
      if (!result.ok) {
        setSaveError(result.error);
        return;
      }
      setStage({ kind: "saved", data, result });
      requestAnimationFrame(() => nextRef.current?.focus());
    });
  }, [stage, reason, canSave, fine, fineAmount, notifyParent, remarks]);

  // Keyboard flow: 1–5 pick a reason, Enter saves, Esc starts over.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (stage.kind === "idle" || stage.kind === "notFound") return;
      if (e.key === "Escape") {
        e.preventDefault();
        reset();
        return;
      }
      if (stage.kind !== "preview" || isTextField(document.activeElement)) return;
      const match = REASONS.find((r) => r.key === e.key);
      if (match) {
        e.preventDefault();
        setReason(match.value);
      } else if (e.key === "Enter" && canSave) {
        e.preventDefault();
        save();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stage, canSave, save, reset]);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      {/* Roll number bar */}
      <Card className="p-4 sm:p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            lookup(roll);
          }}
          className="flex gap-2"
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-4 size-5 -translate-y-1/2 text-muted" aria-hidden />
            <input
              ref={inputRef}
              value={roll}
              onChange={(e) => setRoll(e.target.value)}
              onFocus={(e) => e.target.select()}
              autoFocus
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck={false}
              inputMode="text"
              aria-label="Roll number"
              placeholder="Type roll number"
              className={fieldClass("h-14 rounded-xl pl-12 font-mono text-lg tracking-wide uppercase placeholder:font-sans placeholder:normal-case placeholder:tracking-normal")}
            />
          </div>
          <Button type="submit" variant="primary" size="lg" disabled={looking || !roll.trim()} className="px-5">
            {looking ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <ArrowRight className="size-5" aria-hidden />}
            <span className="hidden sm:inline">Find</span>
          </Button>
        </form>
      </Card>

      {stage.kind === "idle" && <IdleHint />}

      {stage.kind === "notFound" && (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-critical/10 text-danger-ink">
              <TriangleAlert className="size-5" aria-hidden />
            </div>
            <div className="flex-1">
              <p className="font-medium">{stage.error}</p>
              <p className="mt-0.5 text-[13px] text-muted">Check the number on the ID card and try again.</p>
              {stage.suggestions.length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-[12px] font-medium tracking-wide text-muted uppercase">Did you mean</p>
                  <div className="flex flex-col gap-1.5">
                    {stage.suggestions.map((s) => (
                      <button
                        key={s.rollNo}
                        type="button"
                        onClick={() => {
                          setRoll(s.rollNo);
                          lookup(s.rollNo);
                        }}
                        className="flex items-center gap-3 rounded-xl border border-line px-3 py-2 text-left hover:bg-surface-2"
                      >
                        <Avatar name={s.fullName} photoUrl={s.photoUrl} size="sm" />
                        <span className="flex-1">
                          <span className="block text-sm font-medium">{s.fullName}</span>
                          <span className="block text-[12px] text-muted">
                            <span className="font-mono">{s.rollNo}</span> · {s.program} {s.section}
                          </span>
                        </span>
                        <ArrowRight className="size-4 text-muted" aria-hidden />
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {(stage.kind === "preview" || stage.kind === "saved") && (
        <StudentPreview data={stage.data} />
      )}

      {stage.kind === "preview" && (
        <Card className="p-4 sm:p-5">
          <Blockers data={stage.data} />

          <fieldset disabled={!!stage.data.alreadyToday || stage.data.withinGrace || stage.data.student.status !== "ACTIVE"} className="disabled:opacity-50">
            <legend className="mb-3 text-[13px] font-medium text-ink-2">Reason for coming late</legend>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
              {REASONS.map((r) => {
                const selected = reason === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setReason(r.value)}
                    aria-pressed={selected}
                    className={cx(
                      "relative flex h-16 items-center justify-center rounded-xl border px-3 text-center text-sm font-medium transition-colors",
                      selected
                        ? "border-accent bg-accent text-on-accent shadow-card ring-2 ring-accent/30"
                        : "border-line bg-surface hover:border-line-strong hover:bg-surface-2",
                      r.value === "NO_EXCUSE" && "col-span-2 sm:col-span-1",
                    )}
                  >
                    <kbd className={cx("absolute top-1.5 left-2 hidden font-mono text-[11px] sm:block", selected ? "text-on-accent/80" : "text-muted")}>{r.key}</kbd>
                    {r.label}
                  </button>
                );
              })}
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Toggle
                checked={fine}
                onChange={setFine}
                icon={<Banknote className="size-4.5" aria-hidden />}
                label="Impose fine"
              >
                {fine && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-[13px] text-muted">Rs.</span>
                    <input
                      type="number"
                      min={0}
                      step={50}
                      value={fineAmount}
                      onChange={(e) => setFineAmount(e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      aria-label="Fine amount in rupees"
                      className={fieldClass("h-8 w-24 tabular")}
                    />
                  </div>
                )}
              </Toggle>
              <Toggle
                checked={notifyParent}
                onChange={setNotifyParent}
                icon={<MessageCircle className="size-4.5" aria-hidden />}
                label="Message parent"
                hint="WhatsApp or SMS after saving"
              />
            </div>

            <details className="group mt-4">
              <summary className="cursor-pointer text-[13px] font-medium text-ink-2 select-none hover:text-ink">
                Add a remark (optional)
              </summary>
              <textarea
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                rows={2}
                maxLength={500}
                className={fieldClass("mt-2 h-auto py-2")}
                placeholder="e.g. Came with father, bus broke down"
              />
            </details>
          </fieldset>

          {saveError && (
            <p role="alert" className="mt-4 flex items-center gap-2 rounded-lg bg-critical/10 px-3 py-2 text-sm text-danger-ink">
              <TriangleAlert className="size-4 shrink-0" aria-hidden />
              {saveError}
            </p>
          )}

          <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
            <Button type="button" variant="ghost" onClick={reset}>
              <X className="size-4" aria-hidden /> Cancel <kbd className="ml-1 hidden font-mono text-[11px] text-muted sm:inline">Esc</kbd>
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              onClick={save}
              disabled={!canSave || saving}
              className="sm:min-w-64"
            >
              {saving ? <Loader2 className="size-5 animate-spin" aria-hidden /> : <CheckCircle2 className="size-5" aria-hidden />}
              {reason ? "Save & next student" : "Choose a reason"}
              {reason && <CornerDownLeft className="size-4 opacity-70" aria-hidden />}
            </Button>
          </div>
        </Card>
      )}

      {stage.kind === "saved" && (
        <Card className="overflow-hidden">
          <div className="flex items-center gap-3 border-b border-line bg-good/8 px-5 py-4">
            <CheckCircle2 className="size-6 text-good" aria-hidden />
            <div className="flex-1">
              <p className="font-semibold">Late arrival recorded</p>
              <p className="text-[13px] text-ink-2">
                {stage.result.arrivalTime} · {stage.result.minutesLate} min late ·{" "}
                {ordinal(stage.result.strike)} late this month
              </p>
            </div>
            <StrikeBadge level={stage.result.level} />
          </div>
          <div className="flex flex-col gap-4 p-5">
            {stage.result.notify && (
              <div className="rounded-xl border border-line bg-surface-2/60 p-4">
                <p className="text-[12px] font-medium tracking-wide text-muted uppercase">Message to parent</p>
                <p className="mt-1.5 text-sm leading-relaxed">{stage.result.notify.message}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a href={stage.result.notify.whatsapp} target="_blank" rel="noreferrer" className="inline-flex h-10 items-center gap-2 rounded-lg bg-[#1f8f4e] px-4 text-sm font-medium text-white hover:bg-[#1a7a43]">
                    <MessageCircle className="size-4" aria-hidden /> Send on WhatsApp
                  </a>
                  <a href={stage.result.notify.sms} className="inline-flex h-10 items-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2">
                    <MessageSquareText className="size-4" aria-hidden /> Send SMS
                  </a>
                </div>
              </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-between">
              <a
                href={`/pass/${stage.result.recordId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-11 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium hover:bg-surface-2"
              >
                <Printer className="size-4" aria-hidden /> Print gate pass
              </a>
              <Button ref={nextRef} type="button" variant="primary" size="lg" onClick={reset} className="sm:min-w-64">
                Next student <CornerDownLeft className="size-4 opacity-70" aria-hidden />
              </Button>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
}

function IdleHint() {
  return (
    <div className="rounded-2xl border border-dashed border-line-strong/70 px-6 py-12 text-center">
      <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
        <Clock className="size-6" aria-hidden />
      </div>
      <p className="font-medium">Ready for the next late arrival</p>
      <p className="mx-auto mt-1 max-w-md text-[13px] text-muted">
        Type the student&apos;s roll number and press Enter. Pick a
        reason with keys <kbd className="font-mono">1</kbd>–<kbd className="font-mono">5</kbd>, then press
        Enter again to save.
      </p>
    </div>
  );
}

function StudentPreview({ data }: { data: Found }) {
  const s = data.student;
  return (
    <Card className="p-4 sm:p-5">
      <div className="flex flex-col gap-5 sm:flex-row">
        <div className="flex items-center gap-4 sm:block">
          <Avatar name={s.fullName} photoUrl={s.photoUrl} size="xl" />
          <p className="text-[12px] text-muted sm:mt-2 sm:w-36 sm:text-center">Check the face matches the student</p>
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="text-2xl font-semibold tracking-tight">{s.fullName}</h2>
              <p className="text-ink-2">S/O {s.fatherName}</p>
            </div>
            <StrikeBadge
              size="lg"
              level={data.level}
              label={`${ordinal(data.nextStrike)} late this month · ${STRIKE_LABELS[data.level]}`}
            />
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
            <Info label="Roll no." value={<span className="font-mono">{s.rollNo}</span>} />
            <Info label="Class" value={`${s.program} · ${s.section}`} />
            <Info label="Arrived" value={data.arrivalTime} />
            <Info
              label="Late by"
              value={data.minutesLate > 0 ? `${data.minutesLate} min` : "On time"}
              sub={`Starts ${data.startTime}`}
            />
          </dl>
          <p className="mt-4 flex items-start gap-2 rounded-lg bg-surface-2/70 px-3 py-2 text-[13px] text-ink-2">
            <BadgeAlert className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            {STRIKE_GUIDANCE[data.level]}
            {data.monthCount > 0 && ` Previously late ${data.monthCount}× this month.`}
          </p>
        </div>
      </div>
    </Card>
  );
}

function Blockers({ data }: { data: Found }) {
  let message: string | null = null;
  if (data.student.status !== "ACTIVE") {
    message = "This student is not active (struck off or graduated) and can't be logged.";
  } else if (data.alreadyToday) {
    message = `Already logged late today at ${data.alreadyToday.time}.`;
  } else if (data.withinGrace) {
    message =
      data.minutesLate <= 0
        ? "The student is on time — nothing to record."
        : `Within the grace period (${data.minutesLate} min) — not counted as late.`;
  }
  if (!message) return null;
  return (
    <div className="mb-4 flex items-center justify-between gap-3 rounded-xl bg-warning/15 px-4 py-3 text-sm ring-1 ring-warning/35 ring-inset">
      <span className="flex items-center gap-2">
        <TriangleAlert className="size-4 shrink-0 text-ink-2" aria-hidden />
        {message}
      </span>
      {data.alreadyToday && (
        <a href={`/pass/${data.alreadyToday.id}`} target="_blank" rel="noreferrer" className="shrink-0 font-medium text-accent-ink underline underline-offset-2">
          Reprint pass
        </a>
      )}
    </div>
  );
}

function Info({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
      {sub && <dd className="text-[12px] text-muted">{sub}</dd>}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  icon,
  label,
  hint,
  children,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  icon: React.ReactNode;
  label: string;
  hint?: string;
  children?: React.ReactNode;
}) {
  return (
    <label
      className={cx(
        "flex cursor-pointer flex-col rounded-xl border px-3.5 py-3 transition-colors",
        checked ? "border-accent/50 bg-accent-soft/60" : "border-line hover:bg-surface-2",
      )}
    >
      <span className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="size-4.5 accent-[var(--accent)]"
        />
        <span className={cx(checked ? "text-accent-ink" : "text-muted")}>{icon}</span>
        <span className="text-sm font-medium">{label}</span>
      </span>
      {hint && <span className="mt-1 pl-7 text-[12px] text-muted">{hint}</span>}
      {children && <span className="pl-7">{children}</span>}
    </label>
  );
}
