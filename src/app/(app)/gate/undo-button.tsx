"use client";

import { useState, useTransition } from "react";
import { Undo2 } from "lucide-react";
import { undoLateArrival } from "./actions";

export function UndoButton({ id, name }: { id: number; name: string }) {
  const [confirm, setConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!confirm) {
    return (
      <button
        type="button"
        onClick={() => setConfirm(true)}
        className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
        aria-label={`Undo entry for ${name}`}
        title="Undo this entry"
      >
        <Undo2 className="size-3.5" aria-hidden />
      </button>
    );
  }
  return (
    <span className="flex items-center gap-1 text-[12px]">
      {error && <span className="text-danger-ink">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => start(async () => {
          const res = await undoLateArrival(id);
          if (!res.ok) setError(res.error ?? "Failed");
        })}
        className="rounded-md bg-critical/10 px-2 py-0.5 font-medium text-danger-ink hover:bg-critical/20"
      >
        {pending ? "Removing…" : "Remove"}
      </button>
      <button type="button" onClick={() => setConfirm(false)} className="px-1 text-muted hover:text-ink">
        Keep
      </button>
    </span>
  );
}
