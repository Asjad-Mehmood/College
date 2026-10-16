import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bus,
  Banknote,
  CalendarDays,
  Clock,
  DoorOpen,
  Inbox,
  Minus,
  ShieldAlert,
  Users,
} from "lucide-react";
import { BarList, TrendChart } from "@/components/charts";
import {
  Avatar,
  ButtonLink,
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
  StrikeBadge,
  cx,
} from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { SEVERITY_LABELS, SEVERITY_LEVEL } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { STRIKE_LABELS, strikeLevel } from "@/lib/strikes";
import {
  addDays,
  formatDate,
  formatMonth,
  formatTime,
  fromDbDate,
  localParts,
  monthStart,
  toDbDate,
} from "@/lib/time";

export const metadata: Metadata = { title: "Dashboard" };

export default function DashboardPage() {
  return (
    <div>
      <Suspense fallback={<PageHeader title="Dashboard" description="Today at a glance." />}>
        <Header />
      </Suspense>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
      <Suspense fallback={<Skeleton className="mt-5 h-64 rounded-2xl" />}>
        <ViolationsPanel />
      </Suspense>
      <Suspense fallback={<Skeleton className="mt-5 h-40 rounded-2xl" />}>
        <TripsPanel />
      </Suspense>
    </div>
  );
}

async function Header() {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const settings = await getSettings();
  const today = localParts(new Date(), settings.timezone).date;
  return (
    <PageHeader
      title="Dashboard"
      description={`${formatDate(today, { weekday: true })} · ${settings.collegeName}`}
      actions={
        can.logLate(user.role) && (
          <ButtonLink href="/gate" variant="primary">
            <DoorOpen className="size-4" aria-hidden /> Open gate mode
          </ButtonLink>
        )
      }
    />
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-32 rounded-2xl" />
        ))}
      </div>
      <div className="grid gap-5 lg:grid-cols-5">
        <Skeleton className="h-80 rounded-2xl lg:col-span-3" />
        <Skeleton className="h-80 rounded-2xl lg:col-span-2" />
      </div>
    </div>
  );
}

