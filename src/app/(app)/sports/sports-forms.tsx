"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import { Button, Field, FormMessage, Input, Pill } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { createEvent, saveHouse, saveSport, setHouseActive, setSportActive, type FormState } from "./actions";

export function NewEventForm({ today }: { today: string }) {
  const [state, onSubmit, pending] = useFormAction<FormState>(createEvent, null);
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
      <Field label="Event name">
        <Input name="name" required maxLength={120} placeholder="e.g. Annual Sports Week 2026" />
      </Field>
      <Field label="Starts">
        <Input name="startDate" type="date" required defaultValue={today} />
      </Field>
      <Field label="Ends">
        <Input name="endDate" type="date" defaultValue={today} />
      </Field>
      <Field label="Venue">
        <Input name="venue" maxLength={100} placeholder="College ground" />
      </Field>
      <Button type="submit" variant="primary" disabled={pending}>
        <Plus className="size-4" aria-hidden /> Create event
      </Button>
      <div className="sm:col-span-2 lg:col-span-5">
        <FormMessage state={state} />
      </div>
    </form>
  );
}

type HouseRow = { id: number; name: string; color: string; inCharge: string | null; active: boolean };

export function HousesManager({ houses }: { houses: HouseRow[] }) {
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <div>
      <ul className="divide-y divide-line">
        {houses.map((h) => (
          <li key={h.id} className="px-5 py-2.5">
            {editing === h.id ? <HouseForm house={h} onDone={() => setEditing(null)} /> : <HouseItem house={h} onEdit={() => setEditing(h.id)} />}
          </li>
        ))}
      </ul>
      <div className="border-t border-line p-5">
        <p className="mb-2 text-sm font-semibold">Add a house</p>
        <HouseForm />
      </div>
    </div>
  );
}

function HouseItem({ house: h, onEdit }: { house: HouseRow; onEdit: () => void }) {
  const [pending, start] = useTransition();
  return (
    <div className={`flex flex-wrap items-center gap-3 ${h.active ? "" : "opacity-60"}`}>
      <span className="size-5 rounded-full ring-1 ring-line" style={{ background: h.color }} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium">
          {h.name} {!h.active && <Pill>Inactive</Pill>}
        </p>
        {h.inCharge && <p className="text-[12px] text-muted">In charge: {h.inCharge}</p>}
      </div>
      <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${h.name}`}>
        <Pencil className="size-3.5" aria-hidden />
      </Button>
      <Button size="sm" disabled={pending} onClick={() => start(() => setHouseActive(h.id, !h.active))}>
        {h.active ? "Deactivate" : "Activate"}
      </Button>
    </div>
  );
}

function HouseForm({ house, onDone }: { house?: HouseRow; onDone?: () => void }) {
  const [state, onSubmit, pending] = useFormAction<FormState>(
    async (prev, fd) => {
      const res = await saveHouse(prev, fd);
      if (res?.ok) onDone?.();
      return res;
    },
    null,
    { resetOnSuccess: !house },
  );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      {house && <input type="hidden" name="id" value={house.id} />}
      <div className="grid grid-cols-[3rem_minmax(0,1fr)] gap-2 sm:grid-cols-[3rem_minmax(0,1fr)_minmax(0,1fr)_auto]">
        <input type="color" name="color" defaultValue={house?.color ?? "#2a78d6"} aria-label="House colour" className="h-10 w-12 cursor-pointer rounded-lg border border-line bg-surface p-1" />
        <Input name="name" required maxLength={60} defaultValue={house?.name} placeholder="e.g. Jinnah House" aria-label="House name" />
        <Input name="inCharge" maxLength={100} defaultValue={house?.inCharge ?? ""} placeholder="House in-charge (optional)" aria-label="House in-charge" />
        <div className="flex gap-2">
          {house && (
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant={house ? "primary" : "secondary"} disabled={pending}>
            {house ? "Save" : "Add"}
          </Button>
        </div>
      </div>
      <FormMessage state={state} />
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
