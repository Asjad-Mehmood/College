"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, MessageCircle, RotateCcw, Send } from "lucide-react";
import { Button, Card, EmptyState, Textarea, cx } from "@/components/ui";

export type QueueItem = { rollNo: string; name: string; section: string; phone: string; note: string; message: string; key?: string };

function waLink(phone: string, text: string) {
  const d = phone.replace(/\D/g, "");
  const intl = d.startsWith("00") ? d.slice(2) : d.startsWith("0") && d.length === 11 ? `92${d.slice(1)}` : d.length === 10 && d.startsWith("3") ? `92${d}` : d;
  return `https://wa.me/${intl}?text=${encodeURIComponent(text)}`;
}

/** Steps through a list of parents, opening each WhatsApp message in turn and remembering who was sent. */
export function MessageQueue({ queueKey, items, custom, sign }: { queueKey: string; items: QueueItem[]; custom: boolean; sign: string }) {
  const storageKey = `msgq:${queueKey}`;
  const [sent, setSent] = useState<string[]>([]);
  const [template, setTemplate] = useState(`Respected Parent of {name} ({roll}), `);

  // Remember progress on this device, so a page reload doesn't start over.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restoring saved progress once on mount
      if (saved) setSent(JSON.parse(saved));
    } catch {}
  }, [storageKey]);
  const mark = (id: string) =>
    setSent((prev) => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {}
      return next;
    });
  const reset = () => {
    setSent([]);
    try {
      localStorage.removeItem(storageKey);
    } catch {}
  };

  const idOf = (i: QueueItem) => i.key ?? i.rollNo;
  const textOf = (i: QueueItem) =>
    custom ? `${template.replaceAll("{name}", i.name).replaceAll("{roll}", i.rollNo).trim()} ${sign}` : i.message;
  const remaining = items.filter((i) => !sent.includes(idOf(i)));
  const next = remaining[0];
  const ready = !custom || template.replace(/\{name\}|\{roll\}/g, "").trim().length > 25;

  if (items.length === 0) {
    return (
      <Card>
        <EmptyState icon={<CheckCircle2 className="size-5" />} title="Nobody to message">
          This list is empty right now.
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3 text-[13px] text-ink-2">
          <span>
            <span className="font-semibold text-ink tabular">{items.length - remaining.length}</span> of {items.length} sent
          </span>
          {sent.length > 0 && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1 font-medium text-accent-ink hover:underline">
              <RotateCcw className="size-3.5" aria-hidden /> Start over
            </button>
          )}
        </div>
        <div className="h-1 bg-accent/15">
          <div className="h-full bg-accent transition-[width]" style={{ width: `${((items.length - remaining.length) / items.length) * 100}%` }} />
        </div>
        <ul className="max-h-[65vh] divide-y divide-line overflow-y-auto">
          {items.map((i) => {
            const done = sent.includes(idOf(i));
            const isNext = next && idOf(next) === idOf(i);
            return (
              <li key={idOf(i)} className={cx("flex items-center gap-3 px-5 py-2.5", isNext && "bg-accent-soft/40", done && "opacity-60")}>
                {done ? <CheckCircle2 className="size-5 shrink-0 text-good" aria-label="Sent" /> : <span className="size-5 shrink-0 rounded-full border border-line-strong" />}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{i.name}</span>
                  <span className="block truncate text-[12px] text-muted">
                    <span className="font-mono">{i.rollNo}</span> · {i.section} · {i.note}
                  </span>
                </span>
                <a
                  href={waLink(i.phone, textOf(i))}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => mark(idOf(i))}
                  aria-disabled={!ready}
                  className={cx(
                    "inline-flex h-8 items-center gap-1.5 rounded-lg px-2.5 text-[13px] font-medium",
                    done ? "border border-line text-ink-2 hover:bg-surface-2" : "bg-[#1f8f4e] text-white hover:bg-[#1a7a43]",
                    !ready && "pointer-events-none opacity-40",
                  )}
                >
                  <MessageCircle className="size-3.5" aria-hidden /> {done ? "Again" : "Send"}
                </a>
              </li>
            );
          })}
        </ul>
      </Card>

      <div className="flex flex-col gap-4 lg:sticky lg:top-6">
        {custom && (
          <Card className="p-4">
            <p className="text-sm font-semibold">Your message</p>
            <p className="mb-2 text-[12px] text-muted">
              Use {"{name}"} and {"{roll}"} — they are filled in for each student. Your signature is added at the end.
            </p>
            <Textarea value={template} onChange={(e) => setTemplate(e.target.value)} rows={5} maxLength={900} />
          </Card>
        )}
        <Card className="p-4">
          {next ? (
            <>
              <p className="text-[12px] font-medium tracking-wide text-muted uppercase">Next</p>
              <p className="mt-1 font-semibold">{next.name}</p>
              <p className="text-[12px] text-muted">
                {next.phone} · {next.note}
              </p>
              <p className="mt-3 max-h-48 overflow-y-auto rounded-lg bg-surface-2/70 p-3 text-[13px] leading-relaxed whitespace-pre-line">{textOf(next)}</p>
              <a
                href={ready ? waLink(next.phone, textOf(next)) : undefined}
                target="_blank"
                rel="noreferrer"
                onClick={() => ready && mark(idOf(next))}
                className={cx(
                  "mt-3 flex h-12 items-center justify-center gap-2 rounded-xl bg-[#1f8f4e] text-[15px] font-semibold text-white hover:bg-[#1a7a43]",
                  !ready && "pointer-events-none opacity-40",
                )}
              >
                <Send className="size-4" aria-hidden /> Send & next ({remaining.length} left)
              </a>
              <Button variant="ghost" size="sm" className="mt-2 w-full" onClick={() => mark(idOf(next))}>
                Skip this parent
              </Button>
              {!ready && <p className="mt-2 text-[12px] text-danger-ink">Write your message first.</p>}
            </>
          ) : (
            <p className="flex items-center gap-2 text-sm font-medium text-success-ink">
              <CheckCircle2 className="size-5" aria-hidden /> All {items.length} parents done.
            </p>
          )}
        </Card>
        <p className="px-1 text-[12px] text-muted">
          Each Send opens WhatsApp with the message filled in — press send there, then come back here for the next one. Progress is
          remembered on this device for today.
        </p>
      </div>
    </div>
  );
}
