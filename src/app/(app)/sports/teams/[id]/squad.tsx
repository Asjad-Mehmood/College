"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { MessageCircle, Plus, Search, Trash2, TriangleAlert, X } from "lucide-react";
import type { MemberStatus } from "@/generated/prisma/enums";
import { Avatar, Button, Card, CardHeader, Field, FormMessage, Input, Pill, cx, fieldClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import {
  addAchievement,
  addMember,
  checkForTeam,
  searchStudents,
  setManager,
  deleteAchievement,
  deleteTeam,
  removeMember,
  updateMember,
  type CheckResult,
  type FormState,
  type StudentHit,
} from "../../actions";

export type MemberView = {
  id: number;
  rollNo: string;
  fullName: string;
  section: string;
  batch: string | null;
  photoUrl: string | null;
  role: string;
  jerseyNo: number | null;
  position: string | null;
  status: MemberStatus;
  medicalNote: string | null;
  overrideNote: string | null;
  message: string;
};

export function AddPlayers({ teamId }: { teamId: number }) {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<StudentHit[]>([]);
  const [check, setCheck] = useState<CheckResult | null>(null);
  const [override, setOverride] = useState("");
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const found = check?.ok ? check : null;
  const blocked = !!found && found.blocks.length > 0;
  const warned = !!found && found.warnings.length > 0;

  const latest = useRef(0);
  function search(value: string) {
    setQ(value);
    setCheck(null);
    setState(null);
    const ticket = ++latest.current;
    if (value.trim().length < 2) return setHits([]);
    start(async () => {
      const res = await searchStudents(value);
      // Ignore answers to older keystrokes.
      if (ticket === latest.current) setHits(res);
    });
  }
  function pick(rollNo: string) {
    setOverride("");
    setHits([]);
    start(async () => setCheck(await checkForTeam(teamId, rollNo)));
  }

  return (
    <Card>
      <CardHeader title="Add players" description="Search the whole college by name or roll number." />
      <div className="p-5">
        <div className="relative max-w-xl">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            value={q}
            onChange={(e) => search(e.target.value)}
            aria-label="Find a student"
            placeholder="Type a name or roll number…"
            autoComplete="off"
            className={fieldClass("pl-9")}
          />
        </div>
        {hits.length > 0 && (
          <ul className="mt-2 max-w-xl divide-y divide-line rounded-xl border border-line">
            {hits.map((h) => (
              <li key={h.rollNo}>
                <button type="button" onClick={() => pick(h.rollNo)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-surface-2">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{h.fullName}</span>
                    <span className="block truncate text-[12px] text-muted">
                      <span className="font-mono">{h.rollNo}</span> · {h.program} · {h.section}
                    </span>
                  </span>
                  <Plus className="size-4 text-muted" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        {q.trim().length >= 2 && hits.length === 0 && !check && !pending && <p className="mt-2 text-[13px] text-muted">No active student matches.</p>}
        {check && !check.ok && <p className="mt-3 text-sm text-danger-ink">{check.message}</p>}
        {found && (
          <div className="mt-3 max-w-xl rounded-xl border border-line p-3">
            <p className="text-sm font-medium">
              {found.student.fullName} <span className="font-mono text-[12px] text-muted">{found.student.rollNo}</span> · {found.student.section}
            </p>
            {[...found.blocks, ...found.warnings].map((m) => (
              <p key={m} className={cx("mt-2 flex items-start gap-1.5 text-[13px]", blocked ? "text-danger-ink" : "")}>
                <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden /> {m}
              </p>
            ))}
            {!blocked && (
              <form
                className="mt-3 flex flex-col gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  start(async () => {
                    const res = await addMember(teamId, found.student.rollNo, warned ? override : undefined);
                    setState(res);
                    if (res?.ok) {
                      setCheck(null);
                      setQ("");
                    }
                  });
                }}
              >
                {warned && <Input value={override} onChange={(e) => setOverride(e.target.value)} required maxLength={200} placeholder="Why may this student still play?" aria-label="Reason to allow" />}
                <Button type="submit" variant={warned ? "danger" : "primary"} disabled={pending}>
                  <Plus className="size-4" aria-hidden /> {warned ? "Add anyway" : "Add to team"}
                </Button>
              </form>
            )}
          </div>
        )}
        <div className="mt-2">
          <FormMessage state={state} />
        </div>
      </div>
    </Card>
  );
}

const STATUS_LABEL: Record<MemberStatus, string> = { SELECTED: "In squad", WAITLIST: "Waitlist", DROPPED: "Dropped" };

export function SquadTable({ members, editable }: { members: MemberView[]; editable: boolean }) {
  const [show, setShow] = useState<MemberStatus | "ALL">("SELECTED");
  const visible = members.filter((m) => show === "ALL" || m.status === show);
  const count = (s: MemberStatus) => members.filter((m) => m.status === s).length;
  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap gap-1 border-b border-line px-4 py-3" role="tablist">
        {(["SELECTED", "WAITLIST", "DROPPED", "ALL"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={show === k}
            onClick={() => setShow(k)}
            className={cx("rounded-full px-3 py-1 text-[13px] font-medium", show === k ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2")}
          >
            {k === "ALL" ? "Everyone" : STATUS_LABEL[k]} <span className="tabular opacity-70">{k === "ALL" ? members.length : count(k)}</span>
          </button>
        ))}
      </div>
      {visible.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">Nobody here yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {visible.map((m) => (
            <MemberRow key={m.id} m={m} editable={editable} />
          ))}
        </ul>
      )}
    </Card>
  );
}

