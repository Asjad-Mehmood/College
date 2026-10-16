"use client";

import { useState, useTransition } from "react";
import { Check, CheckCircle2, Circle, Phone } from "lucide-react";
import { Avatar, Button, Card, FormMessage, Input, Pill, Textarea, cx } from "@/components/ui";
import { finishRollCall, markRollCall, type FormState } from "../actions";

export type RollCallRow = {
  id: number;
  fullName: string;
  rollNo: string;
  className: string;
  photoUrl: string | null;
  vehicleId: number | null;
  vehicleName: string | null;
  consentMissing: boolean;
  feeDue: boolean;
  phone: string;
  departed: boolean;
  returned: boolean;
};

export function RollCall({
  tripId,
  phase,
  rows,
  vehicles,
  editable,
}: {
  tripId: number;
  phase: "departure" | "return";
  rows: RollCallRow[];
  vehicles: { id: number; name: string }[];
  editable: boolean;
}) {
  // On the way back only the students who actually left are expected.
  const expected = phase === "return" ? rows.filter((r) => r.departed) : rows;
  const [present, setPresent] = useState<Set<number>>(
    () => new Set(expected.filter((r) => (phase === "departure" ? r.departed : r.returned)).map((r) => r.id)),
  );
  const [show, setShow] = useState<"all" | "missing" | "present">("all");
  const [vehicle, setVehicle] = useState<string>("");
  const [q, setQ] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [finishState, setFinishState] = useState<FormState>(null);
  const [pending, start] = useTransition();

  const missing = expected.length - present.size;
  const visible = expected.filter((r) => {
    if (vehicle && String(r.vehicleId ?? "none") !== vehicle) return false;
    if (show === "missing" && present.has(r.id)) return false;
    if (show === "present" && !present.has(r.id)) return false;
    const s = q.trim().toLowerCase();
    return !s || r.fullName.toLowerCase().includes(s) || r.rollNo.toLowerCase().includes(s);
  });

  function toggle(r: RollCallRow) {
    if (!editable) return;
    const next = !present.has(r.id);
    setPresent((s) => {
      const copy = new Set(s);
      if (next) copy.add(r.id);
      else copy.delete(r.id);
      return copy;
    });
    start(async () => {
      const res = await markRollCall(r.id, phase, next);
      if (!res?.ok) {
        setError(res?.message ?? "Couldn't save — check the connection.");
        setPresent((s) => {
          const copy = new Set(s);
          if (next) copy.delete(r.id);
          else copy.add(r.id);
          return copy;
        });
      } else setError(null);
    });
  }

  const pct = expected.length ? Math.round((present.size / expected.length) * 100) : 0;
  const verb = phase === "departure" ? "on board" : "back";

  return (
    <div className="flex flex-col gap-4">
      <Card className="sticky top-16 z-10 p-4 lg:top-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-medium tracking-wide text-muted uppercase">
              {phase === "departure" ? "Departure roll call" : "Return roll call"}
            </p>
            <p className="text-3xl font-semibold tabular">
              {present.size}
              <span className="text-lg font-normal text-muted"> / {expected.length} {verb}</span>
            </p>
          </div>
          <Pill tone={missing === 0 ? "good" : "warning"}>{missing === 0 ? "Everyone here" : `${missing} missing`}</Pill>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-accent/15" role="meter" aria-valuemin={0} aria-valuemax={expected.length} aria-valuenow={present.size} aria-label={`Students ${verb}`}>
          <div className={cx("h-full rounded-full transition-[width]", missing === 0 ? "bg-good" : "bg-accent")} style={{ width: `${pct}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {(["all", "missing", "present"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setShow(k)}
              className={cx("rounded-full px-3 py-1 text-[13px] font-medium", show === k ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2")}
            >
              {k === "all" ? "All" : k === "missing" ? `Missing (${missing})` : `${verb[0].toUpperCase()}${verb.slice(1)} (${present.size})`}
            </button>
          ))}
          {vehicles.length > 0 && (
            <select value={vehicle} onChange={(e) => setVehicle(e.target.value)} aria-label="Vehicle" className="h-8 rounded-lg border border-line bg-surface px-2 text-[13px]">
              <option value="">All vehicles</option>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
              <option value="none">No vehicle</option>
            </select>
          )}
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Find" aria-label="Find a student" className="h-8 w-36 text-[13px]" />
        </div>
        {error && <p className="mt-2 text-[13px] text-danger-ink">{error}</p>}
      </Card>

      <Card className="overflow-hidden">
        {visible.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Nobody in this list.</p>
        ) : (
          <ul className="divide-y divide-line">
            {visible.map((r) => {
              const here = present.has(r.id);
              return (
                <li key={r.id} className={cx("flex items-center", here && "bg-good/6")}>
                  <button
                    type="button"
                    onClick={() => toggle(r)}
                    disabled={!editable}
                    aria-pressed={here}
                    className="flex min-h-16 flex-1 items-center gap-3 px-4 py-2 text-left disabled:cursor-default sm:px-5"
                  >
                    {here ? <CheckCircle2 className="size-7 shrink-0 text-good" aria-hidden /> : <Circle className="size-7 shrink-0 text-line-strong" aria-hidden />}
                    <Avatar name={r.fullName} photoUrl={r.photoUrl} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-medium">{r.fullName}</span>
                      <span className="block truncate text-[12px] text-muted">
                        <span className="font-mono">{r.rollNo}</span> · {r.className}
                        {r.vehicleName && ` · ${r.vehicleName}`}
                      </span>
                    </span>
                    {phase === "departure" && r.consentMissing && <Pill tone="critical">No consent</Pill>}
                    {phase === "departure" && r.feeDue && <Pill tone="warning">Fee due</Pill>}
                  </button>
                  {!here && phase === "return" && (
                    <a href={`tel:${r.phone.replace(/[^\d+]/g, "")}`} className="mr-4 inline-flex size-10 items-center justify-center rounded-lg border border-line hover:bg-surface-2" aria-label={`Call ${r.fullName}'s parent`}>
                      <Phone className="size-4" />
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {editable && (
        <Card className="p-5">
          <p className="text-sm font-semibold">{phase === "departure" ? "Ready to leave?" : "Everyone back?"}</p>
          <p className="mt-0.5 text-[13px] text-muted">
            {missing > 0
              ? `${missing} ${missing === 1 ? "student is" : "students are"} not marked. Write a note (e.g. who stayed back and whether parents were told).`
              : phase === "departure"
                ? "Everyone registered is on board."
                : "Everyone who left has come back."}
          </p>
          <form
            className="mt-3 flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => setFinishState(await finishRollCall(tripId, phase, note)))
            }}
          >
            {missing > 0 && <Textarea value={note} onChange={(e) => setNote(e.target.value)} rows={2} maxLength={300} placeholder="Note" aria-label="Note" />}
            <FormMessage state={finishState?.ok ? null : finishState} />
            <Button type="submit" variant="primary" size="lg" disabled={pending}>
              <Check className="size-5" aria-hidden /> {phase === "departure" ? "Mark trip as departed" : "Close trip — all back"}
            </Button>
          </form>
        </Card>
      )}
    </div>
  );
}
