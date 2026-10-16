import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft, CalendarDays, FileSpreadsheet, MapPin, Printer } from "lucide-react";
import { Meter } from "@/components/meter";
import { Card, CardHeader, Pill, Skeleton, buttonClass, cx } from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { TRIP_STATUS_LABELS, TRIP_TYPE_LABELS } from "@/lib/labels";
import { whatsAppLink } from "@/lib/messages";
import { getClassOptions } from "@/lib/records";
import { getSettings } from "@/lib/settings";
import { formatDate, formatMinutes, formatTime, fromDbDate, parseHHMM } from "@/lib/time";
import { getTrip, tripParentMessage, tripSummary, tripWhen } from "@/lib/trips";
import { RollCall, type RollCallRow } from "./roll-call";
import { AddStudents, MessagePanel, ParticipantTable, type ParticipantView } from "./students";
import { StaffPanel, TripControls } from "./trip-controls";
import { TransportPanel } from "./transport";

export const metadata: Metadata = { title: "Trip" };

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "students", label: "Students" },
  { key: "transport", label: "Transport" },
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
  const tab: Tab = TABS.some((t) => t.key === sp.tab) ? (sp.tab as Tab) : "overview";
  const [trip, settings] = await Promise.all([getTrip(id), getSettings()]);
  if (!trip) notFound();

  const admin = can.administer(user.role);
  const fee = Number(trip.feeAmount);
  const summary = tripSummary(trip, trip.participants);
  const when = tripWhen(trip);
  const before = trip.status === "OPEN" || trip.status === "CLOSED";
  const canDelete = admin && (trip.status === "CANCELLED" || (before && trip.participants.every((p) => Number(p.feePaid) === 0)));
  const tone = trip.status === "DEPARTED" ? "warning" : trip.status === "OPEN" ? "accent" : trip.status === "CANCELLED" ? "critical" : "neutral";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={tone}>{TRIP_STATUS_LABELS[trip.status]}</Pill>
            <span className="text-[13px] text-muted">{TRIP_TYPE_LABELS[trip.type]}</span>
          </div>
          <h1 className="mt-1.5 text-2xl font-semibold tracking-tight">{trip.title}</h1>
          <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-2">
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="size-4 text-muted" aria-hidden /> {trip.destination}
            </span>
            <span className="inline-flex items-center gap-1.5">
              <CalendarDays className="size-4 text-muted" aria-hidden /> {when}
            </span>
          </p>
        </div>
        <div className="no-print flex flex-wrap items-start gap-2 lg:justify-end">
          {admin && <TripControls id={trip.id} status={trip.status} canDelete={canDelete} />}
        </div>
      </div>

      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <nav className="inline-flex rounded-xl border border-line bg-surface p-1 shadow-card" aria-label="Trip sections">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={t.key === "overview" ? `/trips/${trip.id}` : `/trips/${trip.id}?tab=${t.key}`}
              aria-current={tab === t.key ? "page" : undefined}
              className={cx(
                "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors sm:px-3.5",
                tab === t.key ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}
            >
              {t.label}
              {t.key === "students" && <span className="ml-1.5 text-[12px] tabular opacity-70">{summary.registered}</span>}
            </Link>
          ))}
        </nav>
        <div className="flex flex-wrap gap-2">
          <a href={`/trip-docs/${trip.id}?doc=slips`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
            <Printer className="size-3.5" aria-hidden /> Permission slips
          </a>
          <a href={`/trip-docs/${trip.id}?doc=list`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
            <Printer className="size-3.5" aria-hidden /> Student list
          </a>
          <a href={`/trip-docs/${trip.id}?doc=bus`} target="_blank" rel="noreferrer" className={buttonClass("secondary", "sm")}>
            <Printer className="size-3.5" aria-hidden /> Bus lists
          </a>
          <a href={`/api/export/trips/${trip.id}`} className={buttonClass("secondary", "sm")}>
            <FileSpreadsheet className="size-3.5" aria-hidden /> Excel
          </a>
        </div>
      </div>

      {tab === "overview" && (
        <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader title="Details" />
              <dl className="grid gap-x-6 gap-y-4 p-5 text-sm sm:grid-cols-2">
                <Info label="Departure">{`${formatDate(fromDbDate(trip.departDate), { weekday: true })}, ${fmt(trip.departTime)}`}</Info>
                <Info label="Return">{`${formatDate(fromDbDate(trip.returnDate), { weekday: true })}, ${fmt(trip.returnTime)}`}</Info>
                <Info label="Meeting point">{trip.meetingPoint ?? "—"}</Info>
                <Info label="Teacher in charge">{`${trip.inChargeName}${trip.inChargePhone ? ` · ${trip.inChargePhone}` : ""}`}</Info>
                <Info label="Open to">{trip.programs.length ? trip.programs.join(", ") : "All programs"}</Info>
                <Info label="Seats">{trip.seats ?? "No limit"}</Info>
                <Info label="Fee">{fee > 0 ? `Rs. ${fee.toLocaleString()}${trip.feeDeadline ? ` · pay by ${formatDate(fromDbDate(trip.feeDeadline))}` : ""}` : "Free"}</Info>
                <Info label="Consent deadline">{trip.consentDeadline ? formatDate(fromDbDate(trip.consentDeadline)) : "—"}</Info>
              </dl>
              {(trip.purpose || trip.itinerary) && (
                <div className="grid gap-4 border-t border-line p-5 sm:grid-cols-2">
                  {trip.purpose && (
                    <div>
                      <p className="text-[12px] font-medium tracking-wide text-muted uppercase">Purpose</p>
                      <p className="mt-1 text-sm whitespace-pre-line">{trip.purpose}</p>
                    </div>
                  )}
                  {trip.itinerary && (
                    <div>
                      <p className="text-[12px] font-medium tracking-wide text-muted uppercase">Itinerary</p>
                      <p className="mt-1 text-sm whitespace-pre-line">{trip.itinerary}</p>
                    </div>
                  )}
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
            <Card>
              <CardHeader title="Progress" />
              <div className="flex flex-col gap-3 p-5">
                {trip.seats != null ? (
                  <Meter label="Seats filled" value={summary.registered} total={trip.seats} />
                ) : (
                  <p className="text-sm">
                    <span className="font-semibold tabular">{summary.registered}</span> students registered
                  </p>
                )}
                <Meter label="Consent received" value={summary.consentReceived} total={summary.registered} />
                {fee > 0 && <Meter label="Fee paid" value={summary.feePaid} total={summary.registered} />}
                {fee > 0 && (
                  <p className="text-[13px] text-ink-2">
                    Collected <span className="font-semibold text-ink">Rs. {summary.collected.toLocaleString()}</span> of Rs.{" "}
                    {(fee * summary.registered).toLocaleString()}
                  </p>
                )}
                {summary.consentRefused > 0 && <p className="text-[13px] text-danger-ink">{summary.consentRefused} parents refused consent.</p>}
                <Link href={`/trips/${trip.id}?tab=students`} className="text-[13px] font-medium text-accent-ink hover:underline">
                  Manage students →
                </Link>
              </div>
            </Card>
            <Card>
              <CardHeader title="Accompanying staff" />
              <StaffPanel tripId={trip.id} staff={trip.staff} editable={admin && trip.status !== "RETURNED" && trip.status !== "CANCELLED"} />
            </Card>
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
              className: `${p.student.program} ${p.student.section}`,
              vehicleId: p.vehicleId,
            }))}
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
    className: `${p.student.program} ${p.student.section}`,
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
