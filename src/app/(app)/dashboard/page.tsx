import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bus,
  Banknote,
  CheckCircle2,
  FilePlus2,
  MapPinPlus,
  ScanSearch,
  Trophy,
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
  Card,
  CardHeader,
  EmptyState,
  PageHeader,
  Skeleton,
  StrikeBadge,
  cx,
} from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { REASON_LABELS, SEVERITY_LABELS, SEVERITY_LEVEL } from "@/lib/labels";
import { batchSql, getScope, scoped } from "@/lib/scope";
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
      <Suspense fallback={<Skeleton className="mb-5 h-14 rounded-2xl" />}>
        <QuickActions />
      </Suspense>
      <Suspense fallback={<Skeleton className="mb-5 h-48 rounded-2xl" />}>
        <AttentionAndOverview />
      </Suspense>
      <Suspense fallback={<DashboardSkeleton />}>
        <Dashboard />
      </Suspense>
      <Suspense fallback={<Skeleton className="mt-5 h-64 rounded-2xl" />}>
        <Patterns />
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
  const hour = localParts(new Date(), settings.timezone).minutes / 60;
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  return (
    <PageHeader
      title={`${greeting}, ${user.fullName.split(" ").slice(0, 2).join(" ")}`}
      description={`${formatDate(today, { weekday: true })} · ${settings.collegeName}`}
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
  const prisma = await scoped();
  const settings = await getSettings();
  const today = (await getScope()).anchor;
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
    eveningToday,
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
      WHERE r.late_date >= ${mStart} AND r.late_date <= ${toDbDate(today)} ${await batchSql("s")}
      GROUP BY s.program
      ORDER BY lates DESC
    `,
    prisma.$queryRaw<{ n: bigint }[]>`
      SELECT COUNT(*) AS n FROM late_records r JOIN students s ON s.roll_no = r.roll_no
      WHERE r.late_date = ${toDbDate(today)} AND s.section IN (SELECT name FROM sections WHERE shift = 'EVENING') ${await batchSql("s")}
    `,
  ]);
  const evening = Number(eveningToday[0]?.n ?? 0);

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
          footer={
            <span className="flex flex-col gap-0.5">
              <Delta today={todayCount} yesterday={yesterdayCount} />
              <span>
                Morning {todayCount - evening} · Evening {evening}
              </span>
            </span>
          }
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
  const prisma = await scoped();
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
  const prisma = await scoped();
  const today = (await getScope()).anchor;
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

async function QuickActions() {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const admin = can.administer(user.role);
  const actions = [
    ...(can.logLate(user.role) ? [{ href: "/gate", label: "Gate check-in", Icon: DoorOpen }] : []),
    ...(admin ? [{ href: "/violations/new", label: "Record violation", Icon: FilePlus2 }] : []),
    { href: "/audit", label: "Find a student", Icon: ScanSearch },
    { href: "/records", label: "Late records", Icon: CalendarDays },
    ...(admin ? [{ href: "/trips/new", label: "Plan a trip", Icon: MapPinPlus }] : [{ href: "/trips", label: "Trips", Icon: Bus }]),
    { href: "/sports", label: "Sports", Icon: Trophy },
  ];
  return (
    <nav className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="Quick actions">
      {actions.map(({ href, label, Icon }) => (
        <Link
          key={href}
          href={href}
          className="flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3.5 py-3 text-sm font-medium shadow-card transition-colors hover:border-accent/50 hover:bg-accent-soft/40"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-accent-soft text-accent-ink">
            <Icon className="size-4" aria-hidden />
          </span>
          <span className="truncate">{label}</span>
        </Link>
      ))}
    </nav>
  );
}

async function AttentionAndOverview() {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const prisma = await scoped();
  const settings = await getSettings();
  const today = (await getScope()).anchor;
  const mStart = toDbDate(monthStart(today));
  const weekAhead = toDbDate(addDays(today, 7));
  const [
    staleCases,
    severeOpen,
    lateFines,
    violationFines,
    habitual,
    soonTrips,
    activeStudents,
    eveningStudents,
    violationsMonth,
    upcomingTrips,
    events,
  ] = await Promise.all([
    prisma.violation.count({ where: { status: "OPEN", incidentDate: { lt: toDbDate(addDays(today, -7)) } } }),
    prisma.violation.count({ where: { status: "OPEN", severity: { in: ["MAJOR", "SEVERE"] } } }),
    prisma.lateRecord.aggregate({ where: { fineAmount: { gt: 0 }, finePaid: false }, _sum: { fineAmount: true } }),
    prisma.violation.aggregate({ where: { fineAmount: { gt: 0 }, finePaid: false }, _sum: { fineAmount: true } }),
    prisma.lateRecord.groupBy({ by: ["rollNo"], where: { lateDate: { gte: mStart } }, _count: { _all: true }, having: { rollNo: { _count: { gte: settings.habitualThreshold } } } }),
    prisma.trip.findMany({
      where: { status: { in: ["OPEN", "CLOSED"] }, departDate: { gte: toDbDate(today), lte: weekAhead } },
      include: { participants: { where: { status: "REGISTERED" }, select: { consent: true, feePaid: true } } },
      orderBy: { departDate: "asc" },
    }),
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.$queryRaw<{ n: bigint }[]>`SELECT COUNT(*) AS n FROM students s WHERE status = 'ACTIVE' AND section IN (SELECT name FROM sections WHERE shift = 'EVENING') ${await batchSql("s")}`,
    prisma.violation.count({ where: { incidentDate: { gte: mStart } } }),
    prisma.trip.count({ where: { status: { in: ["OPEN", "CLOSED", "DEPARTED"] } } }),
    prisma.sportsEvent.findMany({ where: { endDate: { gte: toDbDate(today) } }, orderBy: { startDate: "asc" }, take: 3 }),
  ]);
  const unpaid = Number(lateFines._sum.fineAmount ?? 0) + Number(violationFines._sum.fineAmount ?? 0);
  const evening = Number(eveningStudents[0]?.n ?? 0);

  const items: { text: string; sub: string; href: string; tone: "critical" | "warning" }[] = [];
  if (severeOpen) items.push({ text: `${severeOpen} open major/severe ${severeOpen === 1 ? "case" : "cases"}`, sub: "Review and take action", href: "/violations?view=search&range=all&status=OPEN", tone: "critical" });
  if (staleCases) items.push({ text: `${staleCases} ${staleCases === 1 ? "case has" : "cases have"} been open more than a week`, sub: "Close them once action is complete", href: "/violations?view=search&range=all&status=OPEN", tone: "warning" });
  if (habitual.length) items.push({ text: `${habitual.length} habitual late-comer${habitual.length === 1 ? "" : "s"} this month`, sub: `${settings.habitualThreshold}+ late arrivals — consider warning letters`, href: "/records?view=search&range=month&habitual=1", tone: "warning" });
  for (const t of soonTrips) {
    const pending = t.participants.filter((p) => p.consent === "PENDING").length;
    const fee = Number(t.feeAmount);
    const unpaidFees = fee > 0 ? t.participants.filter((p) => Number(p.feePaid) < fee).length : 0;
    if (pending || unpaidFees) {
      items.push({
        text: `${t.title} leaves ${formatDate(fromDbDate(t.departDate))}`,
        sub: [pending && `${pending} consent pending`, unpaidFees && `${unpaidFees} fees unpaid`].filter(Boolean).join(" · "),
        href: `/trips/${t.id}?tab=students`,
        tone: "warning",
      });
    }
  }
  if (unpaid > 0) items.push({ text: `Rs. ${unpaid.toLocaleString()} in unpaid fines`, sub: "Late arrivals and violations together", href: "/records?view=search&range=all&fines=unpaid", tone: "warning" });

  const overview = [
    { label: "Active students", value: activeStudents.toLocaleString(), sub: evening ? `Morning ${activeStudents - evening} · Evening ${evening}` : "All in the morning shift", href: "/students", Icon: Users },
    { label: "Violations this month", value: violationsMonth.toLocaleString(), sub: `${severeOpen} serious still open`, href: "/violations", Icon: ShieldAlert },
    { label: "Trips ahead", value: upcomingTrips.toLocaleString(), sub: soonTrips.length ? `${soonTrips.length} within 7 days` : "none this week", href: "/trips", Icon: Bus },
    {
      label: "Sports events",
      value: events.length.toLocaleString(),
      sub: events[0] ? `${events[0].name} · ${formatDate(fromDbDate(events[0].startDate))}` : "none scheduled",
      href: events[0] ? `/sports/events/${events[0].id}` : "/sports",
      Icon: Trophy,
    },
  ];

  return (
    <div className="mb-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card className="overflow-hidden">
        <CardHeader title="Needs attention" description={items.length ? `${items.length} ${items.length === 1 ? "item" : "items"} to follow up` : "All clear"} />
        {items.length === 0 ? (
          <p className="flex items-center gap-2 px-5 py-6 text-sm text-ink-2">
            <CheckCircle2 className="size-5 text-good" aria-hidden /> Nothing urgent — no open serious cases, unpaid fines or trip deadlines.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {items.slice(0, 6).map((x) => (
              <li key={x.text}>
                <Link href={x.href} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/60">
                  <span className={cx("size-2.5 shrink-0 rounded-full", x.tone === "critical" ? "bg-critical" : "bg-warning")} aria-hidden />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{x.text}</span>
                    <span className="block truncate text-[12px] text-muted">{x.sub}</span>
                  </span>
                  <ArrowRight className="size-4 shrink-0 text-muted" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <div className="grid grid-cols-2 gap-3">
        {overview.map(({ label, value, sub, href, Icon }) => (
          <Link key={label} href={href} className="group">
            <Card className="h-full p-4 transition-colors group-hover:border-line-strong">
              <p className="flex items-center gap-2 text-[13px] font-medium text-ink-2">
                <Icon className="size-4 text-muted" aria-hidden /> {label}
              </p>
              <p className="mt-2 text-2xl font-semibold tabular">{value}</p>
              <p className="mt-0.5 truncate text-[12px] text-muted" title={sub}>
                {sub}
              </p>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

const WEEKDAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

async function Patterns() {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const prisma = await scoped();
  const today = (await getScope()).anchor;
  const from = toDbDate(addDays(today, -89));
  const mStart = toDbDate(monthStart(today));
  const [byDow, bySection, byReason] = await Promise.all([
    prisma.$queryRaw<{ dow: number; n: bigint }[]>`
      SELECT EXTRACT(DOW FROM r.late_date)::int AS dow, COUNT(*) AS n
      FROM late_records r JOIN students s ON s.roll_no = r.roll_no
      WHERE r.late_date >= ${from} AND r.late_date <= ${toDbDate(today)} ${await batchSql("s")} GROUP BY 1`,
    prisma.$queryRaw<{ section: string; n: bigint; students: bigint }[]>`
      SELECT s.section, COUNT(*) AS n, COUNT(DISTINCT r.roll_no) AS students
      FROM late_records r JOIN students s ON s.roll_no = r.roll_no
      WHERE r.late_date >= ${mStart} AND r.late_date <= ${toDbDate(today)} ${await batchSql("s")} GROUP BY s.section ORDER BY n DESC LIMIT 6`,
    prisma.lateRecord.groupBy({ by: ["reason"], where: { lateDate: { gte: mStart } }, _count: { _all: true } }),
  ]);
  if (byDow.length === 0 && bySection.length === 0) return null;
  const dow = new Map(byDow.map((d) => [d.dow, Number(d.n)]));
  // College week: Monday to Saturday (Sunday only if anything was logged).
  const days = [1, 2, 3, 4, 5, 6, ...(dow.get(0) ? [0] : [])].map((d) => ({ label: WEEKDAY_NAMES[d], value: dow.get(d) ?? 0 }));
  const worst = days.reduce((a, b) => (b.value > a.value ? b : a), days[0]);
  const reasons = [...byReason].sort((a, b) => b._count._all - a._count._all);
  const reasonTotal = reasons.reduce((a, r) => a + r._count._all, 0);

  return (
    <div className="mt-5 grid items-start gap-5 lg:grid-cols-3">
      <Card>
        <CardHeader title="Late arrivals by weekday" description={worst?.value ? `Last 90 days · most on ${worst.label}s` : "Last 90 days"} />
        <div className="px-5 py-5">
          <BarList data={days} />
        </div>
      </Card>
      <Card>
        <CardHeader title="Sections with most lates" description={formatMonth(today)} />
        <div className="px-5 py-5">
          {bySection.length === 0 ? (
            <EmptyState title="No late arrivals this month" />
          ) : (
            <BarList data={bySection.map((x) => ({ label: x.section, value: Number(x.n), sub: `${Number(x.students)} students` }))} />
          )}
        </div>
      </Card>
      <Card>
        <CardHeader title="Reasons given" description={formatMonth(today)} />
        <div className="px-5 py-5">
          {reasons.length === 0 ? (
            <EmptyState title="No late arrivals this month" />
          ) : (
            <BarList
              data={reasons.map((r) => ({
                label: REASON_LABELS[r.reason],
                value: r._count._all,
                sub: `${Math.round((r._count._all / reasonTotal) * 100)}%`,
              }))}
            />
          )}
        </div>
      </Card>
    </div>
  );
}