async function Dashboard() {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const settings = await getSettings();
  const today = localParts(new Date(), settings.timezone).date;
  const yesterday = addDays(today, -1);
  const mStart = toDbDate(monthStart(today));
  const trendStart = addDays(today, -29);

  const [
    todayCount,
    yesterdayCount,
    todayRecords,
    monthCounts,
    unpaidFines,
    meetings,
    trendRows,
    programRows,
  ] = await Promise.all([
    prisma.lateRecord.count({ where: { lateDate: toDbDate(today) } }),
    prisma.lateRecord.count({ where: { lateDate: toDbDate(yesterday) } }),
    prisma.lateRecord.findMany({
      where: { lateDate: toDbDate(today) },
      orderBy: { arrivedAt: "desc" },
      include: { student: { select: { fullName: true, program: true, section: true, photoUrl: true } } },
    }),
    prisma.lateRecord.groupBy({
      by: ["rollNo"],
      where: { lateDate: { gte: mStart, lte: toDbDate(today) } },
      _count: { _all: true },
      orderBy: { _count: { rollNo: "desc" } },
    }),
    prisma.lateRecord.aggregate({
      where: { fineAmount: { gt: 0 }, finePaid: false },
      _count: { _all: true },
      _sum: { fineAmount: true },
    }),
    prisma.lateRecord.count({ where: { actionTaken: "PARENT_MEETING", lateDate: { gte: mStart } } }),
    prisma.lateRecord.groupBy({
      by: ["lateDate"],
      where: { lateDate: { gte: toDbDate(trendStart), lte: toDbDate(today) } },
      _count: { _all: true },
    }),
    prisma.$queryRaw<{ program: string; lates: bigint; students: bigint }[]>`
      SELECT s.program, COUNT(*) AS lates, COUNT(DISTINCT r.roll_no) AS students
      FROM late_records r JOIN students s ON s.roll_no = r.roll_no
      WHERE r.late_date >= ${mStart} AND r.late_date <= ${toDbDate(today)}
      GROUP BY s.program
      ORDER BY lates DESC
    `,
  ]);

  const countByRoll = new Map(monthCounts.map((c) => [c.rollNo, c._count._all]));
  const habitualToday = todayRecords.filter(
    (r) => (countByRoll.get(r.rollNo) ?? 0) >= settings.habitualThreshold,
  ).length;
  const habitualMonth = monthCounts.filter((c) => c._count._all >= settings.habitualThreshold).length;
  const monthTotal = monthCounts.reduce((sum, c) => sum + c._count._all, 0);

  const trendMap = new Map(trendRows.map((r) => [fromDbDate(r.lateDate), r._count._all]));
  const trend = Array.from({ length: 30 }, (_, i) => {
    const date = addDays(trendStart, i);
    return {
      date,
      label: new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", day: "numeric", month: "short" }).format(toDbDate(date)),
      count: trendMap.get(date) ?? 0,
    };
  });
  const trendTotal = trend.reduce((s, d) => s + d.count, 0);

  // Programs beyond the top 7 fold into "Other".
  const programs = programRows.slice(0, 7).map((p) => ({
    label: p.program,
    value: Number(p.lates),
    sub: `${Number(p.students)} students`,
  }));
  if (programRows.length > 7) {
    const rest = programRows.slice(7);
    programs.push({
      label: "Other",
      value: rest.reduce((s, p) => s + Number(p.lates), 0),
      sub: `${rest.reduce((s, p) => s + Number(p.students), 0)} students`,
    });
  }

  const topRolls = monthCounts.slice(0, 6);
  const topStudents = await prisma.student.findMany({
    where: { rollNo: { in: topRolls.map((t) => t.rollNo) } },
    select: { rollNo: true, fullName: true, program: true, section: true, photoUrl: true },
  });
  const studentByRoll = new Map(topStudents.map((s) => [s.rollNo, s]));
  const unpaidAmount = Number(unpaidFines._sum.fineAmount ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi
          icon={<Clock className="size-4" aria-hidden />}
          label="Late today"
          value={todayCount}
          href="/records?range=today"
          footer={<Delta today={todayCount} yesterday={yesterdayCount} />}
        />
        <Kpi
          icon={<Users className="size-4" aria-hidden />}
          label={`Habitual offenders today`}
          value={habitualToday}
          href="/records?range=today&habitual=1"
          footer={<span>{habitualMonth} this month ({settings.habitualThreshold}+ lates)</span>}
        />
        <Kpi
          icon={<CalendarDays className="size-4" aria-hidden />}
          label="Late this month"
          value={monthTotal}
          href="/records?range=month"
          footer={
            <span>
              {monthCounts.length} {monthCounts.length === 1 ? "student" : "students"} · {formatMonth(today)}
            </span>
          }
        />
        <Kpi
          icon={<Banknote className="size-4" aria-hidden />}
          label="Pending fines"
          value={unpaidFines._count._all}
          href="/records?range=all&fines=unpaid"
          footer={
            <span>
              Rs. {unpaidAmount.toLocaleString()} unpaid · {meetings} parent {meetings === 1 ? "meeting" : "meetings"}
            </span>
          }
        />
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="Late arrivals, last 30 days"
            description={`${trendTotal} in total · ${(trendTotal / 30).toFixed(1)} per day on average`}
          />
          <div className="px-3 pt-4 pb-2">
            <TrendChart data={trend} />
          </div>
          <details className="border-t border-line px-5 py-3 text-[13px]">
            <summary className="cursor-pointer font-medium text-ink-2 hover:text-ink">View as table</summary>
            <table className="mt-3 w-full text-left">
              <thead>
                <tr className="text-muted">
                  <th className="py-1 font-medium">Date</th>
                  <th className="py-1 text-right font-medium">Late</th>
                </tr>
              </thead>
              <tbody>
                {trend
                  .filter((d) => d.count > 0)
                  .reverse()
                  .map((d) => (
                    <tr key={d.date} className="border-t border-line">
                      <td className="py-1">{formatDate(d.date, { weekday: true })}</td>
                      <td className="py-1 text-right tabular">{d.count}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </details>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Late arrivals by program" description={formatMonth(today)} />
          <div className="px-5 py-5">
            {programs.length === 0 ? (
              <EmptyState title="No late arrivals this month" />
            ) : (
              <BarList data={programs} />
            )}
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader
            title="Today at the gate"
            description={`${todayCount} late ${todayCount === 1 ? "arrival" : "arrivals"}`}
            actions={
              <Link href="/records?range=today" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-ink hover:underline">
                View all <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          {todayRecords.length === 0 ? (
            <EmptyState icon={<Inbox className="size-5" />} title="Nobody has been logged late today" />
          ) : (
            <ul className="divide-y divide-line">
              {todayRecords.slice(0, 7).map((r) => {
                const count = countByRoll.get(r.rollNo) ?? 1;
                return (
                  <li key={r.id}>
                    <Link href={`/students/${encodeURIComponent(r.rollNo)}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/50">
                      <Avatar name={r.student.fullName} photoUrl={r.student.photoUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{r.student.fullName}</span>
                        <span className="block truncate text-[12px] text-muted">
                          {r.student.program} · {r.student.section}
                        </span>
                      </span>
                      <span className="text-right">
                        <span className="block text-[13px] font-medium tabular">{formatTime(r.arrivedAt, settings.timezone)}</span>
                        <span className="block text-[12px] text-muted">{r.minutesLate} min late</span>
                      </span>
                      <StrikeBadge level={strikeLevel(count, settings)} label={`${count}×`} />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card>
          <CardHeader
            title="Most late this month"
            description="Students to watch"
            actions={
              <Link href="/records?habitual=1" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-ink hover:underline">
                Habitual list <ArrowRight className="size-3.5" aria-hidden />
              </Link>
            }
          />
          {topRolls.length === 0 ? (
            <EmptyState icon={<Inbox className="size-5" />} title="No late arrivals this month" />
          ) : (
            <ul className="divide-y divide-line">
              {topRolls.map((t) => {
                const s = studentByRoll.get(t.rollNo);
                if (!s) return null;
                const count = t._count._all;
                const level = strikeLevel(count, settings);
                return (
                  <li key={t.rollNo}>
                    <Link href={`/students/${encodeURIComponent(t.rollNo)}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/50">
                      <Avatar name={s.fullName} photoUrl={s.photoUrl} size="sm" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{s.fullName}</span>
                        <span className="block truncate text-[12px] text-muted">
                          <span className="font-mono">{s.rollNo}</span> · {s.program} {s.section}
                        </span>
                      </span>
                      <span className="text-lg font-semibold tabular">{count}</span>
                      <span className="hidden sm:inline-flex">
                        <StrikeBadge level={level} label={STRIKE_LABELS[level]} />
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

async function TripsPanel() {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const trips = await prisma.trip.findMany({
    where: { status: { in: ["OPEN", "CLOSED", "DEPARTED"] } },
    orderBy: [{ departDate: "asc" }],
    take: 4,
    include: { participants: { where: { status: "REGISTERED" }, select: { consent: true, feePaid: true } } },
  });
  return (
    <Card className="mt-5">
      <CardHeader
        title="Trips"
        description={trips.length ? "Upcoming and in progress" : undefined}
        actions={
          <Link href="/trips" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-ink hover:underline">
            All trips <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      />
      {trips.length === 0 ? (
        <EmptyState icon={<Bus className="size-5" />} title="No upcoming trips" />
      ) : (
        <ul className="divide-y divide-line">
          {trips.map((t) => {
            const pending = t.participants.filter((p) => p.consent !== "RECEIVED").length;
            return (
              <li key={t.id}>
                <Link href={`/trips/${t.id}`} className="flex flex-wrap items-center gap-3 px-5 py-3 hover:bg-surface-2/50">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{t.title}</span>
                    <span className="block truncate text-[12px] text-muted">
                      {formatDate(fromDbDate(t.departDate), { weekday: true })} · {t.destination}
                    </span>
                  </span>
                  <span className="text-[12px] text-ink-2 tabular">
                    {t.participants.length} students{pending > 0 && ` · ${pending} consent pending`}
                  </span>
                  {t.status === "DEPARTED" && <span className="text-[12px] font-medium text-accent-ink">On the trip</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}

async function ViolationsPanel() {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const settings = await getSettings();
  const today = localParts(new Date(), settings.timezone).date;
  const monthWhere = { incidentDate: { gte: toDbDate(monthStart(today)), lte: toDbDate(today) } };
  const [thisMonth, severeThisMonth, open, recent] = await Promise.all([
    prisma.violation.count({ where: monthWhere }),
    prisma.violation.count({ where: { ...monthWhere, severity: "SEVERE" } }),
    prisma.violation.count({ where: { status: "OPEN" } }),
    prisma.violation.findMany({
      orderBy: [{ incidentDate: "desc" }, { createdAt: "desc" }],
      take: 5,
      include: { student: { select: { fullName: true, program: true, section: true, photoUrl: true } }, type: { select: { name: true } } },
    }),
  ]);

  return (
    <Card className="mt-5">
      <CardHeader
        title="Discipline violations"
        description={`${thisMonth} this month · ${severeThisMonth} severe · ${open} open ${open === 1 ? "case" : "cases"}`}
        actions={
          <Link href="/violations?status=OPEN" className="inline-flex items-center gap-1 text-[13px] font-medium text-accent-ink hover:underline">
            Open cases <ArrowRight className="size-3.5" aria-hidden />
          </Link>
        }
      />
      {recent.length === 0 ? (
        <EmptyState icon={<ShieldAlert className="size-5" />} title="No violations recorded yet" />
      ) : (
        <ul className="divide-y divide-line">
          {recent.map((v) => (
            <li key={v.id}>
              <Link href={`/violations/${v.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/50">
                <Avatar name={v.student.fullName} photoUrl={v.student.photoUrl} size="sm" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">
                    {v.student.fullName} <span className="font-normal text-ink-2">· {v.type.name}</span>
                  </span>
                  <span className="block truncate text-[12px] text-muted">
                    {formatDate(fromDbDate(v.incidentDate))} · {v.student.program} {v.student.section}
                  </span>
                </span>
                {v.status === "OPEN" && (
                  <span className="hidden text-[12px] font-medium text-accent-ink sm:inline">Open</span>
                )}
                <StrikeBadge level={SEVERITY_LEVEL[v.severity]} label={SEVERITY_LABELS[v.severity]} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function Kpi({
  icon,
  label,
  value,
  footer,
  href,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  footer: React.ReactNode;
  href: string;
}) {
  return (
    <Link href={href} className="group">
      <Card className="h-full p-4 transition-colors group-hover:border-line-strong sm:p-5">
        <p className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-surface-2 text-muted">{icon}</span>
          {label}
        </p>
        <p className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">{value.toLocaleString()}</p>
        <div className="mt-1.5 text-[12px] text-muted">{footer}</div>
      </Card>
    </Link>
  );
}

/** Fewer late arrivals is good, so "up" reads as bad. */
function Delta({ today, yesterday }: { today: number; yesterday: number }) {
  const diff = today - yesterday;
  if (diff === 0) {
    return (
      <span className="inline-flex items-center gap-1">
        <Minus className="size-3.5" aria-hidden /> Same as yesterday
      </span>
    );
  }
  const up = diff > 0;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <span className={cx("inline-flex items-center gap-1 font-medium", up ? "text-danger-ink" : "text-success-ink")}>
      <Icon className="size-3.5" aria-hidden />
      {Math.abs(diff)} {up ? "more" : "fewer"} than yesterday ({yesterday})
    </span>
  );
}
