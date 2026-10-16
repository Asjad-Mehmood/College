"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Award,
  Banknote,
  Bus,
  ChevronRight,
  Clock,
  ExternalLink,
  History,
  LayoutDashboard,
  Loader2,
  MessageCircle,
  Phone,
  Printer,
  ShieldAlert,
  Trophy,
  X,
} from "lucide-react";
import { Avatar, Pill, StrikeBadge, Table, Td, Th, cx } from "@/components/ui";
import { formatDate } from "@/lib/time";
import { getStudentAudit, type StudentAudit } from "./actions";

export type AuditRow = {
  rollNo: string;
  fullName: string;
  fatherName: string;
  program: string;
  section: string;
  photoUrl: string | null;
  status: string;
};

type TabKey = "overview" | "lates" | "violations" | "fines" | "trips" | "sports" | "timeline";

const money = (n: number) => `Rs. ${n.toLocaleString()}`;
const shortMonth = (ym: string) =>
  new Date(`${ym}-01T00:00:00Z`).toLocaleDateString("en-GB", { month: "short", timeZone: "UTC" });
const SEVERITY_TONE: Record<string, "warning" | "critical" | "neutral"> = { MINOR: "neutral", MAJOR: "warning", SEVERE: "critical" };

export function AuditList({ rows, autoOpen }: { rows: AuditRow[]; autoOpen?: string }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [audit, setAudit] = useState<StudentAudit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("overview");
  const [loading, start] = useTransition();

  const load = useCallback((rollNo: string) => {
    dialogRef.current?.showModal();
    start(async () => {
      const res = await getStudentAudit(rollNo);
      if (res) setAudit(res);
      else setError("Student not found.");
    });
  }, []);

  function open(rollNo: string) {
    setAudit(null);
    setError(null);
    setTab("overview");
    load(rollNo);
  }

  // A search that pins down one student opens their audit straight away.
  useEffect(() => {
    if (autoOpen) load(autoOpen);
  }, [autoOpen, load]);

  return (
    <>
      <ul className="divide-y divide-line">
        {rows.map((r) => (
          <li key={r.rollNo}>
            <button type="button" onClick={() => open(r.rollNo)} className="group flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-surface-2/60">
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
              <span className="hidden items-center gap-1 text-[13px] font-medium text-accent-ink sm:inline-flex">
                Open audit <ChevronRight className="size-4" aria-hidden />
              </span>
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label="Student audit"
        className="m-auto h-[min(92vh,60rem)] w-[min(84rem,calc(100vw-1.5rem))] max-w-none overflow-hidden rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-black/60"
      >
        <div className="flex h-full flex-col">
          <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
            <div className="flex min-w-0 items-center gap-2 text-sm">
              <span className="font-semibold">Student audit</span>
              {audit && (
                <span className="truncate text-muted">
                  · {audit.student.fullName} · <span className="font-mono">{audit.student.rollNo}</span>
                </span>
              )}
            </div>
            <div className="flex items-center gap-1">
              {audit && (
                <Link
                  href={`/letter/${encodeURIComponent(audit.student.rollNo)}`}
                  target="_blank"
                  className="hidden items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[13px] font-medium text-ink-2 hover:bg-surface-2 sm:inline-flex"
                >
                  <Printer className="size-4" aria-hidden /> Warning letter
                </Link>
              )}
              <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label="Close">
                <X className="size-5" />
              </button>
            </div>
          </header>

          {!audit ? (
            <div className="flex flex-1 items-center justify-center text-sm text-muted">
              {error ? (
                <span className="text-danger-ink">{error}</span>
              ) : loading ? (
                <span className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" aria-hidden /> Loading the full record…
                </span>
              ) : null}
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto lg:flex-row lg:overflow-hidden">
              <ProfileSidebar a={audit} />
              <div className="flex min-w-0 flex-1 flex-col lg:min-h-0">
                <Tabs a={audit} tab={tab} setTab={setTab} />
                <div className="flex-1 p-5 lg:min-h-0 lg:overflow-y-auto">
                  {tab === "overview" && <Overview a={audit} setTab={setTab} />}
                  {tab === "lates" && <Lates a={audit} />}
                  {tab === "violations" && <Violations a={audit} />}
                  {tab === "fines" && <Fines a={audit} />}
                  {tab === "trips" && <Trips a={audit} />}
                  {tab === "sports" && <Sports a={audit} />}
                  {tab === "timeline" && <Timeline a={audit} />}
                </div>
              </div>
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}

/* ---------- layout pieces ---------- */

function ProfileSidebar({ a }: { a: StudentAudit }) {
  const s = a.student;
  const wa = `https://wa.me/${s.parentPhone.replace(/\D/g, "").replace(/^0/, "92")}`;
  return (
    <aside className="shrink-0 border-b lg:overflow-y-auto border-line bg-surface-2/40 p-5 lg:w-80 lg:border-r lg:border-b-0">
      <div className="flex items-center gap-4 lg:flex-col lg:items-start">
        <Avatar name={s.fullName} photoUrl={s.photoUrl} size="xl" />
        <div className="min-w-0">
          <h2 className="text-xl leading-tight font-semibold tracking-tight">{s.fullName}</h2>
          <p className="text-sm text-ink-2">S/O {s.fatherName}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Pill tone={s.active ? "good" : "warning"}>{s.status}</Pill>
            {a.totals.latesThisMonth > 0 && <StrikeBadge level={a.totals.monthLevel} label={`${a.totals.latesThisMonth} late this month`} />}
          </div>
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[13px] lg:grid-cols-1">
        <Detail label="Roll number" value={<span className="font-mono">{s.rollNo}</span>} />
        <Detail label="Program" value={s.program} />
        <Detail label="Section" value={`${s.section}${s.sectionYear ? ` · ${s.sectionYear}` : ""}`} />
        <Detail label="Parent phone" value={<span className="font-mono">{s.parentPhone}</span>} />
        <Detail label="Student phone" value={s.studentPhone ? <span className="font-mono">{s.studentPhone}</span> : "—"} />
        <Detail label="On record since" value={formatDate(s.addedOn)} />
        <Detail label="Last updated" value={formatDate(s.updatedOn)} />
      </dl>

      <div className="mt-5 grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
        <SideLink href={`tel:${s.parentPhone}`} Icon={Phone} label="Call parent" />
        <SideLink href={wa} Icon={MessageCircle} label="WhatsApp parent" external />
        <SideLink href={`/students/${encodeURIComponent(s.rollNo)}`} Icon={ExternalLink} label="Student profile" />
      </div>
    </aside>
  );
}

const TABS: { key: TabKey; label: string; Icon: typeof Clock; count?: (a: StudentAudit) => number }[] = [
  { key: "overview", label: "Overview", Icon: LayoutDashboard },
  { key: "lates", label: "Late arrivals", Icon: Clock, count: (a) => a.lates.length },
  { key: "violations", label: "Violations", Icon: ShieldAlert, count: (a) => a.violations.length },
  { key: "fines", label: "Fines", Icon: Banknote, count: (a) => a.fines.length },
  { key: "trips", label: "Trips", Icon: Bus, count: (a) => a.trips.length },
  { key: "sports", label: "Sports", Icon: Trophy, count: (a) => a.teams.length + a.achievements.length },
  { key: "timeline", label: "Timeline", Icon: History },
];

function Tabs({ a, tab, setTab }: { a: StudentAudit; tab: TabKey; setTab: (t: TabKey) => void }) {
  return (
    <nav className="sticky top-0 z-10 flex shrink-0 gap-1 overflow-x-auto border-b border-line bg-surface px-3" role="tablist">
      {TABS.map(({ key, label, Icon, count }) => {
        const active = tab === key;
        return (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => setTab(key)}
            className={cx(
              "-mb-px inline-flex shrink-0 items-center gap-2 border-b-2 px-3 py-3 text-[13px] font-medium",
              active ? "border-accent text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
            {count && (
              <span className={cx("rounded-full px-1.5 text-[11px] tabular", active ? "bg-accent-soft text-accent-ink" : "bg-surface-2 text-muted")}>
                {count(a)}
              </span>
            )}
          </button>
        );
      })}
    </nav>
  );
}

/* ---------- tabs ---------- */

function Overview({ a, setTab }: { a: StudentAudit; setTab: (t: TabKey) => void }) {
  const t = a.totals;
  const alerts: string[] = [];
  const openSevere = a.violations.filter((v) => v.open && v.severityKey !== "MINOR");
  if (openSevere.length) alerts.push(`${openSevere.length} open ${openSevere.length === 1 ? "case" : "cases"} of major/severe misconduct.`);
  if (t.finesUnpaid > 0) alerts.push(`${money(t.finesUnpaid)} in unpaid fines.`);
  if (t.monthLevel === "serious" || t.monthLevel === "critical") alerts.push(`${t.latesThisMonth} late arrivals this month — habitual.`);
  if (!a.student.active) alerts.push(`Student is ${a.student.status.toLowerCase()}.`);
  const max = Math.max(1, ...a.lateTrend.map((m) => m.count));
  const recent = timeline(a).slice(0, 6);

  return (
    <div className="flex flex-col gap-5">
      {alerts.length > 0 ? (
        <div className="rounded-xl bg-warning/12 px-4 py-3 ring-1 ring-warning/40 ring-inset">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <AlertTriangle className="size-4" aria-hidden /> Needs attention
          </p>
          <ul className="mt-1 list-disc pl-6 text-[13px] text-ink-2">
            {alerts.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="rounded-xl bg-good/10 px-4 py-3 text-sm ring-1 ring-good/30 ring-inset">Clean record — no open cases or unpaid fines.</p>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <Kpi label="Late arrivals" value={t.lates} sub={`${t.latesThisMonth} this month`} onClick={() => setTab("lates")} />
        <Kpi label="Avg. minutes late" value={t.lates ? `${t.avgMinutesLate}` : "—"} sub="per late arrival" />
        <Kpi label="Violations" value={t.violations} sub={`${t.severeCases} major/severe`} onClick={() => setTab("violations")} />
        <Kpi label="Open cases" value={t.openCases} warn={t.openCases > 0} onClick={() => setTab("violations")} />
        <Kpi label="Unpaid fines" value={money(t.finesUnpaid)} sub={`of ${money(t.finesTotal)}`} warn={t.finesUnpaid > 0} onClick={() => setTab("fines")} />
        <Kpi label="Trips · Teams · Awards" value={`${t.trips} · ${t.teams} · ${t.achievements}`} onClick={() => setTab("sports")} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section className="rounded-xl border border-line p-4">
          <h3 className="text-sm font-semibold">Late arrivals — last 12 months</h3>
          <div className="mt-4 flex h-36 items-end gap-1.5" role="img" aria-label="Late arrivals per month">
            {a.lateTrend.map((m) => (
              <div key={m.month} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1">
                <span className="text-[11px] text-ink-2 tabular">{m.count || ""}</span>
                <div className="w-full rounded-t bg-accent" style={{ height: `${(m.count / max) * 100}%`, minHeight: m.count ? 4 : 1, opacity: m.count ? 1 : 0.25 }} />
                <span className="text-[10px] text-muted">{shortMonth(m.month)}</span>
              </div>
            ))}
          </div>
        </section>
        <section className="rounded-xl border border-line p-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Recent activity</h3>
            <button type="button" onClick={() => setTab("timeline")} className="text-[13px] font-medium text-accent-ink hover:underline">
              Full timeline
            </button>
          </div>
          {recent.length === 0 ? <Empty text="No activity on record." /> : <EventList events={recent} compact />}
        </section>
      </div>
    </div>
  );
}

function Lates({ a }: { a: StudentAudit }) {
  if (!a.lates.length) return <Empty text="No late arrivals on record." />;
  return (
    <Panel>
      <Table>
        <thead>
          <tr>
            <Th>Date</Th>
            <Th>Arrived</Th>
            <Th>Late by</Th>
            <Th>Reason</Th>
            <Th>Action</Th>
            <Th>Fine</Th>
            <Th>Parent</Th>
            <Th>Recorded by</Th>
          </tr>
        </thead>
        <tbody>
          {a.lates.map((l) => (
            <tr key={l.id}>
              <Td className="whitespace-nowrap">
                {formatDate(l.date, { weekday: true })}
                {l.remarks && <span className="block max-w-56 truncate text-[12px] text-muted" title={l.remarks}>“{l.remarks}”</span>}
              </Td>
              <Td className="tabular">{l.time}</Td>
              <Td className="tabular">{l.minutesLate} min</Td>
              <Td>{l.reason}</Td>
              <Td>{l.action}</Td>
              <Td><FineCell amount={l.fine} paid={l.finePaid} /></Td>
              <Td>{l.parentNotified ? "Notified" : <span className="text-muted">—</span>}</Td>
              <Td className="text-ink-2">{l.recordedBy}</Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}

function Violations({ a }: { a: StudentAudit }) {
  if (!a.violations.length) return <Empty text="No violations on record." />;
  return (
    <div className="flex flex-col gap-3">
      {a.violations.map((v) => (
        <article key={v.id} className="rounded-xl border border-line p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <Link href={`/violations/${v.id}`} className="font-semibold hover:underline">
                {v.type}
              </Link>
              <p className="text-[12px] text-muted">
                Case #{v.id} · {formatDate(v.date, { weekday: true })}
                {v.time && ` · ${v.time}`}
                {v.location && ` · ${v.location}`}
              </p>
            </div>
            <div className="flex gap-1.5">
              <Pill tone={SEVERITY_TONE[v.severityKey]}>{v.severity}</Pill>
              <Pill tone={v.open ? "warning" : "neutral"}>{v.status}</Pill>
            </div>
          </div>
          <p className="mt-2 text-sm text-ink-2">{v.description}</p>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-[13px] sm:grid-cols-4">
            <Detail label="Action taken" value={`${v.action}${v.suspensionDays ? ` (${v.suspensionDays} days)` : ""}`} />
            <Detail label="Fine" value={<FineCell amount={v.fine} paid={v.finePaid} />} />
            <Detail label="Reported by" value={v.reportedBy ?? "—"} />
            <Detail label="Recorded by" value={v.recordedBy} />
          </dl>
          {v.closingNote && <p className="mt-3 rounded-lg bg-surface-2/70 px-3 py-2 text-[13px] text-ink-2">Closing note: {v.closingNote}</p>}
        </article>
      ))}
    </div>
  );
}

function Fines({ a }: { a: StudentAudit }) {
  if (!a.fines.length) return <Empty text="No fines on record." />;
  const paid = a.totals.finesTotal - a.totals.finesUnpaid;
  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-3 gap-3">
        <Kpi label="Total fined" value={money(a.totals.finesTotal)} />
        <Kpi label="Paid" value={money(paid)} />
        <Kpi label="Outstanding" value={money(a.totals.finesUnpaid)} warn={a.totals.finesUnpaid > 0} />
      </div>
      <Panel>
        <Table>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Source</Th>
              <Th>Detail</Th>
              <Th className="text-right">Amount</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {a.fines.map((f) => (
              <tr key={f.key}>
                <Td className="whitespace-nowrap">{formatDate(f.date)}</Td>
                <Td>{f.source}</Td>
                <Td>{f.href ? <Link href={f.href} className="hover:underline">{f.detail}</Link> : f.detail}</Td>
                <Td className="text-right tabular">{money(f.amount)}</Td>
                <Td><Pill tone={f.paid ? "good" : "critical"}>{f.paid ? "Paid" : "Unpaid"}</Pill></Td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Panel>
    </div>
  );
}

function Trips({ a }: { a: StudentAudit }) {
  if (!a.trips.length) return <Empty text="Not enrolled in any trip." />;
  return (
    <Panel>
      <Table>
        <thead>
          <tr>
            <Th>Trip</Th>
            <Th>Dates</Th>
            <Th>Trip status</Th>
            <Th>Enrolment</Th>
            <Th>Consent</Th>
            <Th>Fee</Th>
            <Th>Roll call</Th>
          </tr>
        </thead>
        <tbody>
          {a.trips.map((t) => (
            <tr key={t.id}>
              <Td>
                <Link href={`/trips/${t.id}`} className="font-medium hover:underline">{t.title}</Link>
                <span className="block text-[12px] text-muted">{t.destination}</span>
                {t.overrideNote && <span className="block text-[12px] text-ink-2">Override: {t.overrideNote}</span>}
              </Td>
              <Td className="whitespace-nowrap">
                {formatDate(t.departDate)}
                {t.returnDate !== t.departDate && <span className="block text-[12px] text-muted">to {formatDate(t.returnDate)}</span>}
              </Td>
              <Td>{t.tripStatus}</Td>
              <Td>{t.registered ? "Registered" : <Pill tone="warning">Withdrawn</Pill>}</Td>
              <Td>{t.consent}</Td>
              <Td className="tabular">
                {t.fee ? (
                  <>
                    {money(t.feePaid)} / {money(t.fee)}
                    {t.receiptNo && <span className="block text-[12px] text-muted">Receipt {t.receiptNo}</span>}
                  </>
                ) : (
                  <span className="text-muted">Free</span>
                )}
              </Td>
              <Td className="text-[13px]">
                {t.departed ? "Departed" : "—"}
                {t.returned && <span className="block">Returned</span>}
              </Td>
            </tr>
          ))}
        </tbody>
      </Table>
    </Panel>
  );
}

function Sports({ a }: { a: StudentAudit }) {
  if (!a.teams.length && !a.achievements.length) return <Empty text="No sports teams or awards on record." />;
  return (
    <div className="flex flex-col gap-5">
      {a.teams.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Teams</h3>
          <div className="grid gap-3 md:grid-cols-2">
            {a.teams.map((t) => (
              <Link key={t.id} href={`/sports/teams/${t.id}`} className="rounded-xl border border-line p-4 hover:border-line-strong">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold">{t.sport}</p>
                    <p className="text-[12px] text-muted">{t.event} · {formatDate(t.date)}</p>
                  </div>
                  <Pill tone={t.status === "Selected" ? "good" : "neutral"}>{t.status}</Pill>
                </div>
                <p className="mt-2 text-[13px] text-ink-2">
                  {t.role}
                  {t.position && ` · ${t.position}`}
                  {t.jerseyNo != null && ` · Jersey #${t.jerseyNo}`} · Consent {t.consent.toLowerCase()}
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}
      {a.achievements.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold">Achievements</h3>
          <ul className="flex flex-col divide-y divide-line rounded-xl border border-line">
            {a.achievements.map((x) => (
              <li key={x.id} className="flex items-start gap-3 px-4 py-3">
                <Award className="mt-0.5 size-4 shrink-0 text-accent-ink" aria-hidden />
                <div>
                  <p className="text-sm font-medium">{x.position} · {x.event}</p>
                  <p className="text-[12px] text-muted">{formatDate(x.date)}{x.notes && ` · ${x.notes}`}</p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function Timeline({ a }: { a: StudentAudit }) {
  const events = timeline(a);
  if (!events.length) return <Empty text="Nothing on record yet." />;
  return <EventList events={events} />;
}

/* ---------- helpers ---------- */

type Ev = { key: string; date: string; Icon: typeof Clock; title: string; detail: string; href?: string };

function timeline(a: StudentAudit): Ev[] {
  return [
    ...a.lates.map((l) => ({ key: `l${l.id}`, date: l.date, Icon: Clock, title: `Late ${l.minutesLate} min — ${l.reason}`, detail: `${l.time} · ${l.action}${l.fine ? ` · fine ${money(l.fine)}` : ""}` })),
    ...a.violations.map((v) => ({ key: `v${v.id}`, date: v.date, Icon: ShieldAlert, title: `${v.type} (${v.severity})`, detail: `${v.action} · ${v.status}`, href: `/violations/${v.id}` })),
    ...a.trips.map((t) => ({ key: `t${t.id}`, date: t.departDate, Icon: Bus, title: `Trip: ${t.title}`, detail: `${t.destination} · ${t.registered ? "registered" : "withdrawn"}`, href: `/trips/${t.id}` })),
    ...a.teams.map((t) => ({ key: `s${t.id}`, date: t.date, Icon: Trophy, title: `${t.sport} team`, detail: `${t.event} · ${t.role}`, href: `/sports/teams/${t.id}` })),
    ...a.achievements.map((x) => ({ key: `a${x.id}`, date: x.date, Icon: Award, title: `${x.position} — ${x.event}`, detail: x.notes ?? "" })),
  ].sort((p, q) => (p.date < q.date ? 1 : p.date > q.date ? -1 : 0));
}

function EventList({ events, compact }: { events: Ev[]; compact?: boolean }) {
  return (
    <ol className={cx("relative flex flex-col", compact ? "mt-3 gap-3" : "gap-4 border-l border-line pl-6")}>
      {events.map(({ key, date, Icon, title, detail, href }) => (
        <li key={key} className="relative flex gap-3">
          <span className={cx("flex size-7 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink-2 ring-4 ring-surface", !compact && "absolute top-0 -left-[38px]")}>
            <Icon className="size-3.5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium">{href ? <Link href={href} className="hover:underline">{title}</Link> : title}</p>
            <p className="text-[12px] text-muted">
              {formatDate(date)}
              {detail && ` · ${detail}`}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return <div className="overflow-hidden rounded-xl border border-line">{children}</div>;
}

function Empty({ text }: { text: string }) {
  return <p className="rounded-xl border border-dashed border-line px-4 py-12 text-center text-sm text-muted">{text}</p>;
}

function FineCell({ amount, paid }: { amount: number; paid: boolean }) {
  if (!amount) return <span className="text-muted">—</span>;
  return (
    <span className="tabular">
      {money(amount)} <span className={cx("text-[12px]", paid ? "text-success-ink" : "text-danger-ink")}>{paid ? "paid" : "unpaid"}</span>
    </span>
  );
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="font-medium">{value}</dd>
    </div>
  );
}

function SideLink({ href, Icon, label, external }: { href: string; Icon: typeof Phone; label: string; external?: boolean }) {
  return (
    <a
      href={href}
      {...(external && { target: "_blank", rel: "noreferrer" })}
      className="inline-flex items-center justify-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-[13px] font-medium hover:bg-surface-2 lg:justify-start"
    >
      <Icon className="size-4" aria-hidden /> <span className="truncate">{label}</span>
    </a>
  );
}

function Kpi({ label, value, sub, warn, onClick }: { label: string; value: React.ReactNode; sub?: string; warn?: boolean; onClick?: () => void }) {
  const body = (
    <>
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular">{value}</p>
      {sub && <p className="text-[12px] text-muted">{sub}</p>}
    </>
  );
  const cls = cx("rounded-xl border px-3.5 py-3 text-left", warn ? "border-warning/50 bg-warning/10" : "border-line");
  return onClick ? (
    <button type="button" onClick={onClick} className={cx(cls, "hover:border-line-strong")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}
