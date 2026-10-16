"use client";

import { useState, useTransition } from "react";
import { Archive, ArchiveRestore, GraduationCap, Plus, Trash2, Undo2 } from "lucide-react";
import { Button, Field, FormMessage, Input, Pill } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { createBatch, createYear, deleteBatch, setBatchPassedOut, setYearClosed, type YearsState } from "./years-actions";

type Year = { id: number; name: string; label: string; closed: boolean; current: boolean };
type Batch = { id: number; name: string; passedOut: boolean; students: number; active: number };

export function YearsAndBatches({ years, batches, nextYearFrom }: { years: Year[]; batches: Batch[]; nextYearFrom: string }) {
  const [pending, start] = useTransition();
  const [confirm, setConfirm] = useState<number | null>(null);
  const [yearState, onYear, yearPending] = useFormAction<YearsState>(createYear, null, { resetOnSuccess: true });
  const [batchState, onBatch, batchPending] = useFormAction<YearsState>(createBatch, null, { resetOnSuccess: true });
  const nextTo = `${Number(nextYearFrom.slice(0, 4)) + 1}-07-31`;

  return (
    <div className="grid gap-6 p-5 2xl:grid-cols-2">
      <section>
        <p className="mb-2 text-sm font-semibold">Academic years</p>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {years.map((y) => (
            <li key={y.id} className="flex items-center gap-3 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {y.name} {y.current && <Pill tone="accent">Current</Pill>} {y.closed && <Pill>Archived</Pill>}
                </span>
                <span className="block text-[12px] text-muted">{y.label}</span>
              </span>
              <Button size="sm" variant="ghost" disabled={pending} onClick={() => start(() => setYearClosed(y.id, !y.closed))}>
                {y.closed ? <ArchiveRestore className="size-3.5" aria-hidden /> : <Archive className="size-3.5" aria-hidden />}
                {y.closed ? "Reopen" : "Close year"}
              </Button>
            </li>
          ))}
        </ul>
        <form onSubmit={onYear} className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Starts">
            <Input name="from" type="date" required defaultValue={nextYearFrom} />
          </Field>
          <Field label="Ends">
            <Input name="to" type="date" required defaultValue={nextTo} />
          </Field>
          <div className="col-span-2 flex items-center justify-between gap-2">
            <FormMessage state={yearState} />
            <Button type="submit" size="sm" disabled={yearPending}>
              <Plus className="size-3.5" aria-hidden /> Add year
            </Button>
          </div>
        </form>
        <p className="mt-2 text-[12px] text-muted">A closed year becomes an archive: its records can be viewed and printed but not changed.</p>
      </section>

      <section>
        <p className="mb-2 text-sm font-semibold">Batches</p>
        <ul className="divide-y divide-line rounded-xl border border-line">
          {batches.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center gap-2 px-3 py-2.5">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium">
                  {b.name} {b.passedOut && <Pill>Passed out</Pill>}
                </span>
                <span className="block text-[12px] text-muted">
                  {b.students} students{b.passedOut ? "" : ` · ${b.active} active`}
                </span>
              </span>
              {confirm === b.id ? (
                <span className="flex items-center gap-1 text-[12px]">
                  {b.passedOut ? "Make its students active again?" : `Mark ${b.active} students graduated?`}
                  <Button size="sm" variant="primary" disabled={pending} onClick={() => start(async () => { await setBatchPassedOut(b.id, !b.passedOut); setConfirm(null); })}>
                    Yes
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(null)}>
                    No
                  </Button>
                </span>
              ) : (
                <>
                  <Button size="sm" variant="ghost" onClick={() => setConfirm(b.id)}>
                    {b.passedOut ? <Undo2 className="size-3.5" aria-hidden /> : <GraduationCap className="size-3.5" aria-hidden />}
                    {b.passedOut ? "Undo" : "Passed out"}
                  </Button>
                  {b.students === 0 && (
                    <button type="button" disabled={pending} onClick={() => start(async () => void (await deleteBatch(b.id)))} className="rounded-lg p-1.5 text-muted hover:text-danger-ink" aria-label={`Delete ${b.name}`}>
                      <Trash2 className="size-4" />
                    </button>
                  )}
                </>
              )}
            </li>
          ))}
          {batches.length === 0 && <li className="px-3 py-3 text-[13px] text-muted">No batches yet.</li>}
        </ul>
        <form onSubmit={onBatch} className="mt-3 flex items-end gap-2">
          <Field label="Year the batch joined" className="flex-1">
            <Input name="startYear" type="number" min={2000} max={2100} required defaultValue={nextYearFrom.slice(0, 4)} />
          </Field>
          <Button type="submit" size="sm" disabled={batchPending} className="mb-0.5">
            <Plus className="size-3.5" aria-hidden /> Add batch
          </Button>
        </form>
        <FormMessage state={batchState} />
        <p className="mt-2 text-[12px] text-muted">New students are put in a batch when added or imported. “Passed out” graduates the whole batch.</p>
      </section>
    </div>
  );
}
