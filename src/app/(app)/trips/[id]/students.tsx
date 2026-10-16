"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { MessageCircle, MoreHorizontal, Plus, Search, TriangleAlert, Users } from "lucide-react";
import type { ConsentStatus } from "@/generated/prisma/enums";
import { Avatar, Button, Card, CardHeader, FormMessage, Input, Pill, Select, cx, fieldClass } from "@/components/ui";
import { CONSENT_LABELS } from "@/lib/labels";
import { groupBySection } from "@/lib/sections";
import {
  addClass,
  addParticipant,
  checkStudentForTrip,
  removeParticipant,
  setParticipantStatus,
  updateParticipant,
  type CheckResult,
  type FormState,
} from "../actions";

export type ParticipantView = {
  id: number;
  rollNo: string;
  fullName: string;
  program: string;
  section: string;
  photoUrl: string | null;
  parentPhone: string;
  status: "REGISTERED" | "WITHDRAWN";
  consent: ConsentStatus;
  feePaid: number;
  receiptNo: string | null;
  medicalNotes: string | null;
  emergencyPhone: string | null;
  vehicleName: string | null;
  roomName: string | null;
  overrideNote: string | null;
  messages: { notice: string; consent: string; fee: string };
};

/* ---------- Adding students ---------- */

export function AddStudents({ tripId, programs, sections }: { tripId: number; programs: string[]; sections: string[] }) {
  const [roll, setRoll] = useState("");
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [override, setOverride] = useState("");
  const [state, setState] = useState<FormState>(null);
  const [classState, setClassState] = useState<FormState>(null);
  const [pending, start] = useTransition();

  const found = check?.ok ? check : null;
  const blocked = !!found && found.eligibility.blocks.length > 0;
  const warned = !!found && found.eligibility.warnings.length > 0;

  return (
    <Card>
      <CardHeader title="Add students" />
      <div className="grid gap-6 p-5 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-2">By roll number</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setState(null);
              setOverride("");
              start(async () => setCheck(await checkStudentForTrip(tripId, roll)));
            }}
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
              <input
                value={roll}
                onChange={(e) => {
                  setRoll(e.target.value);
                  setCheck(null);
                }}
                aria-label="Roll number"
                placeholder="Roll number"
                autoComplete="off"
                className={fieldClass("pl-9 font-mono uppercase placeholder:font-sans placeholder:normal-case")}
              />
            </div>
            <Button type="submit" disabled={pending || !roll.trim()}>
              Check
            </Button>
          </form>

          {check && !check.ok && <p className="mt-3 text-sm text-danger-ink">{check.message}</p>}
          {found && (
            <div className="mt-3 rounded-xl border border-line p-3">
              <p className="text-sm font-medium">
                {found.student.fullName} <span className="font-mono text-[12px] text-muted">{found.student.rollNo}</span>
              </p>
              <p className="text-[12px] text-muted">
                {found.student.program} · {found.student.section}
              </p>
              {[...found.eligibility.blocks, ...found.eligibility.warnings].map((m) => (
                <p key={m} className={cx("mt-2 flex items-start gap-1.5 text-[13px]", blocked ? "text-danger-ink" : "text-ink")}>
                  <TriangleAlert className={cx("mt-0.5 size-3.5 shrink-0", blocked ? "" : "text-serious")} aria-hidden /> {m}
                </p>
              ))}
              {!blocked && (
                <form
                  className="mt-3 flex flex-col gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    start(async () => {
                      const res = await addParticipant(tripId, found.student.rollNo, warned ? override : undefined);
                      setState(res);
                      if (res?.ok) {
                        setCheck(null);
                        setRoll("");
                      }
                    });
                  }}
                >
                  {warned && (
                    <Input
                      value={override}
                      onChange={(e) => setOverride(e.target.value)}
                      required
                      maxLength={200}
                      placeholder="Why may this student still go? e.g. Approved by Principal"
                      aria-label="Reason to allow"
                    />
                  )}
                  <Button type="submit" variant={warned ? "danger" : "primary"} disabled={pending}>
                    <Plus className="size-4" aria-hidden /> {warned ? "Add anyway" : "Add to trip"}
                  </Button>
                </form>
              )}
            </div>
          )}
          <div className="mt-2">
            <FormMessage state={state} />
          </div>
        </div>

        <div>
          <p className="mb-2 text-[13px] font-medium text-ink-2">A whole section</p>
          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              start(async () => setClassState(await addClass(tripId, String(fd.get("program") ?? ""), String(fd.get("section") ?? ""))));
            }}
          >
            <Select name="section" aria-label="Section" defaultValue="">
              <option value="">Section…</option>
              {sections.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </Select>
            <Select name="program" aria-label="Program" defaultValue="">
              <option value="">Any program</option>
              {programs.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </Select>
            <Button type="submit" disabled={pending} className="shrink-0">
              <Users className="size-4" aria-hidden /> Add section
            </Button>
          </form>
          <p className="mt-2 text-[12px] text-muted">
            Students with an open severe violation, or who don&apos;t fit the trip, are skipped and listed.
          </p>
          <div className="mt-2">
            <FormMessage state={classState} />
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ---------- Student table ---------- */

const FILTERS = [
  { key: "all", label: "All" },
  { key: "consent", label: "Consent pending" },
  { key: "fee", label: "Fee due" },
  { key: "withdrawn", label: "Withdrawn" },
] as const;

export function ParticipantTable({
  rows,
  fee,
  editable,
  enrolmentOpen,
}: {
  rows: ParticipantView[];
  fee: number;
  editable: boolean;
  enrolmentOpen: boolean;
}) {
  const [filter, setFilter] = useState<(typeof FILTERS)[number]["key"]>("all");
  const [q, setQ] = useState("");
  const visible = rows.filter((r) => {
    if (filter === "withdrawn" ? r.status !== "WITHDRAWN" : r.status !== "REGISTERED") return false;
    if (filter === "consent" && r.consent !== "PENDING") return false;
    if (filter === "fee" && !(fee > 0 && r.feePaid < fee)) return false;
    const s = q.trim().toLowerCase();
    return !s || r.fullName.toLowerCase().includes(s) || r.rollNo.toLowerCase().includes(s);
  });
  const counts = {
    all: rows.filter((r) => r.status === "REGISTERED").length,
    consent: rows.filter((r) => r.status === "REGISTERED" && r.consent === "PENDING").length,
    fee: fee > 0 ? rows.filter((r) => r.status === "REGISTERED" && r.feePaid < fee).length : 0,
    withdrawn: rows.filter((r) => r.status === "WITHDRAWN").length,
  };

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-col gap-3 border-b border-line px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap gap-1" role="tablist" aria-label="Show">
          {FILTERS.filter((f) => f.key !== "fee" || fee > 0).map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={cx(
                "rounded-full px-3 py-1 text-[13px] font-medium",
                filter === f.key ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2",
              )}
            >
              {f.label} <span className="tabular opacity-70">{counts[f.key]}</span>
            </button>
          ))}
        </div>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find a student" aria-label="Find a student" className="h-9 sm:w-56" />
      </div>
      {visible.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">{rows.length === 0 ? "No students added yet." : "Nobody in this list."}</p>
      ) : (
        groupBySection(visible, (r) => r.section).map(([section, group]) => (
          <section key={section}>
            <p className="flex flex-wrap items-center gap-x-3 border-y border-line bg-surface-2/50 px-5 py-1.5 text-[12px] font-semibold text-ink-2">
              <span>
                {section} · {group.length}
              </span>
              <span className="font-normal text-muted">
                {group.filter((r) => r.consent === "RECEIVED").length} consent received
                {fee > 0 && ` · ${group.filter((r) => r.feePaid >= fee).length} paid`}
              </span>
            </p>
            <ul className="divide-y divide-line">
              {group.map((r) => (
                <ParticipantRow key={r.id} row={r} fee={fee} editable={editable} enrolmentOpen={enrolmentOpen} />
              ))}
            </ul>
          </section>
        ))
      )}
    </Card>
  );
}

