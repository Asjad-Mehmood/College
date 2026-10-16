"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { CheckCircle2, Pencil, RotateCcw, Trash2 } from "lucide-react";
import { Button, Input, buttonClass } from "@/components/ui";
import {
  closeViolation,
  deleteViolation,
  reopenViolation,
  setViolationFinePaid,
} from "../actions";

export function CaseActions({
  id,
  status,
  fineAmount,
  finePaid,
}: {
  id: number;
  status: "OPEN" | "CLOSED";
  fineAmount: number;
  finePaid: boolean;
}) {
  const [pending, start] = useTransition();
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div className="flex flex-col gap-4">
      {fineAmount > 0 && (
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm">
            Fine Rs. {fineAmount.toLocaleString()} · <span className="font-medium">{finePaid ? "Paid" : "Not paid"}</span>
          </p>
          <Button size="sm" variant={finePaid ? "secondary" : "primary"} disabled={pending} onClick={() => start(() => setViolationFinePaid(id, !finePaid))}>
            {finePaid ? "Mark unpaid" : "Mark paid"}
          </Button>
        </div>
      )}

      {status === "OPEN" ? (
        closing ? (
          <form
            className="flex flex-col gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              start(async () => {
                await closeViolation(id, note);
                setClosing(false);
              });
            }}
          >
            <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} autoFocus placeholder="Closing note, e.g. Parent met the committee; undertaking signed" />
            <div className="flex justify-end gap-2">
              <Button type="button" size="sm" variant="ghost" onClick={() => setClosing(false)}>
                Cancel
              </Button>
              <Button type="submit" size="sm" variant="primary" disabled={pending}>
                Close case
              </Button>
            </div>
          </form>
        ) : (
          <Button variant="primary" onClick={() => setClosing(true)}>
            <CheckCircle2 className="size-4" aria-hidden /> Close case
          </Button>
        )
      ) : (
        <Button variant="secondary" disabled={pending} onClick={() => start(() => reopenViolation(id))}>
          <RotateCcw className="size-4" aria-hidden /> Reopen case
        </Button>
      )}

      <Link href={`/violations/${id}/edit`} className={buttonClass("secondary")}>
        <Pencil className="size-4" aria-hidden /> Edit details
      </Link>

      {confirmDelete ? (
        <div className="flex items-center justify-between gap-2 rounded-lg bg-critical/5 px-3 py-2">
          <span className="text-[13px] text-danger-ink">Delete this case permanently?</span>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Keep
            </Button>
            <Button size="sm" variant="danger" disabled={pending} onClick={() => start(() => deleteViolation(id))}>
              Delete
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="ghost" className="text-danger-ink" onClick={() => setConfirmDelete(true)}>
          <Trash2 className="size-4" aria-hidden /> Delete case
        </Button>
      )}
    </div>
  );
}
