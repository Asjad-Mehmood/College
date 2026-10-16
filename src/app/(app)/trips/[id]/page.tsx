import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import {
  ArrowLeft,
  BedDouble,
  Bus,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Clock,
  FileSpreadsheet,
  LayoutDashboard,
  MapPin,
  Printer,
  UserRound,
  Users,
} from "lucide-react";
import { Card, CardHeader, Pill, Skeleton, buttonClass, cx } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { TRIP_STATUS_LABELS, TRIP_TYPE_LABELS } from "@/lib/labels";
import { whatsAppLink } from "@/lib/messages";
import { getClassOptions } from "@/lib/records";
import { getSettings } from "@/lib/settings";
import { formatDate, formatMinutes, formatTime, fromDbDate, localParts, parseHHMM } from "@/lib/time";
import { getTrip, tripParentMessage, tripSummary, tripWhen } from "@/lib/trips";
import { RollCall, type RollCallRow } from "./roll-call";
import { AddStudents, MessagePanel, ParticipantTable, type ParticipantView } from "./students";
import { StaffPanel, TripControls } from "./trip-controls";
import { RoomsPanel } from "./rooms";
import { TransportPanel } from "./transport";

export const metadata: Metadata = { title: "Trip" };

const TAB_ICONS = { overview: LayoutDashboard, students: Users, transport: Bus, rooms: BedDouble, rollcall: ClipboardCheck } as const;

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "students", label: "Students" },
  { key: "transport", label: "Transport" },
  { key: "rooms", label: "Rooms" },
  { key: "rollcall", label: "Roll call" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export default function TripPage(props: PageProps<"/trips/[id]">) {
  return (
    <div>
      <Link href="/trips" className="no-print mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Trips
      </Link>
      <Suspense fallback={<Skeleton className="h-[600px] rounded-2xl" />}>
        <Trip params={props.params} searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Trip({
  params,
  searchParams,
}: {
  params: PageProps<"/trips/[id]">["params"];
  searchParams: PageProps<"/trips/[id]">["searchParams"];
}) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;
  const [trip, settings] = await Promise.all([getTrip(id), getSettings()]);
  if (!trip) notFound();
  // The Rooms tab only exists for night-stay trips.
  const tabs = TABS.filter((t) => t.key !== "rooms" || trip.overnight);
  const tab: Tab = tabs.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "overview";

  const admin = can.administer(user.role);
  const fee = Number(trip.feeAmount);
  const summary = tripSummary(trip, trip.participants);
  const when = tripWhen(trip);
  const before = trip.status === "OPEN" || trip.status === "CLOSED";
  const canDelete = admin && (trip.status === "CANCELLED" || (before && trip.participants.every((p) => Number(p.feePaid) === 0)));
  const tone = trip.status === "DEPARTED" ? "warning" : trip.status === "OPEN" ? "accent" : trip.status === "CANCELLED" ? "critical" : "neutral";

  const today = localParts(new Date(), settings.timezone).date;
  const depart = fromDbDate(trip.departDate);
  const daysTo = Math.round((Date.parse(depart) - Date.parse(today)) / 86_400_000);
  const countdown =
    trip.status === "DEPARTED"
      ? "On the trip now"
      : trip.status === "RETURNED"
        ? "Trip completed"
        : trip.status === "CANCELLED"
          ? "Cancelled"
          : daysTo < 0
            ? `Departure was ${-daysTo} day${daysTo === -1 ? "" : "s"} ago`
            : daysTo === 0
              ? "Leaves today"
              : daysTo === 1
                ? "Leaves tomorrow"
                : `Leaves in ${daysTo} days`;
  const registered = trip.participants.filter((p) => p.status === "REGISTERED");
  const busSeats = trip.vehicles.reduce((a, v) => a + (v.seats ?? 0), 0);
  const onBus = registered.filter((p) => p.vehicleId != null).length;
  const beds = trip.rooms.reduce((a, r) => a + r.beds, 0);
  const inRoom = registered.filter((p) => p.roomId != null).length;
  const tabHref = (t: Tab) => (t === "overview" ? `/trips/${trip.id}` : `/trips/${trip.id}?tab=${t}`);
  const kpis: { label: string; value: string; sub?: string; tab: Tab; warn?: boolean }[] = [
    {
      label: "Students",
      value: trip.seats != null ? `${summary.registered}/${trip.seats}` : String(summary.registered),
      sub: trip.seats != null ? `${summary.seatsLeft} seats left` : "no seat limit",
      tab: "students",
    },
    {
      label: "Consent",
      value: `${summary.consentReceived}/${summary.registered}`,
      sub: summary.consentPending ? `${summary.consentPending} pending` : summary.registered ? "all received" : "—",
      tab: "students",
      warn: summary.consentPending > 0 && before,
    },
    ...(fee > 0
      ? [
          {
            label: "Fee collected",
            value: `Rs. ${summary.collected.toLocaleString()}`,
            sub: `of Rs. ${(fee * summary.registered).toLocaleString()} · ${summary.feePending} unpaid`,
            tab: "students" as Tab,
            warn: summary.feePending > 0 && before,
          },
        ]
      : []),
    {
      label: "Transport",
      value: `${onBus}/${summary.registered}`,
      sub: trip.vehicles.length ? `on ${trip.vehicles.length} vehicle${trip.vehicles.length === 1 ? "" : "s"} · ${busSeats} seats` : "no vehicles yet",
      tab: "transport",
      warn: before && summary.registered > 0 && onBus < summary.registered,
    },
    ...(trip.overnight
      ? [
          {
            label: "Rooms",
            value: `${inRoom}/${summary.registered}`,
            sub: `${trip.rooms.length} rooms · ${beds} beds`,
            tab: "rooms" as Tab,
            warn: before && summary.registered > 0 && inRoom < summary.registered,
          },
        ]
      : []),
  ];

  // Next steps, in the order they're usually done.
  const steps = [
    { label: "Add students", done: summary.registered > 0, tab: "students" as Tab, detail: `${summary.registered} registered` },
    { label: "Collect parent consent", done: summary.registered > 0 && summary.consentPending === 0, tab: "students" as Tab, detail: `${summary.consentReceived} received · ${summary.consentPending} pending` },
    ...(fee > 0
      ? [{ label: "Collect fees", done: summary.registered > 0 && summary.feePending === 0, tab: "students" as Tab, detail: `${summary.feePaid} paid · ${summary.feePending} unpaid` }]
      : []),
    { label: "Add staff", done: trip.staff.length > 0, tab: "overview" as Tab, detail: `${trip.staff.length} accompanying` },
    { label: "Add vehicles and assign seats", done: trip.vehicles.length > 0 && onBus === summary.registered && summary.registered > 0, tab: "transport" as Tab, detail: `${onBus} of ${summary.registered} seated` },
    ...(trip.overnight
      ? [{ label: "Allocate rooms", done: summary.registered > 0 && inRoom === summary.registered, tab: "rooms" as Tab, detail: `${inRoom} of ${summary.registered} in rooms` }]
      : []),
    { label: "Roll call at departure", done: trip.status === "DEPARTED" || trip.status === "RETURNED", tab: "rollcall" as Tab, detail: trip.departedAt ? `Left ${formatTime(trip.departedAt, settings.timezone)}` : "On the day" },
    { label: "Roll call on return", done: trip.status === "RETURNED", tab: "rollcall" as Tab, detail: trip.returnedAt ? `Back ${formatTime(trip.returnedAt, settings.timezone)}` : "When back" },
  ];
  const doneCount = steps.filter((x) => x.done).length;
  const itinerary = (trip.itinerary ?? "")
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const m = l.match(/^(\d{1,2}[:.]\d{2}\s*(?:[ap]m)?)\s*[-–:]?\s*(.*)$/i);
      return m ? { time: m[1], text: m[2] } : { time: "", text: l };
    });

  return (
    <div className="flex flex-col gap-5">
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-4 p-5 sm:p-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <Pill tone={tone}>{TRIP_STATUS_LABELS[trip.status]}</Pill>
              <span className="text-[13px] text-muted">{TRIP_TYPE_LABELS[trip.type]}</span>
              {trip.overnight && (
                <span className="inline-flex items-center gap-1 text-[13px] text-muted">
                  <BedDouble className="size-3.5" aria-hidden /> Night stay
                </span>
              )}
            </div>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-[28px]">{trip.title}</h1>
            <p className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-ink-2">
              <span className="inline-flex items-center gap-1.5">
                <MapPin className="size-4 text-muted" aria-hidden /> {trip.destination}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <CalendarDays className="size-4 text-muted" aria-hidden /> {when}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <UserRound className="size-4 text-muted" aria-hidden /> {trip.inChargeName}
              </span>
            </p>
          </div>
          <div className="no-print flex shrink-0 flex-col items-start gap-3 lg:items-end">
            <span
              className={cx(
                "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-medium",
                before && daysTo <= 3 ? "bg-warning/20 text-ink" : trip.status === "DEPARTED" ? "bg-warning/20 text-ink" : "bg-surface-2 text-ink-2",
              )}
            >
              <Clock className="size-3.5" aria-hidden /> {countdown}
            </span>
            {admin && (
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <TripControls id={trip.id} status={trip.status} canDelete={canDelete} />
              </div>
            )}
          </div>
        </div>
        <div className={cx("no-print grid grid-cols-2 border-t border-line", kpis.length >= 5 ? "lg:grid-cols-5" : kpis.length === 4 ? "lg:grid-cols-4" : "lg:grid-cols-3")}>
          {kpis.map((k, i) => (
            <Link
              key={k.label}
              href={tabHref(k.tab)}
              className={cx(
                "border-line px-5 py-3.5 hover:bg-surface-2/60",
                i > 0 && "lg:border-l",
                i % 2 === 1 && "border-l",
                i >= 2 && "border-t lg:border-t-0",
                k.warn && "bg-warning/8",
              )}
            >
              <p className="text-[12px] text-muted">{k.label}</p>
              <p className="mt-0.5 text-lg font-semibold tabular">{k.value}</p>
              {k.sub && <p className="truncate text-[12px] text-muted">{k.sub}</p>}
            </Link>
          ))}
        </div>
      </Card>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex max-w-full overflow-x-auto rounded-xl border border-line bg-surface p-1 shadow-card" aria-label="Trip sections">
          {tabs.map((t) => {
            const Icon = TAB_ICONS[t.key];
            const count = t.key === "students" ? summary.registered : t.key === "transport" ? trip.vehicles.length : t.key === "rooms" ? trip.rooms.length : null;
            return (
              <Link
                key={t.key}
                href={tabHref(t.key)}
                aria-current={tab === t.key ? "page" : undefined}
                className={cx(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors sm:px-3.5",
                  tab === t.key ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon className="size-4" aria-hidden />
                {t.label}
                {count != null && <span className="text-[12px] tabular opacity-70">{count}</span>}
              </Link>
            );
          })}
        </nav>
        <div className="flex flex-wrap gap-2">
          <details className="group relative">
            <summary className={buttonClass("secondary", "sm", "cursor-pointer list-none [&::-webkit-details-marker]:hidden")}>
              <Printer className="size-3.5" aria-hidden /> Print
              <ChevronDown className="size-3.5 transition-transform group-open:rotate-180" aria-hidden />
            </summary>
            <div className="absolute right-0 z-20 mt-1 flex w-56 flex-col rounded-xl border border-line bg-surface p-1 shadow-pop">
              {[
                ["slips", "Parent permission slips"],
                ["list", "Student list"],
                ["bus", "Bus lists"],
                ...(trip.overnight ? [["rooms", "Room list"]] : []),
              ].map(([doc, label]) => (
                <a key={doc} href={`/trip-docs/${trip.id}?doc=${doc}`} target="_blank" rel="noreferrer" className="rounded-lg px-3 py-2 text-sm hover:bg-surface-2">
                  {label}
                </a>
              ))}
            </div>
          </details>
          <a href={`/api/export/trips/${trip.id}`} className={buttonClass("secondary", "sm")}>
            <FileSpreadsheet className="size-3.5" aria-hidden /> Excel
          </a>
        </div>
      </div>

      {tab === "overview" && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-5">
            {trip.status !== "CANCELLED" && (
              <Card>
                <CardHeader
                  title="Next steps"
                  description={`${doneCount} of ${steps.length} done`}
                  actions={
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-accent/15" aria-hidden>
                      <div className="h-full rounded-full bg-accent" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
                    </div>
                  }
                />
                <ol className="divide-y divide-line">
                  {steps.map((x, i) => (
                    <li key={x.label}>
                      <Link href={tabHref(x.tab)} className="flex items-center gap-3 px-5 py-3 hover:bg-surface-2/60">
                        {x.done ? (
                          <CheckCircle2 className="size-5 shrink-0 text-good" aria-hidden />
                        ) : (
                          <span className="flex size-5 shrink-0 items-center justify-center rounded-full border border-line-strong text-[11px] font-semibold text-muted">
                            {i + 1}
                          </span>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className={cx("block text-sm font-medium", x.done && "text-ink-2")}>{x.label}</span>
                          <span className="block text-[12px] text-muted">{x.detail}</span>
                        </span>
                        <ChevronRight className="size-4 text-muted" aria-hidden />
                      </Link>
                    </li>
                  ))}
                </ol>
              </Card>
            )}

            <Card>
              <CardHeader title="Details" />
              <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-2">
                <Info label="Departure">{`${formatDate(fromDbDate(trip.departDate), { weekday: true })}, ${fmt(trip.departTime)}`}</Info>
                <Info label="Return">{`${formatDate(fromDbDate(trip.returnDate), { weekday: true })}, ${fmt(trip.returnTime)}`}</Info>
                <Info label="Meeting point">{trip.meetingPoint ?? "—"}</Info>
                <Info label="Teacher in charge">{`${trip.inChargeName}${trip.inChargePhone ? ` · ${trip.inChargePhone}` : ""}`}</Info>
                <Info label="Open to">{trip.programs.length ? trip.programs.join(", ") : "All programs"}</Info>
                <Info label="Seats">{trip.seats ?? "No limit"}</Info>
                <Info label="Night stay">{trip.overnight ? `Yes · ${trip.rooms.length} rooms, ${beds} beds` : "No"}</Info>
                <Info label="Fee">{fee > 0 ? `Rs. ${fee.toLocaleString()}${trip.feeDeadline ? ` · pay by ${formatDate(fromDbDate(trip.feeDeadline))}` : ""}` : "Free"}</Info>
                <Info label="Consent deadline">{trip.consentDeadline ? formatDate(fromDbDate(trip.consentDeadline)) : "—"}</Info>
              </dl>
              {trip.purpose && (
                <div className="border-t border-line p-5">
                  <p className="text-[12px] font-medium tracking-wide text-muted uppercase">Purpose</p>
                  <p className="mt-1 text-sm whitespace-pre-line">{trip.purpose}</p>
                </div>
              )}
              {(trip.cancelReason || trip.departureNote || trip.returnNote || trip.departedAt) && (
                <div className="flex flex-col gap-1 border-t border-line p-5 text-[13px] text-ink-2">
                  {trip.cancelReason && <p>Cancelled: {trip.cancelReason}</p>}
                  {trip.departedAt && (
                    <p>
                      Left at {formatTime(trip.departedAt, settings.timezone)}
                      {trip.departureNote && ` — ${trip.departureNote}`}
                    </p>
                  )}
                  {trip.returnedAt && (
                    <p>
                      Back at {formatTime(trip.returnedAt, settings.timezone)}
                      {trip.returnNote && ` — ${trip.returnNote}`}
                    </p>
                  )}
                </div>
              )}
            </Card>
          </div>
          <div className="flex flex-col gap-5">
            {itinerary.length > 0 && (
              <Card>
                <CardHeader title="Itinerary" />
                <ol className="relative mx-5 my-4 border-l border-line">
                  {itinerary.map((x, i) => (
                    <li key={i} className="relative pb-3 pl-5 last:pb-0">
                      <span className="absolute top-1.5 -left-[5px] size-2.5 rounded-full bg-accent ring-4 ring-surface" aria-hidden />
                      {x.time && <p className="text-[12px] font-semibold text-accent-ink tabular">{x.time}</p>}
                      <p className="text-sm">{x.text}</p>
                    </li>
                  ))}
                </ol>
              </Card>
            )}
            <Card>
              <CardHeader title="Accompanying staff" description={`${trip.staff.length + 1} adults with ${summary.registered} students`} />
              <StaffPanel tripId={trip.id} staff={trip.staff} editable={admin && trip.status !== "RETURNED" && trip.status !== "CANCELLED"} />
            </Card>
            {summary.consentRefused > 0 && (
              <p className="rounded-xl bg-critical/8 px-4 py-3 text-[13px] text-danger-ink ring-1 ring-critical/20 ring-inset">
                {summary.consentRefused} {summary.consentRefused === 1 ? "parent has" : "parents have"} refused consent.
              </p>
            )}
          </div>
        </div>
      )}

      {tab === "students" && (
        <StudentsTab trip={trip} admin={admin} fee={fee} when={when} collegeName={settings.collegeName} />
      )}

      {tab === "transport" && (
        <TransportPanel
          tripId={trip.id}
          editable={admin && before}
          vehicles={trip.vehicles.map((v) => ({
            id: v.id,
            name: v.name,
            driverName: v.driverName,
            driverPhone: v.driverPhone,
            seats: v.seats,
            used: trip.participants.filter((p) => p.vehicleId === v.id && p.status === "REGISTERED").length,
          }))}
          riders={trip.participants
            .filter((p) => p.status === "REGISTERED")
            .map((p) => ({
              id: p.id,
              fullName: p.student.fullName,
              rollNo: p.rollNo,
              section: p.student.section,
              program: p.student.program,
              vehicleId: p.vehicleId,
            }))}
        />
      )}

      {tab === "rooms" && (
        <RoomsPanel
          tripId={trip.id}
          editable={admin && trip.status !== "RETURNED" && trip.status !== "CANCELLED"}
          rooms={trip.rooms.map((r) => ({
            id: r.id,
            name: r.name,
            beds: r.beds,
            place: r.place,
            notes: r.notes,
            occupants: trip.participants
              .filter((p) => p.roomId === r.id && p.status === "REGISTERED")
              .map((p) => ({ id: p.id, fullName: p.student.fullName, rollNo: p.rollNo, section: p.student.section })),
          }))}
          unassigned={trip.participants
            .filter((p) => p.roomId == null && p.status === "REGISTERED")
            .map((p) => ({ id: p.id, fullName: p.student.fullName, rollNo: p.rollNo, section: p.student.section }))}
        />
      )}

      {tab === "rollcall" && <RollCallTab trip={trip} admin={admin} fee={fee} />}
    </div>
  );
}

type TripData = NonNullable<Awaited<ReturnType<typeof getTrip>>>;

async function StudentsTab({ trip, admin, fee, when, collegeName }: { trip: TripData; admin: boolean; fee: number; when: string; collegeName: string }) {
  const { programs, sections } = await getClassOptions();
  const vehicleName = new Map(trip.vehicles.map((v) => [v.id, v.name]));
  const roomName = new Map(trip.rooms.map((r) => [r.id, r.name]));
  const consentBy = trip.consentDeadline ? formatDate(fromDbDate(trip.consentDeadline)) : null;
  const feeBy = trip.feeDeadline ? formatDate(fromDbDate(trip.feeDeadline)) : null;
  const rows: ParticipantView[] = trip.participants.map((p) => {
    const phone = p.emergencyPhone ?? p.student.parentPhone;
    const base = {
      studentName: p.student.fullName,
      tripTitle: trip.title,
      destination: trip.destination,
      when,
      meetingPoint: trip.meetingPoint,
      fee,
      balance: Math.max(0, fee - Number(p.feePaid)),
      collegeName,
    };
    return {
      id: p.id,
      rollNo: p.rollNo,
      fullName: p.student.fullName,
      program: p.student.program,
      section: p.student.section,
      photoUrl: p.student.photoUrl,
      parentPhone: p.student.parentPhone,
      status: p.status,
      consent: p.consent,
      feePaid: Number(p.feePaid),
      receiptNo: p.receiptNo,
      medicalNotes: p.medicalNotes,
      emergencyPhone: p.emergencyPhone,
      vehicleName: p.vehicleId ? (vehicleName.get(p.vehicleId) ?? null) : null,
      roomName: p.roomId ? (roomName.get(p.roomId) ?? null) : null,
      overrideNote: p.overrideNote,
      messages: {
        notice: whatsAppLink(phone, tripParentMessage("notice", { ...base, deadline: null })),
        consent: whatsAppLink(phone, tripParentMessage("consent", { ...base, deadline: consentBy })),
        fee: whatsAppLink(phone, tripParentMessage("fee", { ...base, deadline: feeBy })),
      },
    };
  });
  const enrolmentOpen = trip.status === "OPEN" || trip.status === "CLOSED";

  return (
    <div className="flex flex-col gap-5">
      {admin && trip.status === "OPEN" && (
        <AddStudents tripId={trip.id} programs={trip.programs.length ? trip.programs : programs} sections={sections} />
      )}
      {admin && trip.status === "CLOSED" && (
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-[13px] text-ink-2">
          Registration is closed. Reopen it from the top of the page to add more students.
        </p>
      )}
      <ParticipantTable rows={rows} fee={fee} editable={admin && trip.status !== "RETURNED" && trip.status !== "CANCELLED"} enrolmentOpen={enrolmentOpen} />
      {admin && rows.some((r) => r.status === "REGISTERED") && <MessagePanel rows={rows} fee={fee} />}
    </div>
  );
}

async function RollCallTab({ trip, admin, fee }: { trip: TripData; admin: boolean; fee: number }) {
  const settings = await getSettings();
  if (trip.status === "CANCELLED") {
    return <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-sm text-muted">This trip was cancelled.</p>;
  }
  const registered = trip.participants.filter((p) => p.status === "REGISTERED");
  const vehicleName = new Map(trip.vehicles.map((v) => [v.id, v.name]));

  if (trip.status === "RETURNED") {
    const travelled = registered.filter((p) => p.departedAt);
    return (
      <Card className="overflow-hidden">
        <CardHeader
          title="Roll call record"
          description={`${travelled.length} travelled · ${travelled.filter((p) => p.returnedAt).length} returned · ${registered.length - travelled.length} did not travel`}
        />
        <ul className="divide-y divide-line">
          {registered.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center gap-3 px-5 py-2.5 text-sm">
              <span className="min-w-0 flex-1 truncate font-medium">{p.student.fullName}</span>
              <span className="text-[12px] text-muted tabular">
                {p.departedAt ? `Left ${formatTime(p.departedAt, settings.timezone)}` : "Did not travel"}
                {p.returnedAt && ` · Back ${formatTime(p.returnedAt, settings.timezone)}`}
              </span>
            </li>
          ))}
        </ul>
      </Card>
    );
  }

  if (registered.length === 0) {
    return <p className="rounded-xl border border-line bg-surface px-4 py-6 text-center text-sm text-muted">Add students before taking roll call.</p>;
  }

  const rows: RollCallRow[] = registered.map((p) => ({
    id: p.id,
    fullName: p.student.fullName,
    rollNo: p.rollNo,
    className: p.student.program,
    section: p.student.section,
    photoUrl: p.student.photoUrl,
    vehicleId: p.vehicleId,
    vehicleName: p.vehicleId ? (vehicleName.get(p.vehicleId) ?? null) : null,
    consentMissing: p.consent !== "RECEIVED",
    feeDue: fee > 0 && Number(p.feePaid) < fee,
    phone: p.emergencyPhone ?? p.student.parentPhone,
    departed: !!p.departedAt,
    returned: !!p.returnedAt,
  }));
  return (
    <RollCall
      // A fresh tick list for each phase, so departure ticks don't carry over.
      key={trip.status}
      tripId={trip.id}
      phase={trip.status === "DEPARTED" ? "return" : "departure"}
      rows={rows}
      vehicles={trip.vehicles.map((v) => ({ id: v.id, name: v.name }))}
      editable={admin}
    />
  );
}

function fmt(hhmm: string) {
  return formatMinutes(parseHHMM(hhmm));
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-muted">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  );
}
