"use client";

import { Button, Card, Field, FormMessage, Input } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { setupAdmin } from "../actions";

export function SetupForm() {
  const [state, onSubmit, pending] = useFormAction(setupAdmin, null);
  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold">Set up the portal</h1>
          <p className="text-[13px] text-muted">
            Create the Discipline In-Charge account. You can add gate staff and the Principal afterwards.
          </p>
        </div>
        <Field label="College name">
          <Input name="collegeName" required placeholder="Government College, Lahore" />
        </Field>
        <Field label="Your full name">
          <Input name="fullName" required autoComplete="name" />
        </Field>
        <Field label="Email">
          <Input name="email" type="email" required autoCapitalize="none" autoComplete="email" maxLength={120} />
        </Field>
        <Field label="Password" hint="At least 8 characters.">
          <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
        </Field>
        <FormMessage state={state} />
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? "Creating…" : "Create account"}
        </Button>
      </form>
    </Card>
  );
}
