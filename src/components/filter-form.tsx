"use client";

import { useRouter } from "next/navigation";
import { useRef, type ReactNode } from "react";

/**
 * A GET form that navigates on every change (and on Enter in the search box),
 * so filters apply instantly but the URL stays shareable.
 */
export function FilterForm({ action, children, className }: { action: string; children: ReactNode; className?: string }) {
  const router = useRouter();
  const ref = useRef<HTMLFormElement>(null);

  function go() {
    const form = ref.current;
    if (!form) return;
    const params = new URLSearchParams();
    for (const [key, value] of new FormData(form)) {
      if (typeof value === "string" && value !== "") params.set(key, value);
    }
    const qs = params.toString();
    router.replace(qs ? `${action}?${qs}` : action, { scroll: false });
  }

  return (
    <form
      ref={ref}
      action={action}
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        go();
      }}
      onChange={(e) => {
        // Search text applies on Enter; everything else applies immediately.
        if ((e.target as unknown as HTMLInputElement).type !== "search") go();
      }}
    >
      {children}
    </form>
  );
}

export function PrintButton({ children }: { children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-line bg-surface px-4 text-sm font-medium shadow-card hover:bg-surface-2"
    >
      {children}
    </button>
  );
}