function ParticipantRow({ row: r, fee, editable, enrolmentOpen }: { row: ParticipantView; fee: number; editable: boolean; enrolmentOpen: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [more, setMore] = useState(false);
  const run = (fn: () => Promise<FormState>) =>
    start(async () => {
      const res = await fn();
      setError(res && !res.ok ? (res.message ?? "Couldn't save.") : null);
    });
  const feeDue = fee > 0 && r.feePaid < fee;
  const withdrawn = r.status === "WITHDRAWN";

  return (
    <li className={cx("px-4 py-3 sm:px-5", withdrawn && "opacity-60", pending && "opacity-70")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Link href={`/students/${encodeURIComponent(r.rollNo)}`} className="group flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={r.fullName} photoUrl={r.photoUrl} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium group-hover:underline">{r.fullName}</span>
            <span className="block truncate text-[12px] text-muted">
              <span className="font-mono">{r.rollNo}</span> · {r.program}
              {r.vehicleName && ` · ${r.vehicleName}`}
              {r.roomName && ` · ${r.roomName}`}
            </span>
          </span>
          {r.overrideNote && (
            <span title={`Allowed despite warning: ${r.overrideNote}`}>
              <TriangleAlert className="size-4 text-serious" aria-label="Added despite a discipline warning" />
            </span>
          )}
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          {editable && !withdrawn ? (
            <select
              value={r.consent}
              onChange={(e) => run(() => updateParticipant(r.id, { consent: e.target.value as ConsentStatus }))}
              aria-label={`Consent for ${r.fullName}`}
              className={cx(
                "h-8 w-44 rounded-lg border px-2 text-[13px] font-medium",
                r.consent === "RECEIVED" && "border-good/40 bg-good/10 text-success-ink",
                r.consent === "PENDING" && "border-warning/50 bg-warning/15 text-ink",
                r.consent === "REFUSED" && "border-critical/40 bg-critical/10 text-danger-ink",
              )}
            >
              {(Object.keys(CONSENT_LABELS) as ConsentStatus[]).map((c) => (
                <option key={c} value={c}>
                  Consent: {CONSENT_LABELS[c]}
                </option>
              ))}
            </select>
          ) : (
            <Pill tone={r.consent === "RECEIVED" ? "good" : r.consent === "REFUSED" ? "critical" : "warning"}>Consent: {CONSENT_LABELS[r.consent]}</Pill>
          )}

          {fee > 0 &&
            (editable && !withdrawn ? (
              <form
                key={`${r.feePaid}-${r.receiptNo}`}
                className="flex items-center gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault();
                  const fd = new FormData(e.currentTarget);
                  run(() => updateParticipant(r.id, { feePaid: Number(fd.get("fee")), receiptNo: String(fd.get("receipt") ?? "") }));
                }}
              >
                <span className="text-[12px] text-muted">Rs.</span>
                <input
                  name="fee"
                  type="number"
                  min={0}
                  step={50}
                  defaultValue={r.feePaid}
                  aria-label={`Fee paid by ${r.fullName}`}
                  className={fieldClass("h-8 w-20 px-2 tabular", feeDue ? "border-critical/40" : "border-good/40")}
                />
                <input
                  name="receipt"
                  defaultValue={r.receiptNo ?? ""}
                  placeholder="Receipt"
                  maxLength={30}
                  aria-label={`Receipt number for ${r.fullName}`}
                  className={fieldClass("h-8 w-24 px-2")}
                />
                {feeDue ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    className="w-16"
                    disabled={pending}
                    onClick={(e) => {
                      const form = (e.currentTarget as HTMLButtonElement).form!;
                      const receipt = (form.elements.namedItem("receipt") as HTMLInputElement).value;
                      run(() => updateParticipant(r.id, { feePaid: fee, receiptNo: receipt }));
                    }}
                  >
                    Paid
                  </Button>
                ) : (
                  <span className="inline-flex w-16 justify-center">
                    <Pill tone="good">Paid</Pill>
                  </span>
                )}
                <Button type="submit" size="sm" variant="ghost" disabled={pending}>
                  Save
                </Button>
              </form>
            ) : (
              <Pill tone={feeDue ? "critical" : "good"}>
                Rs. {r.feePaid}/{fee} {feeDue ? "due" : "paid"}
              </Pill>
            ))}

          <button
            type="button"
            onClick={() => setMore((m) => !m)}
            aria-expanded={more}
            aria-label={`More for ${r.fullName}`}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
          >
            <MoreHorizontal className="size-4.5" />
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-[13px] text-danger-ink">{error}</p>}

      {more && (
        <div className="mt-3 grid gap-3 rounded-xl bg-surface-2/60 p-3 sm:grid-cols-2">
          {editable && !withdrawn ? (
            <form
              key={`${r.medicalNotes}-${r.emergencyPhone}`}
              className="flex flex-col gap-2 sm:col-span-2 sm:flex-row"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                run(() =>
                  updateParticipant(r.id, {
                    medicalNotes: String(fd.get("medical") ?? ""),
                    emergencyPhone: String(fd.get("emergency") ?? ""),
                  }),
                );
              }}
            >
              <Input name="medical" defaultValue={r.medicalNotes ?? ""} maxLength={300} placeholder="Medical notes (allergies, asthma…)" aria-label="Medical notes" />
              <Input name="emergency" type="tel" defaultValue={r.emergencyPhone ?? ""} maxLength={20} placeholder={`Emergency phone (default ${r.parentPhone})`} aria-label="Emergency phone" className="sm:w-64" />
              <Button type="submit" size="md" disabled={pending}>
                Save
              </Button>
            </form>
          ) : (
            <p className="text-[13px] text-ink-2 sm:col-span-2">
              {r.medicalNotes ? `Medical: ${r.medicalNotes} · ` : ""}Emergency: {r.emergencyPhone ?? r.parentPhone}
            </p>
          )}
          {r.overrideNote && <p className="text-[13px] text-ink-2 sm:col-span-2">Allowed despite warning: {r.overrideNote}</p>}
          <div className="flex flex-wrap gap-2 sm:col-span-2">
            <WaLink href={r.messages.notice} label="Trip notice" />
            {r.consent === "PENDING" && <WaLink href={r.messages.consent} label="Consent reminder" />}
            {feeDue && <WaLink href={r.messages.fee} label="Fee reminder" />}
            {editable && enrolmentOpen && (
              <span className="ml-auto flex gap-2">
                {withdrawn ? (
                  <Button size="sm" disabled={pending} onClick={() => run(() => setParticipantStatus(r.id, "REGISTERED"))}>
                    Re-register
                  </Button>
                ) : (
                  <Button size="sm" disabled={pending} onClick={() => run(() => setParticipantStatus(r.id, "WITHDRAWN"))}>
                    Withdraw
                  </Button>
                )}
                {r.feePaid === 0 && (
                  <Button size="sm" variant="ghost" className="text-danger-ink" disabled={pending} onClick={() => run(() => removeParticipant(r.id))}>
                    Remove
                  </Button>
                )}
              </span>
            )}
          </div>
        </div>
      )}
    </li>
  );
}

