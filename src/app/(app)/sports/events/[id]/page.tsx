import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarDays, MapPin, Users } from "lucide-react";
import { Card, EmptyState, Skeleton } from "@/components/ui";
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
  const [event, sports] = await Promise.all([
    prisma.sportsEvent.findUnique({
      where: { id },
      include: {
        teams: {
          orderBy: { sport: { name: "asc" } },
          include: { sport: true, _count: { select: { members: { where: { status: "SELECTED" } } } } },
        },
      },
    }),
    prisma.sport.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  if (!event) notFound();
  const admin = can.administer(user.role);
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

      {admin && <AddSport eventId={event.id} sports={sports.filter((sp) => !event.teams.some((t) => t.sportId === sp.id))} />}

      {event.teams.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="size-5" />} title="No sports added yet">
            Add a sport above, such as Badminton, then pick its players.
          </EmptyState>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {event.teams.map((t) => (
            <Card key={t.id} className="p-5">
              <div className="flex items-start justify-between gap-2">
                <Link href={`/sports/teams/${t.id}`} className="group min-w-0">
                  <p className="text-lg font-semibold tracking-tight group-hover:underline">{t.sport.name}</p>
                  <p className="mt-0.5 truncate text-[12px] text-muted">{t.manager ? `Manager: ${t.manager}` : "No manager set"}</p>
                  <p className="mt-3 flex items-center gap-1.5 text-sm">
                    <Users className="size-4 text-muted" aria-hidden />
                    <span className="font-semibold tabular">{t._count.members}</span> players
                  </p>
                </Link>
                {admin && <RemoveSport eventId={event.id} sportId={t.sportId} name={t.sport.name} />}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
