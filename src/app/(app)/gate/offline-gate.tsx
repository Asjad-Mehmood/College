"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloudOff, CloudUpload, Loader2, Trash2, WifiOff } from "lucide-react";
import type { LateReason } from "@/generated/prisma/enums";
import { Button, Card, cx, fieldClass } from "@/components/ui";
import { REASONS } from "@/lib/labels";
import { syncOfflineArrivals, type OfflineEntry } from "./actions";

const KEY = "gate-offline-queue";
type Queued = OfflineEntry & { error?: string };

function load(): Queued[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
}
function save(q: Queued[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(q));
  } catch {}
}

/** Online status, updated by the browser's online/offline events. */
export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * Offline gate: roll number + reason are saved on this phone with the time,
 * and sent to the server automatically when the connection comes back.
 */
export function OfflineGate({ online, forceOffline, onBackOnline }: { online: boolean; forceOffline: boolean; onBackOnline: () => void }) {
  const [queue, setQueue] = useState<Queued[]>([]);
  const [roll, setRoll] = useState("");
  const [reason, setReason] = useState<LateReason | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [notes, setNotes] = useState<string[]>([]);
  const offline = !online || forceOffline;

  // eslint-disable-next-line react-hooks/set-state-in-effect -- load the saved queue once on mount
  useEffect(() => setQueue(load()), []);

  const busy = useRef(false);
  const backOnline = useRef(onBackOnline);
  useEffect(() => {
    backOnline.current = onBackOnline;
  });

  const sync = useCallback(async () => {
    const pending = load();
    if (pending.length === 0 || busy.current) return;
    busy.current = true;
    setSyncing(true);
    try {
      const results = await syncOfflineArrivals(pending.map(({ error, ...e }) => (void error, e)));
      const byId = new Map(results.map((r) => [r.id, r]));
      const left = pending.filter((e) => !byId.get(e.id)?.ok).map((e) => ({ ...e, error: byId.get(e.id)?.message }));
      save(left);
      setQueue(left);
      setNotes(results.filter((r) => r.ok).map((r) => r.message));
      if (left.length === 0) backOnline.current();
    } catch {
      // Still no connection; the next "online" event (or Send now) tries again.
    } finally {
      busy.current = false;
      setSyncing(false);
    }
  }, []);

  // Send the queue once each time the connection comes back.
  useEffect(() => {
    if (!online) return;
    const t = setTimeout(() => void sync(), 0);
    return () => clearTimeout(t);
  }, [online, sync]);

  function add() {
    if (!roll.trim() || !reason) return;
    const entry: Queued = { id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, rollNo: roll.trim().toUpperCase(), reason, arrivedAt: new Date().toISOString() };
    const next = [...load(), entry];
    save(next);
    setQueue(next);
    setRoll("");
    setReason(null);
  }

  if (!offline && queue.length === 0 && notes.length === 0) return null;

  return (
    <Card className={cx("overflow-hidden", offline && "ring-2 ring-warning/60")}>
      <div className={cx("flex flex-wrap items-center gap-3 px-5 py-3", offline ? "bg-warning/15" : "bg-surface-2/60")}>
        {offline ? <WifiOff className="size-5 shrink-0" aria-hidden /> : <CloudUpload className="size-5 shrink-0 text-accent-ink" aria-hidden />}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">{offline ? "No internet — offline mode" : "Back online"}</p>
          <p className="text-[12px] text-ink-2">
            {offline
              ? "Entries are saved on this phone with the time and sent automatically when the internet returns."
              : queue.length
                ? `${queue.length} saved ${queue.length === 1 ? "entry" : "entries"} to send.`
                : "Offline entries have been sent."}
          </p>
        </div>
        {!offline && queue.length > 0 && (
          <Button size="sm" variant="primary" onClick={() => void sync()} disabled={syncing}>
            {syncing ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <CloudUpload className="size-4" aria-hidden />} Send now
          </Button>
        )}
      </div>

      {offline && (
        <form
          className="flex flex-col gap-3 border-t border-line p-5"
          onSubmit={(e) => {
            e.preventDefault();
            add();
          }}
        >
          <input
            value={roll}
            onChange={(e) => setRoll(e.target.value)}
            placeholder="Roll number (or last digits)"
            aria-label="Roll number"
            autoComplete="off"
            className={fieldClass("h-12 font-mono text-lg uppercase placeholder:font-sans placeholder:text-base placeholder:normal-case")}
          />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            {REASONS.map((r) => (
              <button
                key={r.value}
                type="button"
                onClick={() => setReason(r.value)}
                aria-pressed={reason === r.value}
                className={cx(
                  "h-12 rounded-xl border px-2 text-sm font-medium",
                  reason === r.value ? "border-accent bg-accent text-on-accent" : "border-line bg-surface hover:bg-surface-2",
                )}
              >
                {r.label}
              </button>
            ))}
          </div>
          <Button type="submit" variant="primary" size="lg" disabled={!roll.trim() || !reason}>
            <CloudOff className="size-4" aria-hidden /> Save on this phone
          </Button>
        </form>
      )}

      {queue.length > 0 && (
        <ul className="divide-y divide-line border-t border-line">
          {queue.map((q) => (
            <li key={q.id} className="flex items-center gap-3 px-5 py-2.5 text-sm">
              <span className="font-mono">{q.rollNo}</span>
              <span className="text-muted">
                {new Date(q.arrivedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} · {REASONS.find((r) => r.value === q.reason)?.label}
              </span>
              {q.error && <span className="text-[12px] text-danger-ink">{q.error}</span>}
              <button
                type="button"
                className="ml-auto rounded-md p-1 text-muted hover:text-danger-ink"
                aria-label={`Discard ${q.rollNo}`}
                onClick={() => {
                  const next = load().filter((e) => e.id !== q.id);
                  save(next);
                  setQueue(next);
                }}
              >
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {!offline && notes.length > 0 && (
        <ul className="border-t border-line px-5 py-3 text-[12px] text-ink-2">
          {notes.map((n, i) => (
            <li key={i}>✓ {n}</li>
          ))}
        </ul>
      )}
    </Card>
  );
}
