"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { Ban, Lock, LockOpen, Pencil, Trash2, UserPlus, X } from "lucide-react";
import { Button, FormMessage, Input, buttonClass } from "@/components/ui";
import { addStaff, cancelTrip, deleteTrip, removeStaff, setTripRegistration, type FormState } from "../actions";

/** Edit / registration / cancel / delete buttons on the trip header. */
export function TripControls({ id, status, canDelete }: { id: number; status: string; canDelete: boolean }) {
  const [pending, start] = useTransition();
  const [mode, setMode] = useState<"idle" | "cancel" | "delete">("idle");
  const [reason, setReason] = useState("");
  const [state, setState] = useState<FormState>(null);
  const before = status === "OPEN" || status === "CLOSED";

  if (mode === "cancel") {
    return (
      <form
        className="flex w-full flex-col gap-2 sm:w-96"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await cancelTrip(id, reason);
            setState(res);
            if (res?.ok) setMode("idle");
          });
        }}
      >
        <Input value={reason} onChange={(e) => setReason(e.target.value)} autoFocus maxLength={300} placeholder="Reason, e.g. Postponed due to weather" />
        <FormMessage state={state} />
        <div className="flex justify-end gap-2">
          <Button type="button" size="sm" variant="ghost" onClick={() => setMode("idle")}>
            Back
          </Button>
          <Button type="submit" size="sm" variant="danger" disabled={pending}>
            Cancel trip
          </Button>
        </div>
      </form>
    );
  }
  if (mode === "delete") {
    return (
      <div className="flex items-center gap-2 rounded-lg bg-critical/5 px-3 py-2">
        <span className="text-[13px] text-danger-ink">Delete this trip and its student list?</span>
        <Button size="sm" variant="ghost" onClick={() => setMode("idle")}>
          Keep
        </Button>
        <Button size="sm" variant="danger" disabled={pending} onClick={() => start(() => deleteTrip(id))}>
          Delete
        </Button>
      </div>
    );
  }
  return (
    <>
      {before && (
        <Link href={`/trips/${id}/edit`} className={buttonClass("secondary")}>
          <Pencil className="size-4" aria-hidden /> Edit
        </Link>
      )}
      {status === "OPEN" && (
        <Button disabled={pending} onClick={() => start(() => setTripRegistration(id, false))}>
          <Lock className="size-4" aria-hidden /> Close registration
        </Button>
      )}
      {status === "CLOSED" && (
        <Button disabled={pending} onClick={() => start(() => setTripRegistration(id, true))}>
          <LockOpen className="size-4" aria-hidden /> Reopen registration
        </Button>
      )}
      {before && (
        <Button variant="ghost" onClick={() => setMode("cancel")}>
          <Ban className="size-4" aria-hidden /> Cancel trip
        </Button>
      )}
      {canDelete && (
        <Button variant="ghost" className="text-danger-ink" onClick={() => setMode("delete")}>
          <Trash2 className="size-4" aria-hidden /> Delete
        </Button>
      )}
    </>
  );
}

const ROLES = ["In-charge", "Assistant", "Female staff escort", "Sports coach", "Medical / first aid"];

export function StaffPanel({
  tripId,
  staff,
  editable,
}: {
  tripId: number;
  staff: { id: number; name: string; phone: string | null; role: string }[];
  editable: boolean;
}) {
  const [pending, start] = useTransition();
  const [state, setState] = useState<FormState>(null);
  return (
    <div>
      {staff.length === 0 ? (
        <p className="px-5 py-4 text-[13px] text-muted">No accompanying staff added yet.</p>
      ) : (
        <ul className="divide-y divide-line">
          {staff.map((s) => (
            <li key={s.id} className="flex items-center gap-3 px-5 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">{s.name}</p>
                <p className="text-[12px] text-muted">
                  {s.role}
                  {s.phone && ` · ${s.phone}`}
                </p>
              </div>
              {editable && (
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => start(() => removeStaff(s.id))}
                  className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-ink"
                  aria-label={`Remove ${s.name}`}
                >
                  <X className="size-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {editable && (
        <form
          className="grid grid-cols-2 gap-2 border-t border-line p-4"
          onSubmit={(e) => {
            e.preventDefault();
            const form = e.currentTarget;
            const fd = new FormData(form);
            start(async () => {
              const res = await addStaff(tripId, { name: String(fd.get("name")), phone: String(fd.get("phone")), role: String(fd.get("role")) });
              setState(res);
              if (res?.ok) form.reset();
            });
          }}
        >
          <Input name="name" placeholder="Staff name" aria-label="Staff name" maxLength={100} required className="col-span-2" />
          <Input name="phone" type="tel" placeholder="Phone" aria-label="Phone" maxLength={20} />
          <select name="role" aria-label="Role" className="h-10 rounded-lg border border-line bg-surface px-2 text-sm shadow-card">
            {ROLES.map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <Button type="submit" disabled={pending} className="col-span-2">
            <UserPlus className="size-4" aria-hidden /> Add staff member
          </Button>
          {state && !state.ok && (
            <div className="col-span-2">
              <FormMessage state={state} />
            </div>
          )}
        </form>
      )}
    </div>
  );
}
