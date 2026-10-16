"use client";

import { useState, useTransition } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, FormMessage, Select } from "@/components/ui";
import { addSportToEvent, deleteEvent, removeSportFromEvent, type FormState } from "../../actions";

export function AddSport({ eventId, sports }: { eventId: number; sports: { id: number; name: string }[] }) {
  const [sportId, setSportId] = useState("");
  const [state, setState] = useState<FormState>(null);
  const [pending, start] = useTransition();
  return (
    <Card>
      <CardHeader title="Add a sport to this event" description="Then open it to pick the players from the whole college." />
      <form
        className="flex flex-col gap-3 p-5"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await addSportToEvent(eventId, Number(sportId));
            setState(res);
            if (res?.ok) setSportId("");
          });
        }}
      >
        <div className="flex flex-wrap items-center gap-3">
          <Select value={sportId} onChange={(e) => setSportId(e.target.value)} required aria-label="Sport" className="max-w-64">
            <option value="" disabled>
              Choose a sport…
            </option>
            {sports.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </Select>
          <Button type="submit" variant="primary" disabled={pending || !sportId}>
            <Plus className="size-4" aria-hidden /> Add sport
          </Button>
        </div>
        <FormMessage state={state} />
      </form>
    </Card>
  );
}

export function RemoveSport({ eventId, sportId, name }: { eventId: number; sportId: number; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return confirm ? (
    <span className="flex items-center gap-2 text-[12px] text-danger-ink">
      Remove {name} and its players?
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
        Keep
      </Button>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => start(() => removeSportFromEvent(eventId, sportId))}>
        Remove
      </Button>
    </span>
  ) : (
    <button type="button" onClick={() => setConfirm(true)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-danger-ink" aria-label={`Remove ${name} from the event`}>
      <Trash2 className="size-4" />
    </button>
  );
}

export function DeleteEvent({ id }: { id: number }) {
  const [confirm, setConfirm] = useState(false);
  const [pending, start] = useTransition();
  return confirm ? (
    <span className="flex items-center gap-2 rounded-lg bg-critical/5 px-3 py-1.5 text-[13px] text-danger-ink">
      Delete this event and all its players?
      <Button size="sm" variant="ghost" onClick={() => setConfirm(false)}>
        Keep
      </Button>
      <Button size="sm" variant="danger" disabled={pending} onClick={() => start(() => deleteEvent(id))}>
        Delete
      </Button>
    </span>
  ) : (
    <Button variant="ghost" className="text-danger-ink" onClick={() => setConfirm(true)}>
      <Trash2 className="size-4" aria-hidden /> Delete event
    </Button>
  );
}