function WaLink({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#1f8f4e] px-3 text-[13px] font-medium text-white hover:bg-[#1a7a43]"
    >
      <MessageCircle className="size-3.5" aria-hidden /> {label}
    </a>
  );
}

/* ---------- Bulk parent messages ---------- */

export function MessagePanel({ rows, fee }: { rows: ParticipantView[]; fee: number }) {
  const [kind, setKind] = useState<"notice" | "consent" | "fee">("notice");
  const active = rows.filter((r) => r.status === "REGISTERED");
  const targets = active.filter((r) => (kind === "consent" ? r.consent === "PENDING" : kind === "fee" ? fee > 0 && r.feePaid < fee : true));
  const [opened, setOpened] = useState<Set<number>>(new Set());

  return (
    <Card>
      <CardHeader
        title="Message parents"
        description="Opens WhatsApp with the message written for each parent. Ticks show who you've already opened."
      />
      <div className="flex flex-col gap-3 p-5">
        <div className="flex flex-wrap gap-1" role="tablist">
          {[
            { key: "notice" as const, label: `Trip notice (${active.length})` },
            { key: "consent" as const, label: `Consent reminder (${active.filter((r) => r.consent === "PENDING").length})` },
            ...(fee > 0 ? [{ key: "fee" as const, label: `Fee reminder (${active.filter((r) => r.feePaid < fee).length})` }] : []),
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={kind === t.key}
              onClick={() => setKind(t.key)}
              className={cx("rounded-full px-3 py-1 text-[13px] font-medium", kind === t.key ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2")}
            >
              {t.label}
            </button>
          ))}
        </div>
        {targets.length === 0 ? (
          <p className="text-[13px] text-muted">Nobody to message.</p>
        ) : (
          <>
            <p className="rounded-lg bg-surface-2/60 p-3 text-[13px] leading-relaxed text-ink-2">{decodeURIComponent(targets[0].messages[kind].split("text=")[1] ?? "")}</p>
            <ul className="grid max-h-72 gap-1.5 overflow-y-auto sm:grid-cols-2">
              {targets.map((r) => (
                <li key={r.id}>
                  <a
                    href={r.messages[kind]}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setOpened((s) => new Set(s).add(r.id))}
                    className="flex items-center gap-2 rounded-lg border border-line px-3 py-2 text-[13px] hover:bg-surface-2"
                  >
                    <MessageCircle className={cx("size-4 shrink-0", opened.has(r.id) ? "text-good" : "text-muted")} aria-hidden />
                    <span className="min-w-0 flex-1 truncate">{r.fullName}</span>
                    {opened.has(r.id) && <span className="text-[12px] text-success-ink">Opened</span>}
                  </a>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </Card>
  );
}
