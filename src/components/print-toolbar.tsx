"use client";

import { Printer, X } from "lucide-react";
import type { ReactNode } from "react";

export function PrintToolbar({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="no-print sticky top-0 z-10 border-b border-line bg-surface/95 backdrop-blur">
      <div className="mx-auto flex max-w-4xl flex-wrap items-center justify-between gap-3 px-4 py-3">
        <p className="text-sm font-semibold">{title}</p>
        <div className="flex flex-wrap items-center gap-2">
          {children}
          <button
            type="button"
            onClick={() => window.close()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-medium text-ink-2 hover:bg-surface-2"
          >
            <X className="size-4" aria-hidden /> Close
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-medium text-on-accent hover:bg-accent-hover"
          >
            <Printer className="size-4" aria-hidden /> Print
          </button>
        </div>
      </div>
    </div>
  );
}
