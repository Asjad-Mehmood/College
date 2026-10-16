"use client";

import { useState, useTransition } from "react";
import { ArrowRight, Bus, Pencil, Plus, Shuffle, X } from "lucide-react";
import { Button, Card, CardHeader, FormMessage, Input, Pill, cx } from "@/components/ui";
import { groupBySection } from "@/lib/sections";
import {
  assignSectionToVehicle,
  assignVehicle,
  autoAssign,
  removeVehicle,
  saveVehicle,
  sendHeldAsideTo,
  type FormState,
} from "../actions";

export type VehicleView = { id: number; name: string; driverName: string | null; driverPhone: string | null; seats: number | null; used: number };
export type RiderView = { id: number; fullName: string; rollNo: string; section: string; program: string; vehicleId: number | null };

const selectClass = "h-9 rounded-lg border border-line bg-surface px-2 text-[13px] shadow-card";

export function TransportPanel({
  tripId,
  vehicles,
  riders,
  editable,
}: {
  tripId: number;
  vehicles: VehicleView[];
  riders: RiderView[];
  editable: boolean;
}) {
  const [editing, setEditing] = useState<number | "new" | null>(vehicles.length === 0 ? "new" : null);
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<FormState>) => start(async () => setState(await fn()));
  const held = riders.filter((r) => r.vehicleId == null);
  const sections = groupBySection(riders, (r) => r.section);
  const vehicleName = new Map(vehicles.map((v) => [v.id, v.name]));
  const [overflow, setOverflow] = useState<string>(vehicles.at(-1) ? String(vehicles.at(-1)!.id) : "");

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader
          title="Vehicles"
          description={`${riders.length} students · ${held.length} without a seat`}
          actions={
            editable &&
            vehicles.length > 0 &&
            held.length > 0 && (
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => autoAssign(tripId))} title="Fill buses in order, ignoring sections">
                <Shuffle className="size-3.5" aria-hidden /> Quick fill
              </Button>
            )
          }
        />
        <div className="grid gap-3 p-4 sm:grid-cols-2 xl:grid-cols-3">
          {vehicles.map((v) =>
            editing === v.id ? (
              <VehicleForm key={v.id} tripId={tripId} vehicle={v} onDone={() => setEditing(null)} />
            ) : (
              <div key={v.id} className="rounded-xl border border-line p-4">
                <div className="flex items-start justify-between gap-2">
                  <p className="flex items-center gap-2 font-semibold">
                    <Bus className="size-4 text-muted" aria-hidden /> {v.name}
                  </p>
                  {editable && (
                    <div className="flex gap-1">
                      <button type="button" onClick={() => setEditing(v.id)} className="rounded-lg p-1 text-muted hover:bg-surface-2" aria-label={`Edit ${v.name}`}>
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => start(() => removeVehicle(v.id))} className="rounded-lg p-1 text-muted hover:bg-surface-2" aria-label={`Remove ${v.name}`}>
                        <X className="size-4" />
                      </button>
                    </div>
                  )}
                </div>
                <p className="mt-1 text-[13px] text-ink-2">
                  {v.driverName ?? "Driver not set"}
                  {v.driverPhone && ` · ${v.driverPhone}`}
                </p>
                <p className={cx("mt-2 text-[13px] font-medium tabular", v.seats != null && v.used >= v.seats ? "text-danger-ink" : "text-ink")}>
                  {v.used}
                  {v.seats != null ? ` / ${v.seats} seats` : " students"}
                </p>
                <p className="mt-1 text-[12px] text-muted">
                  {[...new Set(riders.filter((r) => r.vehicleId === v.id).map((r) => r.section))].join(", ") || "Empty"}
                </p>
              </div>
            ),
          )}
          {editable &&
            (editing === "new" ? (
              <VehicleForm tripId={tripId} onDone={() => setEditing(null)} />
            ) : (
              <button
                type="button"
                onClick={() => setEditing("new")}
                className="flex min-h-28 items-center justify-center gap-2 rounded-xl border-2 border-dashed border-line-strong/60 text-sm font-medium text-ink-2 hover:border-accent/50 hover:text-accent-ink"
              >
                <Plus className="size-4" aria-hidden /> Add vehicle
              </button>
            ))}
        </div>
      </Card>

      {state?.message && <FormMessage state={state} />}

      {vehicles.length > 0 && sections.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="Buses by section" description="Choose one bus for each section. Students who don't fit are held aside for the overflow bus." />
          <ul className="divide-y divide-line">
            {sections.map(([section, rows]) => {
              const counts = new Map<number | null, number>();
              for (const r of rows) counts.set(r.vehicleId, (counts.get(r.vehicleId) ?? 0) + 1);
              const main = [...counts.entries()].filter(([id]) => id != null).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
              const heldHere = counts.get(null) ?? 0;
              return (
                <li key={section} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold">{section}</p>
                    <p className="text-[12px] text-muted">
                      {rows.length} {rows.length === 1 ? "student" : "students"} ·{" "}
                      {[...counts.entries()]
                        .filter(([id]) => id != null)
                        .map(([id, n]) => `${n} on ${vehicleName.get(id!)}`)
                        .join(" · ") || "no bus yet"}
                    </p>
                  </div>
                  {heldHere > 0 && <Pill tone="warning">{heldHere} held aside</Pill>}
                  {editable ? (
                    <select
                      key={`${section}-${main}`}
                      defaultValue={main ?? ""}
                      disabled={pending}
                      aria-label={`Bus for section ${section}`}
                      onChange={(e) => run(() => assignSectionToVehicle(tripId, section, e.target.value ? Number(e.target.value) : null))}
                      className={selectClass}
                    >
                      <option value="">No bus</option>
                      {vehicles.map((v) => (
                        <option key={v.id} value={v.id}>
                          {v.name}
                          {v.seats != null ? ` (${Math.max(0, v.seats - v.used)} free)` : ""}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-[13px] text-ink-2">{main ? vehicleName.get(main) : "No bus"}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {vehicles.length > 0 && held.length > 0 && (
        <Card className="border-warning/50">
          <CardHeader
            title={`Held aside (${held.length})`}
            description="Students who didn't fit their section's bus, or whose section has no bus yet."
            actions={
              editable && (
                <form
                  className="flex items-center gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (overflow) run(() => sendHeldAsideTo(tripId, Number(overflow)));
                  }}
                >
                  <select value={overflow} onChange={(e) => setOverflow(e.target.value)} aria-label="Overflow bus" className={selectClass}>
                    {vehicles.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.name}
                        {v.seats != null ? ` (${Math.max(0, v.seats - v.used)} free)` : ""}
                      </option>
                    ))}
                  </select>
                  <Button type="submit" size="sm" variant="primary" disabled={pending}>
                    Send all <ArrowRight className="size-3.5" aria-hidden />
                  </Button>
                </form>
              )
            }
          />
          <div className="flex flex-wrap gap-1.5 p-4">
            {held.map((r) => (
              <span key={r.id} className="rounded-full bg-surface-2 px-2.5 py-1 text-[12px]">
                {r.fullName} <span className="text-muted">· {r.section}</span>
              </span>
            ))}
          </div>
        </Card>
      )}

      {vehicles.length > 0 && riders.length > 0 && (
        <Card className="overflow-hidden">
          <CardHeader title="Seat list" description="Move individual students between buses." />
          {sections.map(([section, rows]) => (
            <div key={section}>
              <p className="border-y border-line bg-surface-2/50 px-5 py-1.5 text-[12px] font-semibold text-ink-2">
                {section} · {rows.length}
              </p>
              <ul className="divide-y divide-line">
                {rows.map((r) => (
                  <RiderRow key={r.id} rider={r} vehicles={vehicles} editable={editable} />
                ))}
              </ul>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

function RiderRow({ rider: r, vehicles, editable }: { rider: RiderView; vehicles: VehicleView[]; editable: boolean }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium">{r.fullName}</p>
        <p className="truncate text-[12px] text-muted">
          <span className="font-mono">{r.rollNo}</span> · {r.program}
        </p>
      </div>
      {error && <span className="text-[12px] text-danger-ink">{error}</span>}
      {editable ? (
        <select
          value={r.vehicleId ?? ""}
          disabled={pending}
          onChange={(e) =>
            start(async () => {
              const res = await assignVehicle(r.id, e.target.value ? Number(e.target.value) : null);
              setError(res && !res.ok ? (res.message ?? null) : null);
            })
          }
          aria-label={`Vehicle for ${r.fullName}`}
          className={cx("h-8 rounded-lg border border-line bg-surface px-2 text-[13px]", r.vehicleId == null && "border-warning/60 bg-warning/10")}
        >
          <option value="">Held aside</option>
          {vehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name}
            </option>
          ))}
        </select>
      ) : (
        <span className="text-[13px] text-ink-2">{vehicles.find((v) => v.id === r.vehicleId)?.name ?? "Held aside"}</span>
      )}
    </li>
  );
}

function VehicleForm({ tripId, vehicle, onDone }: { tripId: number; vehicle?: VehicleView; onDone: () => void }) {
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2 rounded-xl border border-accent/40 p-3"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await saveVehicle(tripId, {
            id: vehicle?.id,
            name: String(fd.get("name")),
            driverName: String(fd.get("driverName")),
            driverPhone: String(fd.get("driverPhone")),
            seats: String(fd.get("seats")),
          });
          setState(res);
          if (res?.ok) onDone();
        });
      }}
    >
      <Input name="name" required maxLength={60} defaultValue={vehicle?.name} placeholder="Bus / van, e.g. Coaster LEA-1234" aria-label="Vehicle" autoFocus />
      <div className="grid grid-cols-2 gap-2">
        <Input name="driverName" maxLength={100} defaultValue={vehicle?.driverName ?? ""} placeholder="Driver" aria-label="Driver name" />
        <Input name="driverPhone" type="tel" maxLength={20} defaultValue={vehicle?.driverPhone ?? ""} placeholder="Driver phone" aria-label="Driver phone" />
      </div>
      <Input name="seats" type="number" min={1} max={200} defaultValue={vehicle?.seats ?? ""} placeholder="Seats" aria-label="Seats" />
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
