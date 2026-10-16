import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Bus, CalendarDays, MapPin, Plus, UserRound } from "lucide-react";
import { Meter } from "@/components/meter";
import { ButtonLink, Card, EmptyState, PageHeader, Pill, Skeleton } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { TRIP_STATUS_LABELS, TRIP_TYPE_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { tripSummary, tripWhen } from "@/lib/trips";

export const metadata: Metadata = { title: "Trips" };

export default function TripsPage() {
  return (
    <div>
      <Suspense fallback={<PageHeader title="Trips" description="Study tours, visits and events away from college." />}>
        <Header />
      </Suspense>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <TripList />
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
  return prisma.trip.findMany({
    orderBy: [{ departDate: "desc" }, { id: "desc" }],
    take: 200,
    include: {
      participants: { select: { status: true, consent: true, feePaid: true } },
      _count: { select: { vehicles: true } },
    },
  });
}

async function TripList() {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const trips = await loadTrips();
  const onTrip = trips.filter((t) => t.status === "DEPARTED");
  const upcoming = trips.filter((t) => t.status === "OPEN" || t.status === "CLOSED").reverse();
  const past = trips.filter((t) => t.status === "RETURNED" || t.status === "CANCELLED");

  if (trips.length === 0) {
    return (
      <Card>
        <EmptyState icon={<Bus className="size-5" />} title="No trips yet">
          Plan a trip to start registering students.
        </EmptyState>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-8">
      {onTrip.length > 0 && <Section title="On the trip now" trips={onTrip} />}
      <Section title="Upcoming" trips={upcoming} empty="No upcoming trips." />
      {past.length > 0 && <Section title="Past trips" trips={past} />}
    </div>
  );
}

function Section({ title, trips, empty }: { title: string; trips: TripCardData[]; empty?: string }) {
  return (
    <section>
      <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">{title}</h2>
      {trips.length === 0 ? (
        <p className="text-sm text-muted">{empty}</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {trips.map((t) => (
            <TripCard key={t.id} trip={t} />
          ))}
        </div>
      )}
    </section>
  );
}

function TripCard({ trip: t }: { trip: TripCardData }) {
  const s = tripSummary(t, t.participants);
  const fee = Number(t.feeAmount);
  const tone = t.status === "DEPARTED" ? "warning" : t.status === "OPEN" ? "accent" : t.status === "CANCELLED" ? "critical" : "neutral";
  return (
    <Link href={`/trips/${t.id}`} className="group">
      <Card className="flex h-full flex-col p-5 transition-colors group-hover:border-line-strong">
        <div className="flex flex-wrap items-center gap-2">
          <Pill tone={tone}>{TRIP_STATUS_LABELS[t.status]}</Pill>
          <span className="text-[12px] text-muted">{TRIP_TYPE_LABELS[t.type]}</span>
        </div>
        <h3 className="mt-2 text-lg font-semibold tracking-tight group-hover:underline">{t.title}</h3>
        <ul className="mt-2 flex flex-col gap-1 text-[13px] text-ink-2">
          <li className="flex items-start gap-2">
            <MapPin className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden /> {t.destination}
          </li>
          <li className="flex items-start gap-2">
            <CalendarDays className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden /> {tripWhen(t)}
          </li>
          <li className="flex items-start gap-2">
            <UserRound className="mt-0.5 size-3.5 shrink-0 text-muted" aria-hidden /> {t.inChargeName}
          </li>
        </ul>
        {t.status !== "CANCELLED" && (
          <div className="mt-auto flex flex-col gap-2.5 pt-4">
            {t.seats != null ? (
              <Meter label="Seats filled" value={s.registered} total={t.seats} />
            ) : (
              <p className="text-[12px] text-muted">
                <span className="font-medium text-ink tabular">{s.registered}</span> students registered
              </p>
            )}
            {s.registered > 0 && <Meter label="Consent received" value={s.consentReceived} total={s.registered} />}
            {s.registered > 0 && fee > 0 && <Meter label="Fee paid" value={s.feePaid} total={s.registered} />}
          </div>
        )}
      </Card>
    </Link>
  );
}
