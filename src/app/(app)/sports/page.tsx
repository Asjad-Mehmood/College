import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, MapPin, Trophy } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, Pill, Skeleton } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatDate, fromDbDate, localParts } from "@/lib/time";
import { HousesManager, NewEventForm, SportsManager } from "./sports-forms";

export const metadata: Metadata = { title: "Sports" };

export default function SportsPage() {
  return (
    <div>
      <PageHeader title="Sports events" description="College sports events, their sports and house teams." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const admin = can.administer(user.role);
  const settings = await getSettings();
  const today = localParts(new Date(), settings.timezone).date;
  const [events, sports, houses] = await Promise.all([
    prisma.sportsEvent.findMany({
      orderBy: { startDate: "desc" },
      include: { teams: { select: { sportId: true, _count: { select: { members: { where: { status: "SELECTED" } } } } } } },
    }),
    prisma.sport.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { _count: { select: { teams: true } } } }),
    prisma.house.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] }),
  ]);

  return (
    <div className="flex flex-col gap-5">
      {admin && (
        <Card>
          <CardHeader title="New sports event" description="Then add sports to it (Badminton, Cricket…) and pick each house's players." />
          <div className="p-5">
            <NewEventForm today={today} />
          </div>
        </Card>
      )}
      {events.length === 0 ? (
        <Card>
          <EmptyState icon={<Trophy className="size-5" />} title="No sports events yet">
            Create your first event above.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {events.map((e) => {
            const start = fromDbDate(e.startDate);
            const end = fromDbDate(e.endDate);
            const live = start <= today && today <= end;
            const sportsCount = new Set(e.teams.map((t) => t.sportId)).size;
            const players = e.teams.reduce((n, t) => n + t._count.members, 0);
            return (
              <Link key={e.id} href={`/sports/events/${e.id}`} className="group">
                <Card className="h-full p-5 transition-colors group-hover:border-line-strong">
                  <div className="flex items-center gap-2">
                    {live ? <Pill tone="accent">Happening now</Pill> : end < today ? <Pill>Finished</Pill> : <Pill tone="warning">Upcoming</Pill>}
                  </div>
                  <h2 className="mt-2 text-lg font-semibold tracking-tight group-hover:underline">{e.name}</h2>
                  <p className="mt-1 flex items-center gap-1.5 text-[13px] text-ink-2">
                    <CalendarDays className="size-3.5 text-muted" aria-hidden />
                    {start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`}
                  </p>
                  {e.venue && (
                    <p className="mt-0.5 flex items-center gap-1.5 text-[13px] text-ink-2">
                      <MapPin className="size-3.5 text-muted" aria-hidden /> {e.venue}
                    </p>
                  )}
                  <p className="mt-3 text-[13px] text-ink-2">
                    <span className="font-semibold text-ink tabular">{sportsCount}</span> sports ·{" "}
                    <span className="font-semibold text-ink tabular">{players}</span> players
                  </p>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
      {admin && (
        <div className="grid items-start gap-5 lg:grid-cols-2">
          <Card>
            <CardHeader title="Houses" description="Teams are made per house in each sport." />
            <HousesManager houses={houses.map((h) => ({ id: h.id, name: h.name, color: h.color, inCharge: h.inCharge, active: h.active }))} />
          </Card>
          <Card>
            <CardHeader title="Sports" description="Add any sport; it can then be used in every event." />
            <SportsManager sports={sports.map((s) => ({ id: s.id, name: s.name, coach: s.coach, active: s.active, teams: s._count.teams }))} />
          </Card>
        </div>
      )}
    </div>
  );
}
