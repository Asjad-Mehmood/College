import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarDays, MapPin, Users } from "lucide-react";
import { Card, CardHeader, EmptyState, Skeleton } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, fromDbDate } from "@/lib/time";
import { AddSport, DeleteEvent, RemoveSport } from "./event-forms";

export const metadata: Metadata = { title: "Sports event" };

export default function EventPage(props: PageProps<"/sports/events/[id]">) {
  return (
    <div>
      <Link href="/sports" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Sports events
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Event params={props.params} />
      </Suspense>
    </div>
  );
}

async function Event({ params }: { params: PageProps<"/sports/events/[id]">["params"] }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [event, sports, houses] = await Promise.all([
    prisma.sportsEvent.findUnique({
      where: { id },
      include: {
        teams: {
          orderBy: [{ sport: { name: "asc" } }, { house: { name: "asc" } }],
          include: { sport: true, house: true, _count: { select: { members: { where: { status: "SELECTED" } } } } },
        },
      },
    }),
    prisma.sport.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
    prisma.house.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!event) notFound();
  const admin = can.administer(user.role);
  const bySport = new Map<number, typeof event.teams>();
  for (const t of event.teams) bySport.set(t.sportId, [...(bySport.get(t.sportId) ?? []), t]);
  const start = fromDbDate(event.startDate);
  const end = fromDbDate(event.endDate);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{event.name}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4 text-muted" aria-hidden /> {start === end ? formatDate(start) : `${formatDate(start)} – ${formatDate(end)}`}
            </span>
            {event.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-muted" aria-hidden /> {event.venue}
              </span>
            )}
          </p>
        </div>
        {admin && <DeleteEvent id={event.id} />}
      </div>

      {admin && <AddSport eventId={event.id} sports={sports} houses={houses.map((h) => ({ id: h.id, name: h.name, color: h.color }))} />}

      {bySport.size === 0 ? (
        <Card>
          <EmptyState icon={<Users className="size-5" />} title="No sports added yet">
            Add a sport above, such as Badminton, to start picking house teams.
          </EmptyState>
        </Card>
      ) : (
        [...bySport.entries()].map(([sportId, teams]) => (
          <Card key={sportId}>
            <CardHeader
              title={teams[0].sport.name}
              description={`${teams.reduce((n, t) => n + t._count.members, 0)} players across ${teams.length} house ${teams.length === 1 ? "team" : "teams"}`}
              actions={admin && <RemoveSport eventId={event.id} sportId={sportId} name={teams[0].sport.name} />}
            />
            <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-4">
              {teams.map((t) => (
                <Link key={t.id} href={`/sports/teams/${t.id}`} className="group rounded-xl border border-line p-4 transition-colors hover:border-line-strong" style={{ borderTopColor: t.house.color, borderTopWidth: 3 }}>
                  <p className="font-semibold group-hover:underline">{t.house.name}</p>
                  <p className="mt-0.5 truncate text-[12px] text-muted">{t.manager ? `Manager: ${t.manager}` : "No manager set"}</p>
                  <p className="mt-3 flex items-center gap-1.5 text-sm">
                    <Users className="size-4 text-muted" aria-hidden />
                    <span className="font-semibold tabular">{t._count.members}</span> players
                  </p>
                </Link>
              ))}
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
