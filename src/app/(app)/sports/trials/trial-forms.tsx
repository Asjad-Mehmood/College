"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Plus, Trash2, Users, X } from "lucide-react";
import type { TrialResult } from "@/generated/prisma/enums";
import { Avatar, Button, Card, CardHeader, Field, FormMessage, Input, Select, cx } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { groupBySection } from "@/lib/sections";
import {
  addCandidates,
  createTrial,
  deleteTrial,
  promoteCandidates,
  removeCandidate,
  setCandidate,
  type FormState,
} from "../actions";

export function NewTrialForm({ sports, today }: { sports: { id: number; name: string }[]; today: string }) {
  const [state, onSubmit, pending] = useFormAction<FormState>(createTrial, null);
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(3,minmax(0,1fr))_auto] lg:items-end">
      <Field label="Sport">
        <Select name="sportId" required defaultValue="">
          <option value="" disabled>
            Choose…
          </option>
          {sports.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Trial date">
        <Input name="trialDate" type="date" required defaultValue={today} />
      </Field>
      <Field label="Venue">
        <Input name="venue" maxLength={100} placeholder="e.g. College ground" />
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>
        <Plus className="size-4" aria-hidden /> Create trial
      </Button>
      <div className="sm:col-span-2 lg:col-span-4">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

export type CandidateView = { id: number; fullName: string; rollNo: string; section: string; photoUrl: string | null; result: TrialResult; note: string | null };

const RESULTS: { value: TrialResult; label: string }[] = [
  { value: "PENDING", label: "Pending" },
  { value: "SELECTED", label: "Selected" },
  { value: "WAITLIST", label: "Waitlist" },
  { value: "REJECTED", label: "Not selected" },
];

export function TrialBoard({
  trialId,
  candidates,
  sections,
  teams,
  editable,
}: {
  trialId: number;
  candidates: CandidateView[];
  sections: string[];
  teams: { id: number; label: string }[];
  editable: boolean;
}) {
  const [roll, setRoll] = useState("");
  const [state, setState] = useState<FormState>(null);
  const [team, setTeam] = useState(teams[0] ? String(teams[0].id) : "");
  const [pending, start] = useTransition();
  const counts = (r: TrialResult) => candidates.filter((c) => c.result === r).length;

  return (
    <div className="flex flex-col gap-5">
      {editable && (
        <Card>
          <CardHeader title="Add candidates" />
          <div className="grid gap-4 p-5 lg:grid-cols-2">
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                start(async () => {
                  const res = await addCandidates(trialId, { rollNo: roll });
                  setState(res);
                  if (res?.ok) setRoll("");
                });
              }}
            >
              <Input value={roll} onChange={(e) => setRoll(e.target.value)} placeholder="Roll number" aria-label="Roll number" className="font-mono uppercase placeholder:font-sans placeholder:normal-case" />
              <Button type="submit" disabled={pending || !roll.trim()}>
                Add
              </Button>
            </form>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                start(async () => setState(await addCandidates(trialId, { section: String(fd.get("section")) })));
              }}
            >
              <Select name="section" aria-label="Section" defaultValue="">
                <option value="">Whole section…</option>
                {sections.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </Select>
              <Button type="submit" disabled={pending} className="shrink-0">
                <Users className="size-4" aria-hidden /> Add section
              </Button>
            </form>
            <div className="lg:col-span-2">
              <FormMessage state={state} />
            </div>
          </div>
        </Card>
      )}

      <Card className="overflow-hidden">
        <CardHeader
          title={`Candidates (${candidates.length})`}
          description={`${counts("SELECTED")} selected · ${counts("WAITLIST")} waitlist · ${counts("REJECTED")} not selected · ${counts("PENDING")} pending`}
          actions={
            editable &&
            teams.length > 0 && (
              <form
                className="flex items-center gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (team) start(async () => setState(await promoteCandidates(trialId, Number(team))));
                }}
              >
                <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="Team" className="h-9 rounded-lg border border-line bg-surface px-2 text-[13px]">
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label}
                    </option>
                  ))}
                </select>
                <Button type="submit" size="sm" variant="primary" disabled={pending}>
                  Move selected to squad <ArrowRight className="size-3.5" aria-hidden />
                </Button>
              </form>
            )
          }
        />
        {candidates.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No candidates yet.</p>
        ) : (
          groupBySection(candidates, (c) => c.section).map(([section, rows]) => (
            <section key={section}>
              <p className="border-y border-line bg-surface-2/50 px-5 py-1.5 text-[12px] font-semibold text-ink-2">
                {section} · {rows.length}
              </p>
              <ul className="divide-y divide-line">
                {rows.map((c) => (
                  <CandidateRow key={c.id} c={c} editable={editable} />
                ))}
              </ul>
            </section>
          ))
        )}
        {editable && teams.length === 0 && candidates.length > 0 && (
          <p className="border-t border-line px-5 py-3 text-[13px] text-muted">Create a team for this sport to move selected students into its squad.</p>
        )}
      </Card>
    </div>
  );
}

function CandidateRow({ c, editable }: { c: CandidateView; editable: boolean }) {
  const [pending, start] = useTransition();
  return (
    <li className={cx("flex flex-wrap items-center gap-3 px-5 py-2.5", pending && "opacity-70")}>
      <Avatar name={c.fullName} photoUrl={c.photoUrl} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{c.fullName}</p>
        <p className="font-mono text-[12px] text-muted">{c.rollNo}</p>
      </div>
      {editable ? (
        <>
          <div className="flex gap-1" role="radiogroup" aria-label={`Result for ${c.fullName}`}>
            {RESULTS.map((r) => (
              <button
                key={r.value}
                type="button"
                role="radio"
                aria-checked={c.result === r.value}
                disabled={pending}
                onClick={() => start(async () => void (await setCandidate(c.id, r.value)))}
                className={cx(
                  "rounded-full border px-2.5 py-1 text-[12px] font-medium",
                  c.result === r.value
                    ? r.value === "SELECTED"
                      ? "border-good/50 bg-good/15 text-success-ink"
                      : r.value === "REJECTED"
                        ? "border-critical/40 bg-critical/10 text-danger-ink"
                        : r.value === "WAITLIST"
                          ? "border-warning/50 bg-warning/15"
                          : "border-accent/40 bg-accent-soft text-accent-ink"
                    : "border-line text-ink-2 hover:bg-surface-2",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <button type="button" disabled={pending} onClick={() => start(() => removeCandidate(c.id))} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label={`Remove ${c.fullName}`}>
            <X className="size-4" />
          </button>
        </>
      ) : (
        <span className="text-[13px] text-ink-2">{RESULTS.find((r) => r.value === c.result)?.label}</span>
      )}
    </li>
  );
}

export function DeleteTrial({ id }: { id: number }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return confirm ? (
    <span className="flex items-center gap-2 rounded-lg bg-critical/5 px-3 py-1.5 text-[13px] text-danger-ink">
      Delete this trial?
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
        Keep
      </Button>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => start(() => deleteTrial(id))}>
        Delete
      </Button>
    </span>
  ) : (
    <Button variant="ghost" className="text-danger-ink" onClick={() => setConfirm(true)}>
      <Trash2 className="size-4" aria-hidden /> Delete
    </Button>
  );
}
