import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, BedDouble, Bus, CalendarDays, Clock, MapPin, Plus, Search, UserRound, Users } from "lucide-react";
import { FilterForm } from "@/components/filter-form";
import { Meter } from "@/components/meter";
import { ButtonLink, Card, EmptyState, Input, PageHeader, Pill, Skeleton, Table, Td, Th, cx } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { TRIP_STATUS_LABELS, TRIP_TYPE_LABELS } from "@/lib/labels";
import { getScope, scoped } from "@/lib/scope";
import { addDays, formatDate, fromDbDate } from "@/lib/time";
import { tripSummary, tripWhen } from "@/lib/trips";

export const metadata: Metadata = { title: "Trips" };

export default function TripsPage(props: PageProps<"/trips">) {
  return (
    <div>
      <Suspense fallback={<PageHeader title="Trips" description="Study tours, visits and events away from college." />}>
        <Header />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <TripList searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Header() {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  return (
    <PageHeader
      title="Trips"
      description="Study tours, visits and events away from college."
      actions={
        can.administer(user.role) && (
          <ButtonLink href="/trips/new" variant="primary">
            <Plus className="size-4" aria-hidden /> Plan a trip
          </ButtonLink>
        )
      }
    />
  );
}

type TripCardData = Awaited<ReturnType<typeof loadTrips>>[number];

async function loadTrips() {
  const prisma = await scoped();
  return prisma.trip.findMany({
    orderBy: [{ departDate: "desc" }, { id: "desc" }],
    take: 300,
    include: {
      participants: { select: { status: true, consent: true, feePaid: true } },
      _count: { select: { vehicles: true, staff: true } },
    },
  });
}

const VIEWS = [
  { key: "upcoming", label: "Upcoming" },
  { key: "now", label: "On a trip now" },
  { key: "past", label: "Past" },
  { key: "all", label: "All" },
] as const;
type View = (typeof VIEWS)[number]["key"];

async function TripList({ searchParams }: { searchParams: PageProps<"/trips">["searchParams"] }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const sp = await searchParams;
  const all = await loadTrips();
  const today = (await getScope()).anchor;
  const q = (typeof sp.q === "string" ? sp.q.trim() : "").toLowerCase();

  const isNow = (t: TripCardData) => t.status === "DEPARTED";
  const isUpcoming = (t: TripCardData) => t.status === "OPEN" || t.status === "CLOSED";
  const isPast = (t: TripCardData) => t.status === "RETURNED" || t.status === "CANCELLED";
  const counts = { upcoming: all.filter(isUpcoming).length, now: all.filter(isNow).length, past: all.filter(isPast).length, all: all.length };
  const requested = VIEWS.find((v) => v.key === sp.view)?.key;
  const view: View = requested ?? (counts.now > 0 ? "now" : "upcoming");

  if (all.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Bus className="size-5" />} title="No trips yet">
          Plan a trip to start registering students.
        </EmptyState>
      </Card>
    );
  }

  // Figures for trips that haven't happened yet.
  const ahead = all.filter((t) => isUpcoming(t) || isNow(t));
  const sums = ahead.map((t) => ({ t, s: tripSummary(t, t.participants) }));
  const students = sums.reduce((a, x) => a + x.s.registered, 0);
  const consentPending = sums.reduce((a, x) => a + x.s.consentPending, 0);
  const feeOutstanding = sums.reduce((a, x) => a + Math.max(0, x.s.registered * Number(x.t.feeAmount) - x.s.collected), 0);
  const collected = sums.reduce((a, x) => a + x.s.collected, 0);

  const filtered = all
    .filter((t) => (view === "upcoming" ? isUpcoming(t) : view === "now" ? isNow(t) : view === "past" ? isPast(t) : true))
    .filter((t) => !q || `${t.title} ${t.destination} ${t.inChargeName}`.toLowerCase().includes(q));
  // Soonest first for trips ahead; newest first otherwise.
  const list = view === "upcoming" ? [...filtered].reverse() : filtered;
  const href = (v: View) => {
    const qs = new URLSearchParams({ view: v });
    if (q) qs.set("q", q);
    return `/trips?${qs}`;
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label="Upcoming trips" value={counts.upcoming} sub={counts.now > 0 ? `${counts.now} on a trip right now` : "none on a trip now"} />
        <Stat label="Students going" value={students} sub="on upcoming and current trips" />
        <Stat label="Consent pending" value={consentPending} warn={consentPending > 0} sub="parents yet to reply" />
        <Stat
          label="Fees outstanding"
          value={`Rs. ${feeOutstanding.toLocaleString()}`}
          warn={feeOutstanding > 0}
          sub={`Rs. ${collected.toLocaleString()} collected`}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface p-1 shadow-card" aria-label="Trip filter">
          {VIEWS.map((v) => (
            <Link
              key={v.key}
              href={href(v.key)}
              aria-current={view === v.key ? "page" : undefined}
              className={cx(
                "rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                view === v.key ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              {v.label} <span className="text-[12px] tabular opacity-70">{counts[v.key]}</span>
            </Link>
          ))}
        </nav>
        <FilterForm action="/trips" className="w-full sm:w-72">
          <input type="hidden" name="view" value={view} />
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input type="search" name="q" defaultValue={q} placeholder="Search title, place or teacher" aria-label="Search trips" className="pl-9" />
          </div>
        </FilterForm>
      </div>

      {list.length === 0 ? (
        <Card>
          <EmptyState icon={<Bus className="size-5" />} title={q ? "No trips match your search" : "Nothing here"}>
            {view === "upcoming" ? "No upcoming trips. Plan one to start registering students." : "Try another tab."}
          </EmptyState>
        </Card>
      ) : view === "past" ? (
        <PastTable trips={list} />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {list.map((t) => (
            <TripCard key={t.id} trip={t} today={today} />
          ))}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, sub, warn }: { label: string; value: React.ReactNode; sub?: string; warn?: boolean }) {
  return (
    <Card className={cx("px-4 py-3", warn && "border-warning/50")}>
      <p className="text-[12px] text-muted">{label}</p>
      <p className="mt-0.5 text-xl font-semibold tabular">{value}</p>
      {sub && <p className="text-[12px] text-muted">{sub}</p>}
    </Card>
  );
}

function countdown(depart: string, today: string, status: string) {
  if (status === "DEPARTED") return { text: "On the trip now", urgent: true };
  if (status === "RETURNED") return { text: "Returned", urgent: false };
  if (status === "CANCELLED") return { text: "Cancelled", urgent: false };
  const days = Math.round((Date.parse(depart) - Date.parse(today)) / 86_400_000);
  if (days < 0) return { text: `Departure was ${-days} ${days === -1 ? "day" : "days"} ago`, urgent: true };
  if (days === 0) return { text: "Leaves today", urgent: true };
  if (days === 1) return { text: "Leaves tomorrow", urgent: true };
  return { text: `Leaves in ${days} days`, urgent: days <= 3 };
}

function TripCard({ trip: t, today }: { trip: TripCardData; today: string }) {
  const s = tripSummary(t, t.participants);
  const fee = Number(t.feeAmount);
  const depart = fromDbDate(t.departDate);
  const tone = t.status === "DEPARTED" ? "warning" : t.status === "OPEN" ? "accent" : t.status === "CANCELLED" ? "critical" : "neutral";
  const cd = countdown(depart, today, t.status);
  const nights = Math.round((t.returnDate.getTime() - t.departDate.getTime()) / 86_400_000);

  // What still needs doing before departure.
  const todo: string[] = [];
  if (t.status === "OPEN" || t.status === "CLOSED") {
    if (s.registered === 0) todo.push("No students added yet");
    if (s.consentPending > 0) {
      const late = t.consentDeadline && fromDbDate(t.consentDeadline) < today;
      todo.push(`${s.consentPending} consent ${late ? "overdue" : "pending"}`);
    }
    if (fee > 0 && s.feePending > 0) {
      const late = t.feeDeadline && fromDbDate(t.feeDeadline) < today;
      todo.push(`${s.feePending} fee${s.feePending === 1 ? "" : "s"} ${late ? "overdue" : "unpaid"}`);
    }
    if (s.registered > 0 && t._count.vehicles === 0) todo.push("No transport added");
    if (t.consentDeadline && fromDbDate(t.consentDeadline) >= today && fromDbDate(t.consentDeadline) <= addDays(today, 2) && s.consentPending > 0) {
      todo.push(`Consent deadline ${formatDate(fromDbDate(t.consentDeadline))}`);
    }
  }

  return (
    <Link href={`/trips/${t.id}`} className="group">
      <Card className="flex h-full flex-col overflow-hidden transition-colors group-hover:border-line-strong">
        <div className={cx("flex items-center justify-between gap-2 px-5 py-2 text-[12px] font-medium", cd.urgent ? "bg-warning/15 text-ink" : "bg-surface-2/60 text-ink-2")}>
          <span className="inline-flex items-center gap-1.5">
            <Clock className="size-3.5" aria-hidden /> {cd.text}
          </span>
          <Pill tone={tone}>{TRIP_STATUS_LABELS[t.status]}</Pill>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <p className="text-[12px] text-muted">
            {TRIP_TYPE_LABELS[t.type]}
            {t.overnight && (
              <span className="ml-2 inline-flex items-center gap-1">
                <BedDouble className="size-3.5" aria-hidden /> {nights > 0 ? `${nights} night${nights === 1 ? "" : "s"}` : "Night stay"}
              </span>
            )}
          </p>
          <h3 className="mt-1 text-lg font-semibold tracking-tight group-hover:underline">{t.title}</h3>
          <ul className="mt-2 flex flex-col gap-1 text-[13px] text-ink-2">
            <li className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden /> {t.destination}
            </li>
            <li className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden /> {tripWhen(t)}
            </li>
            <li className="flex items-start gap-2">
              <UserRound className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden /> {t.inChargeName}
              {t._count.staff > 0 && <span className="text-muted">+{t._count.staff} staff</span>}
            </li>
            <li className="flex items-start gap-2">
              <Bus className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden />
              {t._count.vehicles > 0 ? `${t._count.vehicles} vehicle${t._count.vehicles === 1 ? "" : "s"}` : "No vehicles yet"}
              {fee > 0 ? ` · Rs. ${fee.toLocaleString()} per student` : " · Free trip"}
            </li>
          </ul>

          {t.status !== "CANCELLED" && (
            <div className="mt-auto flex flex-col gap-2.5 pt-4">
              {t.seats != null ? (
                <Meter label="Seats filled" value={s.registered} total={t.seats} />
              ) : (
                <p className="flex items-center gap-1.5 text-[12px] text-muted">
                  <Users className="size-3.5" aria-hidden />
                  <span className="font-medium text-ink tabular">{s.registered}</span> students registered
                </p>
              )}
              {s.registered > 0 && <Meter label="Consent received" value={s.consentReceived} total={s.registered} />}
              {s.registered > 0 && fee > 0 && <Meter label="Fee paid" value={s.feePaid} total={s.registered} />}
            </div>
          )}
        </div>
        {todo.length > 0 && (
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-line bg-warning/8 px-5 py-2.5 text-[12px] text-ink-2">
            <AlertTriangle className="size-3.5 shrink-0 text-ink-2" aria-hidden />
            {todo.map((x) => (
              <span key={x}>{x}</span>
            ))}
          </div>
        )}
      </Card>
    </Link>
  );
}

function PastTable({ trips }: { trips: TripCardData[] }) {
  return (
    <Card className="overflow-hidden">
      <Table>
        <thead>
          <tr>
            <Th>Trip</Th>
            <Th>Dates</Th>
            <Th>Teacher in charge</Th>
            <Th className="text-right">Students</Th>
            <Th className="text-right">Fee collected</Th>
            <Th>Status</Th>
          </tr>
        </thead>
        <tbody>
          {trips.map((t) => {
            const s = tripSummary(t, t.participants);
            return (
              <tr key={t.id} className="hover:bg-surface-2/50">
                <Td>
                  <Link href={`/trips/${t.id}`} className="font-medium hover:underline">
                    {t.title}
                  </Link>
                  <span className="block text-[12px] text-muted">
                    {TRIP_TYPE_LABELS[t.type]} · {t.destination}
                  </span>
                </Td>
                <Td className="whitespace-nowrap text-[13px]">{tripWhen(t)}</Td>
                <Td>{t.inChargeName}</Td>
                <Td className="text-right tabular">{s.registered}</Td>
                <Td className="text-right tabular">{Number(t.feeAmount) > 0 ? `Rs. ${s.collected.toLocaleString()}` : "Free"}</Td>
                <Td>
                  <Pill tone={t.status === "CANCELLED" ? "critical" : "neutral"}>{TRIP_STATUS_LABELS[t.status]}</Pill>
                </Td>
              </tr>
            );
          })}
        </tbody>
      </Table>
    </Card>
  );
}