function MemberRow({ m, editable }: { m: MemberView; editable: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const run = (fn: () => Promise<FormState>) =>
    start(async () => {
      const res = await fn();
      setError(res && !res.ok ? (res.message ?? "Couldn't save.") : null);
    });
  return (
    <li className={cx("px-4 py-3 sm:px-5", pending && "opacity-70")}>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <Link href={`/students/${encodeURIComponent(m.rollNo)}`} className="group flex min-w-0 flex-1 items-center gap-3">
          <Avatar name={m.fullName} photoUrl={m.photoUrl} size="sm" />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium group-hover:underline">
              {m.fullName}
              {m.role !== "Player" && <span className="ml-2 text-[12px] font-normal text-accent-ink">{m.role}</span>}
            </span>
            <span className="block truncate text-[12px] text-muted">
              <span className="font-mono">{m.rollNo}</span> · {m.section}
              {m.batch && ` · ${m.batch}`}
              {m.medicalNote && ` · ${m.medicalNote}`}
            </span>
          </span>
          {m.overrideNote && <TriangleAlert className="size-4 text-serious" aria-label={`Added despite warning: ${m.overrideNote}`} />}
        </Link>
        {editable ? (
          <form
            key={`${m.jerseyNo}-${m.position}`}
            className="flex flex-wrap items-center gap-1.5"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() => updateMember(m.id, { jerseyNo: String(fd.get("jersey")), position: String(fd.get("position")) }));
            }}
          >
            <Input name="jersey" type="number" min={0} max={999} defaultValue={m.jerseyNo ?? ""} placeholder="#" aria-label={`Jersey for ${m.fullName}`} className="h-8 w-16 px-2" />
            <Input name="position" defaultValue={m.position ?? ""} placeholder="Position" maxLength={40} aria-label={`Position for ${m.fullName}`} className="h-8 w-28 px-2" />
            <Button type="submit" size="sm" variant="ghost" disabled={pending}>
              Save
            </Button>
            <select value={m.role} onChange={(e) => run(() => updateMember(m.id, { role: e.target.value }))} aria-label={`Role for ${m.fullName}`} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px]">
              <option>Player</option>
              <option>Captain</option>
              <option>Vice-captain</option>
            </select>
            <select value={m.status} onChange={(e) => run(() => updateMember(m.id, { status: e.target.value as MemberStatus }))} aria-label={`Status for ${m.fullName}`} className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px]">
              {(Object.keys(STATUS_LABEL) as MemberStatus[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_LABEL[s]}
                </option>
              ))}
            </select>
            <a href={m.message} target="_blank" rel="noreferrer" className="inline-flex size-8 items-center justify-center rounded-lg bg-[#1f8f4e] text-white hover:bg-[#1a7a43]" aria-label={`WhatsApp ${m.fullName}'s parent`}>
              <MessageCircle className="size-4" />
            </a>
            <button type="button" disabled={pending} onClick={() => run(async () => (await removeMember(m.id), { ok: true }))} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-danger-ink" aria-label={`Remove ${m.fullName}`}>
              <X className="size-4" />
            </button>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2 text-[13px]">
            {m.jerseyNo != null && <Pill>#{m.jerseyNo}</Pill>}
            {m.position && <span className="text-ink-2">{m.position}</span>}
            <Pill tone={m.status === "SELECTED" ? "good" : "neutral"}>{STATUS_LABEL[m.status]}</Pill>
          </div>
        )}
      </div>
      {error && <p className="mt-2 text-[13px] text-danger-ink">{error}</p>}
    </li>
  );
}

