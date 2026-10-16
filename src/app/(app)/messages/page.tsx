import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { PageHeader, Select, Skeleton, cx } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { requireUser } from "@/lib/auth";
import { REASON_LABELS } from "@/lib/labels";
import { parentLateMessage } from "@/lib/messages";
import { getScope, scoped } from "@/lib/scope";
import { getSectionOptions } from "@/lib/section-options";
import { getSettings } from "@/lib/settings";
import { formatDate, formatTime, fromDbDate, monthStart, toDbDate } from "@/lib/time";
import { tripParentMessage, tripWhen } from "@/lib/trips";
import { MessageQueue, type QueueItem } from "./queue";

export const metadata: Metadata = { title: "Parent messages" };

const LISTS = [
  { key: "today", label: "Late today" },
  { key: "habitual", label: "Habitual late-comers" },
  { key: "cases", label: "Open violation cases" },
  { key: "fines", label: "Unpaid fines" },
  { key: "trip", label: "Trip consent & fees" },
  { key: "section", label: "Whole section (custom)" },
] as const;
type ListKey = (typeof LISTS)[number]["key"];

export default function MessagesPage(props: PageProps<"/messages">) {
  return (
    <div>
      <PageHeader
        title="Parent messages"
        description="Pick a list, then send each parent their WhatsApp message one after another with one button."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/messages">["searchParams"] }) {
  await requireUser(["ADMIN"]);
  const prisma = await scoped();
  const sp = await searchParams;
  const list: ListKey = LISTS.some((l) => l.key === sp.list) ? (sp.list as ListKey) : "today";
  const settings = await getSettings();
  const today = (await getScope()).anchor;
  const sign = `– Discipline In-Charge, ${settings.collegeName}`;
  const mStart = toDbDate(monthStart(today));
  let items: QueueItem[] = [];
  let extra: React.ReactNode = null;
  let custom = false;

  if (list === "today") {
    const rows = await prisma.lateRecord.findMany({
      where: { lateDate: toDbDate(today) },
      orderBy: { arrivedAt: "asc" },
      include: { student: true },
    });
    const counts = new Map(
      (
        await prisma.lateRecord.groupBy({
          by: ["rollNo"],
          where: { rollNo: { in: rows.map((r) => r.rollNo) }, lateDate: { gte: mStart } },
          _count: { _all: true },
        })
      ).map((c) => [c.rollNo, c._count._all]),
    );
    items = rows.map((r) => ({
      rollNo: r.rollNo,
      name: r.student.fullName,
      section: r.student.section,
      phone: r.student.parentPhone,
      note: `${formatTime(r.arrivedAt, settings.timezone)} · ${REASON_LABELS[r.reason]}`,
      message: parentLateMessage({
        studentName: r.student.fullName,
        rollNo: r.rollNo,
        className: `${r.student.program} ${r.student.section}`,
        time: formatTime(r.arrivedAt, settings.timezone),
        monthCount: counts.get(r.rollNo) ?? 1,
        collegeName: settings.collegeName,
      }),
    }));
  }

  if (list === "habitual") {
    const groups = await prisma.lateRecord.groupBy({
      by: ["rollNo"],
      where: { lateDate: { gte: mStart } },
      _count: { _all: true },
      having: { rollNo: { _count: { gte: settings.habitualThreshold } } },
      orderBy: { _count: { rollNo: "desc" } },
    });
    const students = new Map((await prisma.student.findMany({ where: { rollNo: { in: groups.map((g) => g.rollNo) } } })).map((s) => [s.rollNo, s]));
    items = groups.flatMap((g) => {
      const s = students.get(g.rollNo);
      if (!s) return [];
      return [
        {
          rollNo: s.rollNo,
          name: s.fullName,
          section: s.section,
          phone: s.parentPhone,
          note: `${g._count._all} late this month`,
          message: `Respected Parent, your son/daughter ${s.fullName} (Roll No: ${s.rollNo}, ${s.program} ${s.section}) has come late to college ${g._count._all} times this month. Please make sure he/she comes on time; otherwise there will be a fine and you will be called to the college. ${sign}`,
        },
      ];
    });
  }

  if (list === "cases") {
    const cases = await prisma.violation.findMany({
      where: { status: "OPEN" },
      orderBy: { incidentDate: "asc" },
      include: { student: true, type: { select: { name: true } } },
    });
    items = cases.map((v) => ({
      rollNo: v.rollNo,
      name: v.student.fullName,
      section: v.student.section,
      phone: v.student.parentPhone,
      note: `Case #${v.id} · ${v.type.name} · ${formatDate(fromDbDate(v.incidentDate))}`,
      key: `case-${v.id}`,
      message: `Respected Parent, a discipline case (${v.type.name}, ${formatDate(fromDbDate(v.incidentDate))}) about your son/daughter ${v.student.fullName} (Roll No: ${v.rollNo}) is still open. Please come to the Discipline Office as soon as possible. ${sign}`,
    }));
  }

  if (list === "fines") {
    const [lates, cases] = await Promise.all([
      prisma.lateRecord.groupBy({ by: ["rollNo"], where: { fineAmount: { gt: 0 }, finePaid: false }, _sum: { fineAmount: true } }),
      prisma.violation.groupBy({ by: ["rollNo"], where: { fineAmount: { gt: 0 }, finePaid: false }, _sum: { fineAmount: true } }),
    ]);
    const owed = new Map<string, number>();
    for (const r of [...lates, ...cases]) owed.set(r.rollNo, (owed.get(r.rollNo) ?? 0) + Number(r._sum.fineAmount ?? 0));
    const students = await prisma.student.findMany({ where: { rollNo: { in: [...owed.keys()] } }, orderBy: [{ section: "asc" }, { rollNo: "asc" }] });
    items = students.map((s) => ({
      rollNo: s.rollNo,
      name: s.fullName,
      section: s.section,
      phone: s.parentPhone,
      note: `Rs. ${(owed.get(s.rollNo) ?? 0).toLocaleString()} unpaid`,
      message: `Respected Parent, a fine of Rs. ${(owed.get(s.rollNo) ?? 0).toLocaleString()} for your son/daughter ${s.fullName} (Roll No: ${s.rollNo}) has not been paid. Please pay it at the Discipline Office. ${sign}`,
    }));
  }

  if (list === "trip") {
    const trips = await prisma.trip.findMany({
      where: { status: { in: ["OPEN", "CLOSED"] } },
      orderBy: { departDate: "asc" },
      include: { participants: { where: { status: "REGISTERED" }, include: { student: true } } },
    });
    const tripId = Number(sp.trip) || trips[0]?.id;
    const trip = trips.find((t) => t.id === tripId);
    extra = (
      <FilterForm action="/messages">
        <input type="hidden" name="list" value="trip" />
        <Select name="trip" defaultValue={trip?.id ?? ""} aria-label="Trip" className="w-auto">
          {trips.length === 0 && <option value="">No upcoming trips</option>}
          {trips.map((t) => (
            <option key={t.id} value={t.id}>
              {t.title} · {formatDate(fromDbDate(t.departDate))}
            </option>
          ))}
        </Select>
      </FilterForm>
    );
    if (trip) {
      const fee = Number(trip.feeAmount);
      const when = tripWhen(trip);
      items = trip.participants.flatMap((p) => {
        const balance = Math.max(0, fee - Number(p.feePaid));
        const needConsent = p.consent === "PENDING";
        if (!needConsent && balance === 0) return [];
        const base = {
          studentName: p.student.fullName,
          tripTitle: trip.title,
          destination: trip.destination,
          when,
          meetingPoint: trip.meetingPoint,
          fee,
          balance,
          collegeName: settings.collegeName,
        };
        return [
          {
            rollNo: p.rollNo,
            name: p.student.fullName,
            section: p.student.section,
            phone: p.emergencyPhone ?? p.student.parentPhone,
            note: [needConsent && "consent pending", balance > 0 && `Rs. ${balance} fee due`].filter(Boolean).join(" · "),
            message: needConsent
              ? tripParentMessage("consent", { ...base, deadline: trip.consentDeadline ? formatDate(fromDbDate(trip.consentDeadline)) : null }) +
                (balance > 0 ? ` The trip fee of Rs. ${balance} is also due.` : "")
              : tripParentMessage("fee", { ...base, deadline: trip.feeDeadline ? formatDate(fromDbDate(trip.feeDeadline)) : null }),
          },
        ];
      });
    }
  }

  if (list === "section") {
    custom = true;
    const sections = await getSectionOptions();
    const section = typeof sp.section === "string" && sections.some((s) => s.name === sp.section) ? sp.section : sections[0]?.name;
    extra = (
      <FilterForm action="/messages">
        <input type="hidden" name="list" value="section" />
        <Select name="section" defaultValue={section ?? ""} aria-label="Section" className="w-auto">
          {sections.map((s) => (
            <option key={s.name} value={s.name}>
              Section {s.name}
            </option>
          ))}
        </Select>
      </FilterForm>
    );
    if (section) {
      const students = await prisma.student.findMany({ where: { section, status: "ACTIVE" }, orderBy: { rollNo: "asc" } });
      items = students.map((s) => ({
        rollNo: s.rollNo,
        name: s.fullName,
        section: s.section,
        phone: s.parentPhone,
        note: s.program,
        message: "",
      }));
    }
  }

  const queueKey = `${list}-${today}-${typeof sp.trip === "string" ? sp.trip : ""}${typeof sp.section === "string" ? sp.section : ""}`;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <nav className="inline-flex max-w-full flex-wrap gap-1 rounded-xl border border-line bg-surface p-1 shadow-card" aria-label="Who to message">
          {LISTS.map((l) => (
            <Link
              key={l.key}
              href={`/messages?list=${l.key}`}
              aria-current={list === l.key ? "page" : undefined}
              className={cx(
                "rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap",
                list === l.key ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>
        {extra}
      </div>
      <MessageQueue key={queueKey} queueKey={queueKey} items={items} custom={custom} sign={sign} />
    </div>
  );
}
