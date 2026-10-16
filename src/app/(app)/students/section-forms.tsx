"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { GraduationCap, Pencil, Plus, Trash2, X } from "lucide-react";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { createProgram, createSection, deleteProgram, deleteSection, updateSection, type StudentFormState } from "./actions";

function DialogShell({ dialogRef, title, description, children }: { dialogRef: React.RefObject<HTMLDialogElement | null>; title: string; description?: string; children: React.ReactNode }) {
  return (
    <dialog
      ref={dialogRef}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-black/50"
    >
      <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
        <div>
          <p className="font-semibold">{title}</p>
          {description && <p className="mt-0.5 text-[13px] text-ink-2">{description}</p>}
        </div>
        <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label="Close">
          <X className="size-5" />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function NewSectionDialog() {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, onSubmit, pending] = useFormAction<StudentFormState>(createSection, null, { resetOnSuccess: true });
  useEffect(() => {
    if (state?.ok) dialogRef.current?.close();
  }, [state]);
  return (
    <>
      <Button variant="secondary" onClick={() => dialogRef.current?.showModal()}>
        <Plus className="size-4" aria-hidden /> Add section
      </Button>
      <DialogShell dialogRef={dialogRef} title="Add a section" description="Create sections first, then choose one when adding a student.">
        <form onSubmit={onSubmit}>
          <div className="grid gap-3 px-5 py-4 sm:grid-cols-2">
            <Field label="Section name *">
              <Input name="name" required maxLength={20} placeholder="e.g. CD1 or CD 54" />
            </Field>
            <Field label="Year *">
              <Select name="year" required defaultValue="">
                <option value="" disabled>
                  Choose…
                </option>
                <option value="FIRST">1st year</option>
                <option value="SECOND">2nd year</option>
              </Select>
            </Field>
            <div className="sm:col-span-2">
              <FormMessage state={state} />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <Button type="button" variant="ghost" onClick={() => dialogRef.current?.close()}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Adding…" : "Add section"}
            </Button>
          </div>
        </form>
      </DialogShell>
    </>
  );
}

/** Rename / change year / delete, shown on a section's page. */
export function SectionSettings({ id, name, year, students }: { id: number; name: string; year: "FIRST" | "SECOND" | null; students: number }) {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<StudentFormState>(null);
  const [pending, start] = useTransition();
  if (!open) {
    return (
      <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" aria-hidden /> Edit section
      </Button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-2"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        start(async () => {
          const res = await updateSection(id, fd);
          setState(res);
          if (res?.ok) setOpen(false);
        });
      }}
    >
      <Input name="name" defaultValue={name} required maxLength={20} aria-label="Section name" className="h-9 w-32" />
      <Select name="year" defaultValue={year ?? ""} aria-label="Year" className="h-9 w-auto">
        <option value="">Year not set</option>
        <option value="FIRST">1st year</option>
        <option value="SECOND">2nd year</option>
      </Select>
      <Button type="submit" size="sm" variant="primary" disabled={pending}>
        Save
      </Button>
      <Button type="button" size="sm" variant="ghost" onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {students === 0 && (
        <Button type="button" size="sm" variant="danger" disabled={pending} onClick={() => start(async () => setState(await deleteSection(id)))}>
          <Trash2 className="size-3.5" aria-hidden /> Delete
        </Button>
      )}
      {state && !state.ok && <FormMessage state={state} />}
    </form>
  );
}

export function ProgramsDialog({ programs }: { programs: { id: number; name: string; students: number }[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [state, onSubmit, pending] = useFormAction<StudentFormState>(createProgram, null, { resetOnSuccess: true });
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  return (
    <>
      <Button variant="secondary" onClick={() => dialogRef.current?.showModal()}>
        <GraduationCap className="size-4" aria-hidden /> Programs
      </Button>
      <DialogShell dialogRef={dialogRef} title="Programs" description="The list offered when adding a student. A program can be removed once no student uses it.">
        <div className="flex flex-col gap-3 px-5 py-4">
          <div className="flex max-h-56 flex-wrap gap-2 overflow-y-auto">
            {programs.length === 0 && <p className="text-[13px] text-muted">No programs yet.</p>}
            {programs.map((p) => (
              <span key={p.id} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2/60 py-1 pr-1.5 pl-3 text-[13px]">
                {p.name} <span className="text-muted tabular">{p.students}</span>
                {p.students === 0 ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => start(async () => setError((await deleteProgram(p.id))?.ok ? null : "Couldn't remove."))}
                    className="rounded-full p-0.5 text-muted hover:bg-surface-3 hover:text-ink"
                    aria-label={`Remove ${p.name}`}
                  >
                    <X className="size-3.5" />
                  </button>
                ) : (
                  <span className="pr-1.5" />
                )}
              </span>
            ))}
          </div>
          <form onSubmit={onSubmit} className="flex gap-2">
            <Input name="name" required maxLength={50} placeholder="Add a program, e.g. DIT" aria-label="Program name" />
            <Button type="submit" variant="primary" disabled={pending}>
              <Plus className="size-4" aria-hidden /> Add
            </Button>
          </form>
          <FormMessage state={state} />
          {error && <p className="text-[13px] text-danger-ink">{error}</p>}
        </div>
        <div className="flex justify-end border-t border-line px-5 py-3">
          <Button type="button" variant="ghost" onClick={() => dialogRef.current?.close()}>
            Done
          </Button>
        </div>
      </DialogShell>
    </>
  );
}
