import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { Inbox } from "lucide-react";
import { Avatar, Card, CardHeader, EmptyState, Skeleton, StrikeBadge } from "@/components/ui";
import { LiveClock } from "@/components/live-clock";
import { can, requireUser } from "@/lib/auth";
import { REASON_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { ordinal, strikeLevel } from "@/lib/strikes";
import { formatDate, formatMinutes, formatTime, localParts, monthStart, toDbDate } from "@/lib/time";
import { GateConsole } from "./gate-console";

export const metadata: Metadata = { title: "Gate check-in" };

export default function GatePage() {
  return (
    <div>
      <Suspense fallback={<HeaderSkeleton />}>
        <GateHeader />
      </Suspense>
      <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Suspense fallback={<Skeleton className="h-24 rounded-2xl" />}>
          <ConsoleForUser />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
          <TodayList />
        </Suspense>
      </div>
    </div>
  );
}

function HeaderSkeleton() {
  return (
    <div className="mb-6 flex items-end justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gate check-in</h1>
        <Skeleton className="mt-2 h-4 w-64" />
      </div>
    </div>
  );
}

async function GateHeader() {
  await requireUser(["ADMIN", "GATE"]);
  const settings = await getSettings();
  const today = localParts(new Date(), settings.timezone).date;
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Gate check-in</h1>
        <p className="mt-1 text-sm text-ink-2">
          {formatDate(today, { weekday: true })} · College starts{" "}
          <span className="font-medium text-ink">{formatMinutes(settings.startMinutes)}</span> ·{" "}
          {settings.gracePeriodMins} min grace · {settings.schedule === "WINTER" ? "Winter" : "Summer"} timing
        </p>
      </div>
      <LiveClock timeZone={settings.timezone} />
    </div>
  );
}

async function ConsoleForUser() {
  await requireUser(["ADMIN", "GATE"]);
  return <GateConsole />;
}

async function TodayList() {
  const user = await requireUser(["ADMIN", "GATE"]);
  const settings = await getSettings();
  const today = localParts(new Date(), settings.timezone).date;

  const records = await prisma.lateRecord.findMany({
    where: { lateDate: toDbDate(today) },
    orderBy: { arrivedAt: "desc" },
    include: { student: { select: { fullName: true, program: true, section: true, photoUrl: true } } },
  });
  // Each student has at most one record per day, so today's strike number is
  // their total for the month so far.
  const counts = records.length
    ? await prisma.lateRecord.groupBy({
        by: ["rollNo"],
        where: {
          rollNo: { in: records.map((r) => r.rollNo) },
          lateDate: { gte: toDbDate(monthStart(today)), lte: toDbDate(today) },
        },
        _count: { _all: true },
      })
    : [];
  const countByRoll = new Map(counts.map((c) => [c.rollNo, c._count._all]));
  const linkProfiles = can.viewReports(user.role);

  return (
    <Card className="xl:sticky xl:top-6">
      <CardHeader
        title="Logged today"
        description={`${records.length} late ${records.length === 1 ? "arrival" : "arrivals"} so far`}
      />
      {records.length === 0 ? (
        <EmptyState icon={<Inbox className="size-5" />} title="No late arrivals yet">
          Entries appear here as soon as they&apos;re saved.
        </EmptyState>
      ) : (
        <ul className="max-h-[70vh] divide-y divide-line overflow-y-auto">
          {records.map((r) => {
            const count = countByRoll.get(r.rollNo) ?? 1;
            const name = linkProfiles ? (
              <Link href={`/students/${encodeURIComponent(r.rollNo)}`} className="hover:underline">
                {r.student.fullName}
              </Link>
            ) : (
              r.student.fullName
            );
            return (
              <li key={r.id} className="flex items-center gap-3 px-5 py-3">
                <Avatar name={r.student.fullName} photoUrl={r.student.photoUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{name}</p>
                  <p className="truncate text-[12px] text-muted">
                    <span className="font-mono">{r.rollNo}</span> · {r.student.program} {r.student.section} ·{" "}
                    {REASON_LABELS[r.reason]}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="tabular text-[13px] font-medium">{formatTime(r.arrivedAt, settings.timezone)}</span>
                  <StrikeBadge level={strikeLevel(count, settings)} label={ordinal(count)} />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
