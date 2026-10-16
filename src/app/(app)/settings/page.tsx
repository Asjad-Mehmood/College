import type { Metadata } from "next";
import { Suspense } from "react";
import { Avatar, Card, CardHeader, PageHeader, Pill, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { defaultBatchId, getScope } from "@/lib/scope";
import { addDays, formatDate, localParts } from "@/lib/time";
import { YearsAndBatches } from "./years-batches";
import { ImportForm, NewUserForm, ScheduleToggle, SettingsForm, UserRowActions } from "./forms";
import { ViolationTypes } from "./violation-types";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <div>
      <PageHeader title="Settings" description="Timing rules, student import and staff accounts." />
      <Suspense
        fallback={
          <div className="flex flex-col gap-5">
            <Skeleton className="h-40 rounded-2xl" />
            <Skeleton className="h-96 rounded-2xl" />
          </div>
        }
      >
        <SettingsContent />
      </Suspense>
    </div>
  );
}

async function SettingsContent() {
  const me = await requireUser(["ADMIN"]);
  const scope = await getScope();
  const settings = await getSettings();
  const [users, studentCount, violationTypes] = await Promise.all([
    prisma.user.findMany({ orderBy: [{ active: "desc" }, { role: "asc" }, { fullName: "asc" }] }),
    prisma.student.count(),
    prisma.violationType.findMany({
      orderBy: [{ active: "desc" }, { severity: "asc" }, { name: "asc" }],
      include: { _count: { select: { violations: true } } },
    }),
  ]);

  return (
    <div className="grid items-start gap-5 xl:grid-cols-2">
      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader
            title="College timing"
            description="Switch between summer and winter timing in one click, for both shifts. Applies to new entries immediately."
          />
          <div className="p-5">
            <ScheduleToggle
              schedule={settings.schedule}
              summer={settings.summerStartTime}
              winter={settings.winterStartTime}
              eveningSummer={settings.eveningSummerStartTime}
              eveningWinter={settings.eveningWinterStartTime}
            />
          </div>
        </Card>

        <Card>
          <CardHeader title="Rules & college details" />
          <div className="p-5">
            <SettingsForm
              values={{
                collegeName: settings.collegeName,
                collegeAddress: settings.collegeAddress,
                timezone: settings.timezone,
                schedule: settings.schedule,
                summerStartTime: settings.summerStartTime,
                winterStartTime: settings.winterStartTime,
                eveningSummerStartTime: settings.eveningSummerStartTime,
                eveningWinterStartTime: settings.eveningWinterStartTime,
                gracePeriodMins: settings.gracePeriodMins,
                habitualThreshold: settings.habitualThreshold,
                criticalThreshold: settings.criticalThreshold,
                defaultFineAmount: settings.defaultFineAmount,
              }}
            />
          </div>
        </Card>

        <Card id="violation-types" className="scroll-mt-6">
          <CardHeader
            title="Violation types"
            description="The list offered when recording a violation. Deactivate types you no longer use; past cases keep their type."
          />
          <ViolationTypes
            types={violationTypes.map((t) => ({
              id: t.id,
              name: t.name,
              severity: t.severity,
              defaultFineAmount: Number(t.defaultFineAmount),
              active: t.active,
              uses: t._count.violations,
            }))}
          />
        </Card>
      </div>

      <div className="flex flex-col gap-5">
        <Card id="import" className="scroll-mt-6">
          <CardHeader
            title="Bulk import students"
            description={`Upload the class lists at the start of each session. Existing roll numbers are updated. ${studentCount.toLocaleString()} students on file.`}
          />
          <div className="p-5">
            <ImportForm batches={scope.batches} defaultBatchId={await defaultBatchId()} />
          </div>
        </Card>

        <Card id="years" className="scroll-mt-6">
          <CardHeader title="Academic years & batches" description="Choose which one to work in from the sidebar. Gate check-in always sees every active student." />
          <YearsCard />
        </Card>

        <Card>
          <CardHeader title="Staff accounts" description="Gate staff can only log arrivals. The Principal can view and export but not edit." />
          <ul className="divide-y divide-line">
            {users.map((u) => (
              <li key={u.id} className="flex flex-col gap-3 px-5 py-3 2xl:flex-row 2xl:items-center">
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <Avatar name={u.fullName} size="sm" />
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {u.fullName}
                      {u.id === me.id && <Pill tone="accent">You</Pill>}
                      {!u.active && <Pill tone="critical">Deactivated</Pill>}
                    </p>
                    <p className="text-[12px] text-muted">
                      {u.email.includes("@") ? (
                        <span>{u.email}</span>
                      ) : (
                        <span className="text-danger-ink">
                          No email yet — signs in with “<span className="font-mono">{u.email}</span>”
                        </span>
                      )}{" "}
                      · {ROLE_LABELS[u.role]}
                    </p>
                  </div>
                </div>
                <UserRowActions userId={u.id} active={u.active} isSelf={u.id === me.id} email={u.email} />
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-5">
            <p className="mb-3 text-sm font-semibold">Add an account</p>
            <NewUserForm />
          </div>
        </Card>
      </div>
    </div>
  );
}

async function YearsCard() {
  const scope = await getScope();
  const active = await prisma.student.groupBy({ by: ["batchId"], where: { status: "ACTIVE" }, _count: { _all: true } });
  const activeBy = new Map(active.map((a) => [a.batchId, a._count._all]));
  const today = localParts(new Date(), (await getSettings()).timezone).date;
  const latest = scope.years[0];
  const nextFrom = latest ? addDays(latest.to, 1) : `${today.slice(0, 4)}-08-01`;
  return (
    <YearsAndBatches
      nextYearFrom={nextFrom}
      years={scope.years.map((y) => ({ id: y.id, name: y.name, closed: y.closed, label: `${formatDate(y.from)} – ${formatDate(y.to)}`, current: y.from <= today && today <= y.to }))}
      batches={scope.batches.map((b) => ({ id: b.id, name: b.name, passedOut: b.passedOut, students: b.students, active: activeBy.get(b.id) ?? 0 }))}
    />
  );
}