export type AchievementView = { id: number; event: string; position: string; date: string; who: string | null };

export function Achievements({ teamId, items, editable }: { teamId: number; items: AchievementView[]; editable: boolean }) {
  const [pending, start] = useTransition();
  const [state, onSubmit, saving] = useFormAction<FormState>(addAchievement, null, { resetOnSuccess: true });
  return (
    <Card>
      <CardHeader title="Achievements" description="Medals and results for this team or its players." />
      {items.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-muted">None recorded yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {items.map((a) => (
            <li key={a.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {a.position} <span className="font-normal text-ink-2">· {a.event}</span>
                </p>
                <p className="text-[12px] text-muted">
                  {a.date}
                  {a.who && ` · ${a.who}`}
                </p>
              </div>
              {editable && (
                <button type="button" disabled={pending} onClick={() => start(() => deleteAchievement(a.id))} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Delete achievement">
                  <Trash2 className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form onSubmit={onSubmit} className="grid gap-2 border-t border-line p-4 sm:grid-cols-2">
          <input type="hidden" name="teamId" value={teamId} />
          <Field label="Event">
            <Input name="event" required maxLength={120} placeholder="e.g. Inter-college cricket cup" />
          </Field>
          <Field label="Position">
            <Input name="position" required maxLength={60} placeholder="Winner, Runner-up, Gold…" />
          </Field>
          <Field label="Player (optional)" hint="Roll number, if it's an individual medal">
            <Input name="rollNo" maxLength={20} className="font-mono uppercase" />
          </Field>
          <Field label="Date">
            <Input name="achievedOn" type="date" />
          </Field>
          <div className="sm:col-span-2">
            <FormMessage state={state} />
          </div>
          <div className="sm:col-span-2">
            <Button type="submit" disabled={saving}>
              <Plus className="size-4" aria-hidden /> Record achievement
            </Button>
          </div>
        </form>
      )}
    </Card>
  );
}

export function DeleteTeam({ id }: { id: number }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return confirm ? (
    <span className="flex items-center gap-2 rounded-lg bg-critical/5 px-3 py-1.5 text-[13px] text-danger-ink">
      Delete this team and its squad?
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
        Keep
      </Button>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => start(() => deleteTeam(id))}>
        Delete
      </Button>
    </span>
  ) : (
    <Button variant="ghost" className="text-danger-ink" onClick={() => setConfirm(true)}>
      <Trash2 className="size-4" aria-hidden /> Delete team
    </Button>
  );
}

export function ManagerField({ teamId, manager, editable }: { teamId: number; manager: string | null; editable: boolean }) {
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  if (!editable) return <p className="text-sm text-ink-2">{manager ? `Manager: ${manager}` : "No manager set"}</p>;
  return (
    <form
      key={manager}
      className="flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => setState(await setManager(teamId, String(fd.get("manager")))));
      }}
    >
      <Input name="manager" defaultValue={manager ?? ""} maxLength={100} placeholder="Team manager / coach" aria-label="Team manager" className="h-9 w-56" />
      <Button type="submit" size="sm" disabled={pending}>
        Save
      </Button>
      {state?.ok && <span className="text-[12px] text-success-ink">Saved</span>}
    </form>
  );
}
