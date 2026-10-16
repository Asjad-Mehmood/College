import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { Skeleton } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClassOptions } from "@/lib/records";
import { formatDate, fromDbDate } from "@/lib/time";
import { DeleteTrial, TrialBoard } from "../trial-forms";

export const metadata: Metadata = { title: "Trial" };

export default function TrialPage(props: PageProps<"/sports/trials/[id]">) {
  return (
    <div>
      <Link href="/sports/trials" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Trials
      </Link>
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Trial params={props.params} />
      </Suspense>
    </div>
  );
}

async function Trial({ params }: { params: PageProps<"/sports/trials/[id]">["params"] }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const trial = await prisma.trial.findUnique({
    where: { id },
    include: {
      sport: { include: { teams: { orderBy: { event: { startDate: "desc" } }, include: { event: true } } } },
      candidates: { orderBy: [{ student: { section: "asc" } }, { rollNo: "asc" }], include: { student: { select: { fullName: true, section: true, photoUrl: true, batch: { select: { name: true } } } } } },
    },
  });
  if (!trial) notFound();
  const { sections } = await getClassOptions();
  const admin = can.administer(user.role);
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{trial.sport.name} trial</h1>
          <p className="mt-1 text-sm text-ink-2">
            {formatDate(fromDbDate(trial.trialDate), { weekday: true })}
            {trial.venue && ` · ${trial.venue}`}
          </p>
        </div>
        {admin && <DeleteTrial id={trial.id} />}
      </div>
      <TrialBoard
        trialId={trial.id}
        editable={admin}
        sections={sections}
        teams={trial.sport.teams.map((t) => ({ id: t.id, label: t.event.name }))}
        candidates={trial.candidates.map((c) => ({
          id: c.id,
          fullName: c.student.fullName,
          rollNo: c.rollNo,
          section: c.student.section,
          batch: c.student.batch?.name ?? null,
          photoUrl: c.student.photoUrl,
          result: c.result,
          note: c.note,
        }))}
      />
    </div>
  );
}
