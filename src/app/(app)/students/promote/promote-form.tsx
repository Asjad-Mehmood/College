"use client";

import Link from "next/link";
import { Button, FormMessage, Input, buttonClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { promoteSession, type PromoteState } from "./actions";

export function PromoteForm() {
  const [state, onSubmit, pending] = useFormAction<PromoteState>(promoteSession, null);
  if (state?.ok) {
    return (
      <div className="flex flex-col gap-3">
        <FormMessage state={state} />
        <div className="flex gap-2">
          <Link href="/students" className={buttonClass("primary")}>
            Back to students
          </Link>
          <Link href="/settings#import" className={buttonClass("secondary")}>
            Import the new 1st year
          </Link>
        </div>
      </div>
    );
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="recycle" defaultChecked className="mt-0.5 size-4.5 accent-[var(--accent)]" />
        <span>
          <span className="font-medium">Reuse the old 2nd-year sections for the new 1st year</span>
          <span className="block text-[12px] text-muted">Untick to leave them without a year (you can delete empty sections later).</span>
        </span>
      </label>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[13px] font-medium text-ink-2">
          Type PROMOTE to confirm
          <Input name="confirm" required autoComplete="off" className="w-48 font-mono uppercase" />
        </label>
        <Button type="submit" variant="danger" disabled={pending}>
          {pending ? "Promoting…" : "Promote all classes"}
        </Button>
      </div>
      <FormMessage state={state} />
    </form>
  );
}
