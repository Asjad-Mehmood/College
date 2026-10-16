"use client";

import { useActionState } from "react";
import { LogIn } from "lucide-react";
import { Button, Card, Field, FormMessage, Input } from "@/components/ui";
import { login } from "../actions";

export function LoginForm() {
  const [state, action, pending] = useActionState(login, null);
  return (
    <Card className="p-6">
      <form action={action} className="flex flex-col gap-4">
        <div>
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="text-[13px] text-muted">Use the account given by the Discipline In-Charge.</p>
        </div>
        <Field label="Username">
          <Input name="username" autoComplete="username" autoCapitalize="none" required autoFocus />
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
