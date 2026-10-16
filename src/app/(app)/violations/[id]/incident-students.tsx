"use client";

import { useState, useTransition } from "react";
import { UserPlus } from "lucide-react";
import { Button, Input } from "@/components/ui";
import { addStudentToIncident } from "../actions";

export function AddToIncident({ caseId }: { caseId: number }) {
  const [roll, setRoll] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError(null);
        start(async () => {
          const res = await addStudentToIncident(caseId, roll);
          if (res.ok) setRoll("");
          else setError(res.error ?? "Couldn't add.");
        });
      }}
    >
      <div className="flex gap-2">
        <Input
          value={roll}
          onChange={(e) => setRoll(e.target.value)}
          required
          placeholder="Roll number (or last digits)"
          aria-label="Roll number of another student involved"
          className="font-mono uppercase placeholder:font-sans placeholder:normal-case"
        />
        <Button type="submit" variant="secondary" disabled={pending || !roll.trim()}>
          <UserPlus className="size-4" aria-hidden /> Add
        </Button>
      </div>
      {error && <p className="text-[13px] text-danger-ink">{error}</p>}
      <p className="text-[12px] text-muted">A case with the same details is opened for the added student.</p>
    </form>
  );
}
