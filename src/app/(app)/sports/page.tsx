import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Trophy, Users } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, Pill, Skeleton } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentSeason } from "@/lib/sports";
import { NewTeamForm, SportsManager } from "./sports-forms";

export const metadata: Metadata = { title: "Sports" };

export default function SportsPage() {
  return (
    <div>
      <PageHeader title="Sports" description="Teams, squads and trials for every sport." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const admin = can.administer(user.role);
  const sports = await prisma.sport.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: { teams: { orderBy: [{ season: "desc" }, { category: "asc" }], include: { _count: { select: { members: { where: { status: "SELECTED" } } } } } } },
  });
  const withTeams = sports.filter((s) => s.teams.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {admin && (
        <Card>
          <CardHeader title="New team" description="One team per sport, season and category." />
          <div className="p-5">
            <NewTeamForm sports={sports.filter((s) => s.active).map((s) => ({ id: s.id, name: s.name }))} season={currentSeason()} />
          </div>
        </Card>
      )}
      {withTeams.length === 0 ? (
        <Card>
          <EmptyState icon={<Trophy className="size-5" />} title="No teams yet">
            Create a team above, then add players to its squad.
          </EmptyState>
        </Card>
      ) : (
        withTeams.map((s) => (
          <section key={s.id}>
            <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">
              {s.name}
              {!s.active && " · inactive"}
            </h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {s.teams.map((t) => (
                <Link key={t.id} href={`/sports/teams/${t.id}`} className="group">
                  <Card className="p-4 transition-colors group-hover:border-line-strong">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold group-hover:underline">{t.category}</p>
                      <Pill>{t.season}</Pill>
                    </div>
                    <p className="mt-1 text-[13px] text-ink-2">{t.coach ? `Coach ${t.coach}` : "No coach set"}</p>
                    <p className="mt-3 flex items-center gap-1.5 text-sm">
                      <Users className="size-4 text-muted" aria-hidden />
                      <span className="font-semibold tabular">{t._count.members}</span> in squad
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          </section>
        ))
      )}
      {admin && (
        <Card>
          <CardHeader title="Sports" description="The list offered when creating teams and trials." />
          <SportsManager sports={sports.map((s) => ({ id: s.id, name: s.name, coach: s.coach, active: s.active, teams: s.teams.length }))} />
        </Card>
      )}
    </div>
  );
}
