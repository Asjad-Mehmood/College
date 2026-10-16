"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button, Field, FormMessage, Input, Pill, Select } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { createTeam, saveSport, setSportActive, type FormState } from "./actions";

export function NewTeamForm({ sports, season }: { sports: { id: number; name: string }[]; season: string }) {
  const [state, onSubmit, pending] = useFormAction<FormState>(createTeam, null);
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
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
      <Field label="Category" hint="e.g. Senior Boys, Girls, Junior">
        <Input name="category" required maxLength={40} placeholder="Senior Boys" />
      </Field>
      <Field label="Season">
        <Input name="season" required maxLength={20} defaultValue={season} />
      </Field>
      <Field label="Coach">
        <Input name="coach" maxLength={100} />
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>
        <Plus className="size-4" aria-hidden /> Create team
      </Button>
      <div className="sm:col-span-2 lg:col-span-5">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

type SportRow = { id: number; name: string; coach: string | null; active: boolean; teams: number };

export function SportsManager({ sports }: { sports: SportRow[] }) {
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <div>
      <ul className="divide-y divide-line">
        {sports.map((s) => (
          <li key={s.id} className="px-5 py-2.5">
            {editing === s.id ? (
              <SportForm sport={s} onDone={() => setEditing(null)} />
            ) : (
              <SportItem sport={s} onEdit={() => setEditing(s.id)} />
            )}
          </li>
        ))}
      </ul>
      <div className="border-t border-line p-5">
        <p className="mb-2 text-sm font-semibold">Add a sport</p>
        <SportForm />
      </div>
    </div>
  );
}

function SportItem({ sport: s, onEdit }: { sport: SportRow; onEdit: () => void }) {
  const [pending, start] = useTransition();
  return (
    <div className={`flex flex-wrap items-center gap-3 ${s.active ? "" : "opacity-60"}`}>
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {s.name} {!s.active && <Pill>Inactive</Pill>}
        </p>
        <p className="text-[12px] text-muted">
          {s.coach ? `Coach ${s.coach} · ` : ""}
          {s.teams} {s.teams === 1 ? "team" : "teams"}
        </p>
      </div>
      <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${s.name}`}>
        <Pencil className="size-3.5" aria-hidden />
      </Button>
      <Button size="sm" disabled={pending} onClick={() => start(() => setSportActive(s.id, !s.active))}>
        {s.active ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}

function SportForm({ sport, onDone }: { sport?: SportRow; onDone?: () => void }) {
  const [state, onSubmit, pending] = useFormAction<FormState>(
    async (prev, fd) => {
      const res = await saveSport(prev, fd);
      if (res?.ok) onDone?.();
      return res;
    },
    null,
    { resetOnSuccess: !sport },
  );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      {sport && <input type="hidden" name="id" value={sport.id} />}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
        <Input name="name" required maxLength={60} defaultValue={sport?.name} placeholder="e.g. Cricket" aria-label="Sport name" />
        <Input name="coach" maxLength={100} defaultValue={sport?.coach ?? ""} placeholder="Coach (optional)" aria-label="Coach" />
        <div className="flex gap-2">
          {sport && (
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant={sport ? "primary" : "secondary"} disabled={pending}>
            {sport ? "Save" : "Add"}
          </Button>
        </div>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
