"use client";

import Link from "next/link";
import { useRef, useState, useTransition } from "react";
import { Award, Bus, Clock, ExternalLink, Loader2, MessageCircle, Phone, ShieldAlert, Trophy, X } from "lucide-react";
import { Avatar, Pill, cx } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { getStudentAudit, type AuditEvent, type StudentAudit } from "./actions";

export type AuditRow = {
  rollNo: string;
  fullName: string;
  fatherName: string;
  program: string;
  section: string;
  photoUrl: string | null;
  status: string;
};

const KIND = {
  late: { label: "Late", Icon: Clock },
  violation: { label: "Violation", Icon: ShieldAlert },
  trip: { label: "Trip", Icon: Bus },
  sport: { label: "Sports", Icon: Trophy },
  achievement: { label: "Award", Icon: Award },
} as const;

const FILTERS: { key: AuditEvent["kind"] | "all"; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "late", label: "Lates" },
  { key: "violation", label: "Violations" },
  { key: "trip", label: "Trips" },
  { key: "sport", label: "Sports" },
  { key: "achievement", label: "Awards" },
];

export function AuditList({ rows }: { rows: AuditRow[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [audit, setAudit] = useState<StudentAudit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<AuditEvent["kind"] | "all">("all");
  const [loading, start] = useTransition();

  function open(rollNo: string) {
    setAudit(null);
    setError(null);
    setFilter("all");
    dialogRef.current?.showModal();
    start(async () => {
      const res = await getStudentAudit(rollNo);
      if (res) setAudit(res);
      else setError("Student not found.");
    });
  }

  const events = audit?.events.filter((e) => filter === "all" || e.kind === filter) ?? [];

  return (
    <>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.rollNo}>
            <button type="button" onClick={() => open(r.rollNo)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2/60">
              <Avatar name={r.fullName} photoUrl={r.photoUrl} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{r.fullName}</span>
                <span className="block truncate text-[12px] text-muted">
                  <span className="font-mono">{r.rollNo}</span> · S/O {r.fatherName}
                </span>
              </span>
              <span className="hidden text-right text-[13px] text-ink-2 sm:block">
                {r.program} · {r.section}
              </span>
              {r.status !== "Active" && <Pill tone="warning">{r.status}</Pill>}
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        className="m-auto w-[min(44rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-black/50"
      >
        <div className="flex items-center justify-between border-b border-line px-5 py-3">
          <p className="font-semibold">Student audit</p>
          <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>
        <div className="max-h-[75vh] overflow-y-auto">
          {loading && !audit && (
            <p className="flex items-center justify-center gap-2 px-5 py-16 text-sm text-muted">
              <Loader2 className="size-4 animate-spin" aria-hidden /> Loading…
            </p>
          )}
          {error && <p className="px-5 py-10 text-center text-sm text-danger-ink">{error}</p>}
          {audit && (
            <div className="flex flex-col gap-5 p-5">
              <div className="flex flex-wrap items-start gap-4">
                <Avatar name={audit.student.fullName} photoUrl={audit.student.photoUrl} size="xl" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-xl font-semibold tracking-tight">{audit.student.fullName}</h2>
                    <Pill tone={audit.student.status === "Active" ? "neutral" : "warning"}>{audit.student.status}</Pill>
                  </div>
                  <p className="text-sm text-ink-2">S/O {audit.student.fatherName}</p>
                  <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-3">
                    <Detail label="Roll no." value={<span className="font-mono">{audit.student.rollNo}</span>} />
                    <Detail label="Program" value={audit.student.program} />
                    <Detail label="Section" value={audit.student.section} />
                    <Detail label="Parent phone" value={<span className="font-mono">{audit.student.parentPhone}</span>} />
                    <Detail label="Student phone" value={audit.student.studentPhone ? <span className="font-mono">{audit.student.studentPhone}</span> : "—"} />
                    <Detail label="On record since" value={formatDate(audit.student.addedOn)} />
                  </dl>
                  <div className="mt-3 flex flex-wrap gap-2 text-[13px]">
                    <a href={`tel:${audit.student.parentPhone}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 hover:bg-surface-2">
                      <Phone className="size-3.5" aria-hidden /> Call parent
                    </a>
                    <a href={`https://wa.me/${audit.student.parentPhone.replace(/\D/g, "").replace(/^0/, "92")}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 hover:bg-surface-2">
                      <MessageCircle className="size-3.5" aria-hidden /> WhatsApp
                    </a>
                    <Link href={`/students/${encodeURIComponent(audit.student.rollNo)}`} className="inline-flex items-center gap-1.5 rounded-lg border border-line px-2.5 py-1 hover:bg-surface-2">
                      <ExternalLink className="size-3.5" aria-hidden /> Full profile
                    </Link>
                  </div>
                </div>
              </div>

              <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Late arrivals" value={audit.totals.lates} sub={`${audit.totals.latesThisYear} this year`} />
                <Stat label="Violations" value={audit.totals.violations} sub={`${audit.totals.openCases} open`} warn={audit.totals.openCases > 0} />
                <Stat label="Unpaid fines" value={`Rs. ${audit.totals.unpaidFines.toLocaleString()}`} warn={audit.totals.unpaidFines > 0} />
                <Stat label="Trips · Teams" value={`${audit.totals.trips} · ${audit.totals.teams}`} sub={`${audit.totals.achievements} awards`} />
              </dl>

              <div>
                <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
                  {FILTERS.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      role="tab"
                      aria-selected={filter === f.key}
                      onClick={() => setFilter(f.key)}
                      className={cx(
                        "rounded-full px-3 py-1 text-[13px] font-medium transition-colors",
                        filter === f.key ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2",
                      )}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                {events.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-line px-4 py-8 text-center text-sm text-muted">Nothing on record here.</p>
                ) : (
                  <ol className="flex flex-col divide-y divide-line rounded-xl border border-line">
                    {events.map((e, i) => {
                      const { Icon, label } = KIND[e.kind];
                      return (
                        <li key={i} className="flex gap-3 px-4 py-3">
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-surface-2 text-ink-2">
                            <Icon className="size-4" aria-hidden />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                              {e.href ? (
                                <Link href={e.href} className="hover:underline">
                                  {e.title}
                                </Link>
                              ) : (
                                e.title
                              )}
                              {e.badge && <Pill>{e.badge}</Pill>}
                            </p>
                            {e.detail && <p className="mt-0.5 text-[13px] text-ink-2">{e.detail}</p>}
                            <p className="mt-0.5 text-[12px] text-muted">
                              {label} · {formatDate(e.date)}
                            </p>
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                )}
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: React.ReactNode; sub?: string; warn?: boolean }) {
  return (
    <div className={cx("rounded-xl border px-3 py-2.5", warn ? "border-warning/50 bg-warning/10" : "border-line")}>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular">{value}</dd>
      {sub && <dd className="text-[12px] text-muted">{sub}</dd>}
    </div>
  );
}
