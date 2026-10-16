"use client";

import { useState, useTransition } from "react";
import { Pencil, Plus } from "lucide-react";
import type { Severity } from "@/generated/prisma/enums";
import { Button, FormMessage, Input, Pill, Select, StrikeBadge, cx, fieldClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { SEVERITY_LABELS, SEVERITY_LEVEL } from "@/lib/labels";
import { saveViolationType, setViolationTypeActive, type SettingsState } from "./actions";

type TypeRow = { id: number; name: string; severity: Severity; defaultFineAmount: number; active: boolean; uses: number };

export function ViolationTypes({ types }: { types: TypeRow[] }) {
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <div>
      <ul className="divide-y divide-line">
        {types.map((t) =>
          editing === t.id ? (
            <li key={t.id} className="px-5 py-3">
              <TypeForm type={t} onDone={() => setEditing(null)} />
            </li>
          ) : (
            <TypeItem key={t.id} type={t} onEdit={() => setEditing(t.id)} />
          ),
        )}
      </ul>
      <div className="border-t border-line p-5">
        <p className="mb-3 text-sm font-semibold">Add a violation type</p>
        <TypeForm />
      </div>
    </div>
  );
}

function TypeItem({ type: t, onEdit }: { type: TypeRow; onEdit: () => void }) {
  const [pending, start] = useTransition();
  return (
    <li className={cx("flex flex-wrap items-center gap-3 px-5 py-3", !t.active && "opacity-60")}>
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {t.name}
          {!t.active && <Pill>Inactive</Pill>}
        </p>
        <p className="text-[12px] text-muted">
          {t.defaultFineAmount > 0 ? `Default fine Rs. ${t.defaultFineAmount}` : "No default fine"} · used {t.uses}×
        </p>
      </div>
      <StrikeBadge level={SEVERITY_LEVEL[t.severity]} label={SEVERITY_LABELS[t.severity]} />
      <Button size="sm" variant="ghost" onClick={onEdit} aria-label={`Edit ${t.name}`}>
        <Pencil className="size-3.5" aria-hidden />
      </Button>
      <Button size="sm" disabled={pending} onClick={() => start(() => setViolationTypeActive(t.id, !t.active))}>
        {t.active ? "Deactivate" : "Activate"}
      </Button>
    </li>
  );
}

function TypeForm({ type, onDone }: { type?: TypeRow; onDone?: () => void }) {
  const [state, onSubmit, pending] = useFormAction<SettingsState>(
    async (prev, fd) => {
      const res = await saveViolationType(prev, fd);
      if (res?.ok) onDone?.();
      return res;
    },
    null,
    { resetOnSuccess: !type },
  );
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2">
      {type && <input type="hidden" name="id" value={type.id} />}
      <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem_7rem_auto]">
        <Input name="name" required maxLength={80} defaultValue={type?.name} placeholder="e.g. Mobile phone in class" aria-label="Violation name" />
        <Select name="severity" defaultValue={type?.severity ?? "MINOR"} aria-label="Severity">
          <option value="MINOR">Minor</option>
          <option value="MAJOR">Major</option>
          <option value="SEVERE">Severe</option>
        </Select>
        <div className="relative">
          <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[13px] text-muted">Rs.</span>
          <input
            name="defaultFineAmount"
            type="number"
            min={0}
            step={50}
            defaultValue={type?.defaultFineAmount ?? 0}
            aria-label="Default fine"
            className={fieldClass("pl-10")}
          />
        </div>
        <div className="flex gap-2">
          {type && (
            <Button type="button" variant="ghost" onClick={onDone}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant={type ? "primary" : "secondary"} disabled={pending}>
            {type ? "Save" : (
              <>
                <Plus className="size-4" aria-hidden /> Add
              </>
            )}
          </Button>
        </div>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
