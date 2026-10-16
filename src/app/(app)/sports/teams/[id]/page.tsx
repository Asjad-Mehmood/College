import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, Printer } from "lucide-react";
import { Pill, Skeleton, buttonClass } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { whatsAppLink } from "@/lib/messages";
import { prisma } from "@/lib/prisma";
import { getClassOptions } from "@/lib/records";
import { getSettings } from "@/lib/settings";
import { formatDate, fromDbDate } from "@/lib/time";
import { AddPlayers, Achievements, DeleteTeam, SquadTable } from "./squad";

export const metadata: Metadata = { title: "Team" };

export default function TeamPage(props: PageProps<"/sports/teams/[id]">) {
  return (
    <div>
      <Link href="/sports" className="no-print mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Sports
      </Link>
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
  const [team, settings, { sections }] = await Promise.all([
    prisma.team.findUnique({
      where: { id },
      include: {
        sport: true,
        members: { orderBy: [{ student: { section: "asc" } }, { rollNo: "asc" }], include: { student: { select: { fullName: true, section: true, photoUrl: true, parentPhone: true } } } },
        achievements: { orderBy: { achievedOn: "desc" }, include: { student: { select: { fullName: true } } } },
      },
    }),
    getSettings(),
    getClassOptions(),
  ]);
  if (!team) notFound();
  const admin = can.administer(user.role);
  const label = `${team.sport.name} · ${team.category}`;
  const selected = team.members.filter((m) => m.status === "SELECTED").length;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone="accent">{team.season}</Pill>
            <span className="text-[13px] text-muted">{team.coach ? `Coach ${team.coach}` : "No coach set"}</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">{label}</h1>
          <p className="mt-0.5 text-sm text-ink-2">
            {selected} in squad · {team.members.length - selected} waitlisted or dropped
          </p>
        </div>
        <div className="no-print flex flex-wrap items-center gap-2">
          <a href={`/team-sheet/${team.id}`} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
            <Printer className="size-4" aria-hidden /> Team sheet
          </a>
          {admin && <DeleteTeam id={team.id} />}
        </div>
      </div>
      {admin && <AddPlayers teamId={team.id} sections={sections} />}
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
            `Respected Parent, ${m.student.fullName} has been selected for the college ${label} team (${team.season}). Please contact the sports office. – ${settings.collegeName}`,
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
