"use client";

import { useRef, useState, useTransition } from "react";
import { Banknote, IdCard, Pencil, Trash2, X } from "lucide-react";
import type { CardStatus, DisciplineAction, LateReason } from "@/generated/prisma/enums";
import {
  deleteRecord,
  setCardStatus,
  setFinePaid,
  updateRecord,
  type ActionResult,
} from "@/app/(app)/records/actions";
import { Button, Field, FormMessage, Input, Select, Textarea, cx } from "@/components/ui";
import { ACTION_LABELS, REASONS } from "@/lib/labels";

export type ManagedRecord = {
  id: number;
  fullName: string;
  dateLabel: string;
  reason: LateReason;
  actionTaken: DisciplineAction;
  cardStatus: CardStatus;
  fineAmount: number;
  finePaid: boolean;
  remarks: string | null;
};

const RETURN_NOTES = [
  "Returned after parent call",
  "Returned after fine payment",
  "Returned after written warning",
  "Returned after parent meeting",
];

/** "Manage" button + dialog for the Discipline In-Charge to update a record. */
export function RecordManager({ record, compact }: { record: ManagedRecord; compact?: boolean }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [result, setResult] = useState<ActionResult | null>(null);
  const [pending, startTransition] = useTransition();
  const [returnNote, setReturnNote] = useState(RETURN_NOTES[0]);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function run(fn: () => Promise<ActionResult>, close = false) {
    startTransition(async () => {
      const res = await fn();
      setResult(res);
      if (res.ok && close) dialogRef.current?.close();
    });
  }

  function open() {
    setResult(null);
    setConfirmDelete(false);
    dialogRef.current?.showModal();
  }

  return (
    <>
      <Button size="sm" onClick={open} aria-label={`Manage record for ${record.fullName}`}>
        <Pencil className="size-3.5" aria-hidden />
        {!compact && "Manage"}
      </Button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(32rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-black/50"
      >
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div>
            <p className="font-semibold">Manage late record</p>
            <p className="text-[13px] text-muted">
              {record.fullName} · {record.dateLabel}
            </p>
          </div>
          <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        <div className="flex max-h-[70vh] flex-col gap-5 overflow-y-auto px-5 py-4">
          <FormMessage state={result} />

          {/* ID card custody */}
          <section className="rounded-xl border border-line p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <IdCard className="size-4 text-muted" aria-hidden /> ID card custody
            </h3>
            {record.cardStatus === "HELD" ? (
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <Select value={returnNote} onChange={(e) => setReturnNote(e.target.value)} aria-label="Return note">
                  {RETURN_NOTES.map((n) => (
                    <option key={n}>{n}</option>
                  ))}
                </Select>
                <Button variant="primary" disabled={pending} onClick={() => run(() => setCardStatus(record.id, "RETURNED", returnNote))}>
                  Mark returned
                </Button>
              </div>
            ) : (
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[13px] text-ink-2">
                  {record.cardStatus === "RETURNED" ? "Card has been returned." : "Card is not held."}
                </p>
                <Button disabled={pending} onClick={() => run(() => setCardStatus(record.id, "HELD"))}>
                  Mark as held
                </Button>
              </div>
            )}
          </section>

          {/* Fine */}
          {record.fineAmount > 0 && (
            <section className="rounded-xl border border-line p-4">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Banknote className="size-4 text-muted" aria-hidden /> Fine of Rs. {record.fineAmount}
              </h3>
              <div className="mt-3 flex items-center justify-between gap-3">
                <p className="text-[13px] text-ink-2">{record.finePaid ? "Paid." : "Not paid yet."}</p>
                <Button
                  variant={record.finePaid ? "secondary" : "primary"}
                  disabled={pending}
                  onClick={() => run(() => setFinePaid(record.id, !record.finePaid))}
                >
                  {record.finePaid ? "Mark unpaid" : "Mark paid"}
                </Button>
              </div>
            </section>
          )}

          {/* Edit details */}
          <form
            className="flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              const fd = new FormData(e.currentTarget);
              run(() =>
                updateRecord(record.id, {
                  reason: fd.get("reason") as LateReason,
                  actionTaken: fd.get("actionTaken") as DisciplineAction,
                  fineAmount: Number(fd.get("fineAmount")),
                  remarks: String(fd.get("remarks") ?? ""),
                }),
              );
            }}
          >
            <h3 className="text-sm font-semibold">Details</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Reason">
                <Select name="reason" defaultValue={record.reason}>
                  {REASONS.map((r) => (
                    <option key={r.value} value={r.value}>
                      {r.label}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label="Action taken">
                <Select name="actionTaken" defaultValue={record.actionTaken}>
                  {Object.entries(ACTION_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <Field label="Fine amount (Rs.)" hint="0 for no fine">
              <Input name="fineAmount" type="number" min={0} step={50} defaultValue={record.fineAmount} />
            </Field>
            <Field label="Remarks">
              <Textarea name="remarks" defaultValue={record.remarks ?? ""} maxLength={1000} />
            </Field>
            <div className="flex justify-end">
              <Button type="submit" variant="primary" disabled={pending}>
                Save changes
              </Button>
            </div>
          </form>
        </div>

        <div className={cx("flex items-center justify-between gap-3 border-t border-line px-5 py-3", confirmDelete && "bg-critical/5")}>
          {confirmDelete ? (
            <>
              <p className="text-[13px] text-danger-ink">Delete this record permanently?</p>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(false)}>
                  Keep
                </Button>
                <Button size="sm" variant="danger" disabled={pending} onClick={() => run(() => deleteRecord(record.id), true)}>
                  Delete
                </Button>
              </div>
            </>
          ) : (
            <Button size="sm" variant="ghost" onClick={() => setConfirmDelete(true)} className="text-danger-ink">
              <Trash2 className="size-3.5" aria-hidden /> Delete record
            </Button>
          )}
        </div>
      </dialog>
    </>
  );
}
