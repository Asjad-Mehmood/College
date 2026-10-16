"use client";

import { useState, useTransition, type FormEvent } from "react";

/**
 * Submits a form to a server action without React's automatic form reset,
 * so a validation error never wipes what the user typed. With
 * `resetOnSuccess`, the form is cleared only after a successful submit
 * (useful for "add another" forms).
 */
export function useFormAction<S extends { ok?: boolean } | null>(
  action: (prev: S, formData: FormData) => Promise<S>,
  initial: S,
  opts: { resetOnSuccess?: boolean } = {},
) {
  const [state, setState] = useState<S>(initial);
  const [pending, start] = useTransition();
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const formData = new FormData(form);
    start(async () => {
      const result = await action(state, formData);
      setState(result);
      if (result?.ok && opts.resetOnSuccess) form.reset();
    });
  }
  return [state, onSubmit, pending] as const;
}
