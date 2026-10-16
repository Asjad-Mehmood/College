"use client";

import { LogIn } from "lucide-react";
import { Button, Card, Field, FormMessage, Input } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { login } from "../actions";

export function LoginForm() {
  const [state, onSubmit, pending] = useFormAction(login, null);
  return (
    <Card className="p-6">
      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="text-[13px] text-muted">Use the account given by the Discipline In-Charge.</p>
        </div>
        <Field label="Email">
          <Input name="email" type="text" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} required autoFocus placeholder="you@college.edu.pk" />
        </Field>
        <Field label="Password">
          <Input name="password" type="password" autoComplete="current-password" required />
        </Field>
        <FormMessage state={state} />
        <Button type="submit" variant="primary" size="lg" disabled={pending} className="mt-1">
          <LogIn className="size-4.5" aria-hidden />
          {pending ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </Card>
  );
}
