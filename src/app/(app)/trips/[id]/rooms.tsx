"use client";

import { useState, useTransition } from "react";
import { BedDouble, Eraser, Pencil, Plus, Shuffle, X } from "lucide-react";
import { Button, Card, CardHeader, Field, FormMessage, Input, cx } from "@/components/ui";
import { groupBySection } from "@/lib/sections";
import { addRooms, assignRoom, autoAssignRooms, clearRooms, removeRoom, saveRoom, type FormState } from "../actions";

export type Occupant = { id: number; fullName: string; rollNo: string; section: string };
export type RoomView = { id: number; name: string; beds: number; place: string | null; notes: string | null; occupants: Occupant[] };

const selectClass = "h-8 rounded-lg border border-line bg-surface px-2 text-[13px]";

export function RoomsPanel({
  tripId,
  rooms,
  unassigned,
  editable,
}: {
  tripId: number;
  rooms: RoomView[];
  unassigned: Occupant[];
  editable: boolean;
}) {
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const [adding, setAdding] = useState<"one" | "many" | null>(rooms.length === 0 ? "many" : null);
  const [editing, setEditing] = useState<number | null>(null);
  const run = (fn: () => Promise<FormState>) => start(async () => setState(await fn()));
  const totalBeds = rooms.reduce((s, r) => s + r.beds, 0);
  const placed = rooms.reduce((s, r) => s + r.occupants.length, 0);

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Rooms"
          description={`${rooms.length} rooms · ${placed} of ${totalBeds} beds filled · ${unassigned.length} students without a bed`}
          actions={
            editable && (
              <div className="flex flex-wrap gap-2">
                {rooms.length > 0 && unassigned.length > 0 && (
                  <Button size="sm" variant="primary" disabled={pending} onClick={() => run(() => autoAssignRooms(tripId))}>
                    <Shuffle className="size-3.5" aria-hidden /> Fill rooms by section
                  </Button>
                )}
                {placed > 0 && (
                  <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => clearRooms(tripId))}>
                    <Eraser className="size-3.5" aria-hidden /> Clear all
                  </Button>
                )}
              </div>
            )
          }
        />
        {editable && (
          <div className="border-b border-line px-5 py-3">
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant={adding === "many" ? "primary" : "secondary"} onClick={() => setAdding(adding === "many" ? null : "many")}>
                <Plus className="size-3.5" aria-hidden /> Add several rooms
              </Button>
              <Button size="sm" variant={adding === "one" ? "primary" : "secondary"} onClick={() => setAdding(adding === "one" ? null : "one")}>
                <Plus className="size-3.5" aria-hidden /> Add one room
              </Button>
            </div>
            {adding === "many" && <BulkRoomForm tripId={tripId} onDone={() => setAdding(null)} />}
            {adding === "one" && (
              <div className="mt-3 max-w-md">
                <RoomForm tripId={tripId} onDone={() => setAdding(null)} />
              </div>
            )}
          </div>
        )}
        {state?.message && (
          <div className="px-5 pt-4">
            <FormMessage state={state} />
          </div>
        )}
        {rooms.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">No rooms yet.</p>
        ) : (
          <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
            {rooms.map((r) =>
              editing === r.id ? (
                <RoomForm key={r.id} tripId={tripId} room={r} onDone={() => setEditing(null)} />
              ) : (
                <RoomCard key={r.id} room={r} editable={editable} onEdit={() => setEditing(r.id)} onRemove={() => start(() => removeRoom(r.id))} />
              ),
            )}
          </div>
        )}
      </Card>

      {rooms.length > 0 && unassigned.length > 0 && (
        <Card className="overflow-hidden border-warning/50">
          <CardHeader title={`Without a bed (${unassigned.length})`} description="Place students by hand, or use “Fill rooms by section”." />
          {groupBySection(unassigned, (o) => o.section).map(([section, rows]) => (
            <div key={section}>
              <p className="border-y border-line bg-surface-2/50 px-5 py-1.5 text-[12px] font-semibold text-ink-2">
                {section} · {rows.length}
              </p>
              <ul className="divide-y divide-line">
                {rows.map((o) => (
                  <UnassignedRow key={o.id} occupant={o} rooms={rooms} editable={editable} />
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function RoomCard({ room: r, editable, onEdit, onRemove }: { room: RoomView; editable: boolean; onEdit: () => void; onRemove: () => void }) {
  const [pending, start] = useTransition();
  const full = r.occupants.length >= r.beds;
  const sections = [...new Set(r.occupants.map((o) => o.section))];
  return (
    <div className={cx("rounded-xl border p-4", full ? "border-good/40" : "border-line")}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="flex items-center gap-2 font-semibold">
            <BedDouble className="size-4 text-muted" aria-hidden /> {r.name}
          </p>
          {(r.place || r.notes) && <p className="mt-0.5 text-[12px] text-muted">{[r.place, r.notes].filter(Boolean).join(" · ")}</p>}
        </div>
        {editable && (
          <div className="flex gap-1">
            <button type="button" onClick={onEdit} className="rounded-lg p-1 text-muted hover:bg-surface-2" aria-label={`Edit ${r.name}`}>
              <Pencil className="size-3.5" />
            </button>
            <button type="button" onClick={onRemove} className="rounded-lg p-1 text-muted hover:bg-surface-2" aria-label={`Remove ${r.name}`}>
              <X className="size-4" />
            </button>
          </div>
        )}
      </div>
      <div className="mt-3 flex items-center gap-1" aria-label={`${r.occupants.length} of ${r.beds} beds filled`}>
        {Array.from({ length: r.beds }, (_, i) => (
          <span key={i} className={cx("h-2 flex-1 rounded-full", i < r.occupants.length ? "bg-accent" : "bg-accent/15")} />
        ))}
      </div>
      <p className="mt-1.5 text-[12px] text-muted tabular">
        {r.occupants.length}/{r.beds} beds{sections.length > 0 && ` · ${sections.join(", ")}`}
      </p>
      {r.occupants.length > 0 && (
        <ul className="mt-2 flex flex-col gap-1">
          {r.occupants.map((o) => (
            <li key={o.id} className="flex items-center gap-2 text-[13px]">
              <span className="min-w-0 flex-1 truncate">
                {o.fullName} <span className="font-mono text-[11px] text-muted">{o.rollNo}</span>
              </span>
              {editable && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(async () => void (await assignRoom(o.id, null)))}
                  className="rounded p-0.5 text-muted hover:bg-surface-2 hover:text-ink"
                  aria-label={`Take ${o.fullName} out of ${r.name}`}
                >
                  <X className="size-3.5" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function UnassignedRow({ occupant: o, rooms, editable }: { occupant: Occupant; rooms: RoomView[]; editable: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{o.fullName}</p>
        <p className="font-mono text-[12px] text-muted">{o.rollNo}</p>
      </div>
      {error && <span className="text-[12px] text-danger-ink">{error}</span>}
      {editable && (
        <select
          defaultValue=""
          disabled={pending}
          aria-label={`Room for ${o.fullName}`}
          onChange={(e) =>
            e.target.value &&
            start(async () => {
              const res = await assignRoom(o.id, Number(e.target.value));
              setError(res && !res.ok ? (res.message ?? null) : null);
            })
          }
          className={selectClass}
        >
          <option value="">Choose room…</option>
          {rooms.map((r) => {
            const free = r.beds - r.occupants.length;
            return (
              <option key={r.id} value={r.id} disabled={free <= 0}>
                {r.name} ({free > 0 ? `${free} free` : "full"})
              </option>
            );
          })}
        </select>
      )}
    </li>
  );
}

function RoomForm({ tripId, room, onDone }: { tripId: number; room?: RoomView; onDone: () => void }) {
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-accent/40 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await saveRoom(tripId, {
            id: room?.id,
            name: String(fd.get("name")),
            beds: String(fd.get("beds")),
            place: String(fd.get("place")),
            notes: String(fd.get("notes")),
          });
          setState(res);
          if (res?.ok) onDone();
        });
      }}
    >
      <div className="grid grid-cols-[minmax(0,1fr)_6rem] gap-2">
        <Input name="name" required maxLength={60} defaultValue={room?.name} placeholder="Room name / number" aria-label="Room name" autoFocus />
        <Input name="beds" type="number" min={1} max={50} required defaultValue={room?.beds ?? 4} aria-label="Beds" />
      </div>
      <Input name="place" maxLength={100} defaultValue={room?.place ?? ""} placeholder="Hotel / building, floor" aria-label="Place" />
      <Input name="notes" maxLength={200} defaultValue={room?.notes ?? ""} placeholder="Notes, e.g. attached bath, girls' floor" aria-label="Notes" />
      {state && !state.ok && <FormMessage state={state} />}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          Save
        </Button>
      </div>
    </form>
  );
}

function BulkRoomForm({ tripId, onDone }: { tripId: number; onDone: () => void }) {
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="mt-3 grid gap-3 rounded-xl border border-accent/40 p-3 sm:grid-cols-[repeat(4,minmax(0,1fr))_minmax(0,2fr)]"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await addRooms(tripId, {
            prefix: String(fd.get("prefix")),
            start: Number(fd.get("start")),
            count: Number(fd.get("count")),
            beds: Number(fd.get("beds")),
            place: String(fd.get("place")),
          });
          setState(res);
          if (res?.ok) onDone();
        });
      }}
    >
      <Field label="How many rooms">
        <Input name="count" type="number" min={1} max={100} required defaultValue={10} />
      </Field>
      <Field label="Beds each">
        <Input name="beds" type="number" min={1} max={50} required defaultValue={4} />
      </Field>
      <Field label="Name">
        <Input name="prefix" defaultValue="Room" maxLength={50} />
      </Field>
      <Field label="Numbers from">
        <Input name="start" type="number" min={0} defaultValue={1} />
      </Field>
      <Field label="Hotel / building">
        <Input name="place" maxLength={100} placeholder="e.g. PTDC Motel, 1st floor" />
      </Field>
      {state && !state.ok && (
        <div className="sm:col-span-5">
          <FormMessage state={state} />
        </div>
      )}
      <div className="flex justify-end gap-2 sm:col-span-5">
        <Button type="button" size="sm" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="sm" variant="primary" disabled={pending}>
          Add rooms
        </Button>
      </div>
    </form>
  );
}
