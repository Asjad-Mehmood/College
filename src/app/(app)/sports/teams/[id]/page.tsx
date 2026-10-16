import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Pill, Skeleton, buttonClass } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { whatsAppLink } from "@/lib/messages";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatDate, fromDbDate } from "@/lib/time";
import { AddPlayers, Achievements, DeleteTeam, ManagerField, SquadTable } from "./squad";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage(props: PageProps<"/sports/teams/[id]">) {
  return (
    <div>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Team params={props.params} />
      </Suspense>
    </div>
  );
}

async function Team({ params }: { params: PageProps<"/sports/teams/[id]">["params"] }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [team, settings] = await Promise.all([
    prisma.team.findUnique({
      where: { id },
      include: {
        sport: true,
        house: true,
        event: true,
        members: { orderBy: [{ student: { section: "asc" } }, { rollNo: "asc" }], include: { student: { select: { fullName: true, section: true, photoUrl: true, parentPhone: true } } } },
        achievements: { orderBy: { achievedOn: "desc" }, include: { student: { select: { fullName: true } } } },
      },
    }),
    getSettings(),
  ]);
  if (!team) notFound();
  const admin = can.administer(user.role);
  const selected = team.members.filter((m) => m.status === "SELECTED").length;

  return (
    <div className="flex flex-col gap-5">
      <Link href={`/sports/events/${team.eventId}`} className="no-print inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {team.event.name}
      </Link>
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="size-3 rounded-full" style={{ background: team.house.color }} aria-hidden />
            <Pill tone="accent">{team.sport.name}</Pill>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">{team.house.name}</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            {selected} players · {team.members.length - selected} waitlisted or dropped
          </p>
          <div className="no-print mt-2">
            <ManagerField teamId={team.id} manager={team.manager} editable={admin} />
          </div>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <a href={`/team-sheet/${team.id}`} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
            <Printer className="size-4" aria-hidden /> Team sheet
          </a>
          {admin && <DeleteTeam id={team.id} />}
        </div>
      </div>
      {admin && <AddPlayers teamId={team.id} />}
      <SquadTable
        editable={admin}
        members={team.members.map((m) => ({
          id: m.id,
          rollNo: m.rollNo,
          fullName: m.student.fullName,
          section: m.student.section,
          photoUrl: m.student.photoUrl,
          role: m.role,
          jerseyNo: m.jerseyNo,
          position: m.position,
          status: m.status,
          consent: m.consent,
          medicalNote: m.medicalNote,
          overrideNote: m.overrideNote,
          message: whatsAppLink(
            m.student.parentPhone,
            `Respected Parent, ${m.student.fullName} has been selected for the ${team.house.name} ${team.sport.name} team at ${team.event.name}. Please contact the sports office. – ${settings.collegeName}`,
          ),
        }))}
      />
      <Achievements
        teamId={team.id}
        editable={admin}
        items={team.achievements.map((a) => ({ id: a.id, event: a.event, position: a.position, date: formatDate(fromDbDate(a.achievedOn)), who: a.student?.fullName ?? null }))}
      />
    </div>
  );
}
