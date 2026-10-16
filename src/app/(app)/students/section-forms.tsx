"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Button, Card, CardHeader, Field, FormMessage, Input, Select } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { createSection, deleteSection, updateSection, type StudentFormState } from "./actions";

export function NewSectionForm() {
  const [state, onSubmit, pending] = useFormAction<StudentFormState>(createSection, null, { resetOnSuccess: true });
  return (
    <Card>
      <CardHeader title="Add a section" description="Create sections first, then choose one when adding a student." />
      <form onSubmit={onSubmit} className="grid gap-3 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end">
        <Field label="Section name">
          <Input name="name" required maxLength={20} placeholder="e.g. CD1 or CD 54" />
        </Field>
        <Field label="Year">
          <Select name="year" required defaultValue="">
            <option value="" disabled>
              Choose…
            </option>
            <option value="FIRST">1st year</option>
            <option value="SECOND">2nd year</option>
          </Select>
        </Field>
        <Button type="submit" variant="primary" disabled={pending}>
          <Plus className="size-4" aria-hidden /> Add section
        </Button>
        <div className="sm:col-span-3">
          <FormMessage state={state} />
        </div>
      </form>
    </Card>
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
