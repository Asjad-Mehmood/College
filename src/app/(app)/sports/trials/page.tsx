import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ClipboardList } from "lucide-react";
import { Card, CardHeader, EmptyState, PageHeader, Pill, Skeleton } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { scoped } from "@/lib/scope";
import { getSettings } from "@/lib/settings";
import { formatDate, fromDbDate, localParts } from "@/lib/time";
import { NewTrialForm } from "./trial-forms";

export const metadata: Metadata = { title: "Trials" };

export default function TrialsPage() {
  return (
    <div>
      <PageHeader title="Trials" description="Select players for the college teams." />
      <Suspense fallback={<Skeleton className="h-80 rounded-2xl" />}>
        <Content />
      </Suspense>
    </div>
  );
}

async function Content() {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const prisma = await scoped();
  const settings = await getSettings();
  const [trials, sports] = await Promise.all([
    prisma.trial.findMany({ orderBy: { trialDate: "desc" }, take: 100, include: { sport: true, candidates: { select: { result: true } } } }),
    prisma.sport.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  return (
    <div className="flex flex-col gap-5">
      {can.administer(user.role) && (
        <Card>
          <CardHeader title="New trial" />
          <div className="p-5">
            <NewTrialForm sports={sports} today={localParts(new Date(), settings.timezone).date} />
          </div>
        </Card>
      )}
      <Card className="overflow-hidden">
        {trials.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-5" />} title="No trials yet" />
        ) : (
          <ul className="divide-y divide-line">
            {trials.map((t) => (
              <li key={t.id}>
                <Link href={`/sports/trials/${t.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-2/50">
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium">{t.sport.name} trial</span>
                    <span className="block text-[12px] text-muted">
                      {formatDate(fromDbDate(t.trialDate), { weekday: true })}
                      {t.venue && ` · ${t.venue}`}
                    </span>
                  </span>
                  <span className="text-[13px] text-ink-2 tabular">{t.candidates.length} candidates</span>
                  <Pill tone="good">{t.candidates.filter((c) => c.result === "SELECTED").length} selected</Pill>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
