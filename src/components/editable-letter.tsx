"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { PencilLine, RotateCcw } from "lucide-react";
import { cx } from "@/components/ui";

/**
 * A letter that can be edited on screen before printing. Changes are kept on
 * this device (per letter), so reopening the letter shows the edited text;
 * "Reset to original" brings back the generated wording.
 */
export function EditableLetter(props: { storageKey: string; className?: string; children: ReactNode }) {
  // A fresh editor per letter, so switching letters never mixes edits.
  return <Editor key={props.storageKey} {...props} />;
}

function Editor({ storageKey, className, children }: { storageKey: string; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);
  const original = useRef<string | null>(null);
  const [edited, setEdited] = useState(false);
  const key = `letter:${storageKey}`;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    original.current = el.innerHTML;
    try {
      const saved = localStorage.getItem(key);
      if (saved) {
        el.innerHTML = saved;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- reflects the restored draft once on mount
        setEdited(true);
      }
    } catch {}
  }, [key]);

  return (
    <>
      <div className="no-print mx-auto mt-4 flex max-w-[210mm] flex-wrap items-center justify-between gap-2 px-4 text-[13px]">
        <p className="flex items-center gap-1.5 text-ink-2">
          <PencilLine className="size-4" aria-hidden />
          Click anywhere on the letter to change the wording, then print.
          {edited && <span className="font-medium text-accent-ink">Your changes are saved on this computer.</span>}
        </p>
        {edited && (
          <button
            type="button"
            onClick={() => {
              if (ref.current && original.current !== null) ref.current.innerHTML = original.current;
              try {
                localStorage.removeItem(key);
              } catch {}
              setEdited(false);
            }}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 font-medium text-ink-2 hover:bg-surface-2 hover:text-ink"
          >
            <RotateCcw className="size-3.5" aria-hidden /> Reset to original
          </button>
        )}
      </div>
      <article
        ref={ref}
        contentEditable
        suppressContentEditableWarning
        spellCheck
        onInput={() => {
          try {
            if (ref.current) localStorage.setItem(key, ref.current.innerHTML);
          } catch {}
          setEdited(true);
        }}
        className={cx(
          "outline-none hover:ring-2 hover:ring-accent/20 focus:ring-2 focus:ring-accent/40 print:hover:ring-0 print:focus:ring-0",
          className,
        )}
      >
        {children}
      </article>
    </>
  );
}
