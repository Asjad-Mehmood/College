import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintFrame } from "@/components/print-frame";
import { PrintToolbar } from "@/components/print-toolbar";
import { Skeleton, cx } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { CONSENT_LABELS, TRIP_TYPE_LABELS } from "@/lib/labels";
import { getSettings, type Settings } from "@/lib/settings";
import { formatDate, formatMinutes, fromDbDate, localParts, parseHHMM } from "@/lib/time";
import { compareSections } from "@/lib/sections";
import { getTrip, type FullTrip, tripWhen } from "@/lib/trips";

export const metadata: Metadata = { title: "Trip documents" };

const DOCS = { slips: "Parent permission slips", list: "Student list", bus: "Bus lists", rooms: "Room list" } as const;
type Doc = keyof typeof DOCS;

export default function TripDocsPage(props: PageProps<"/trip-docs/[id]">) {
  return (
    <Suspense
      fallback={
        <>
          <PrintToolbar title="Trip documents" />
          <Skeleton className="mx-auto mt-8 h-[1000px] w-full max-w-[210mm] rounded-none" />
        </>
      }
    >
      <Docs params={props.params} searchParams={props.searchParams} />
    </Suspense>
  );
}

async function Docs({
  params,
  searchParams,
}: {
  params: PageProps<"/trip-docs/[id]">["params"];
  searchParams: PageProps<"/trip-docs/[id]">["searchParams"];
}) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const sp = await searchParams;
  const doc: Doc = typeof sp.doc === "string" && sp.doc in DOCS ? (sp.doc as Doc) : "slips";
  const [trip, settings] = await Promise.all([getTrip(id), getSettings()]);
  if (!trip) notFound();
  // Every document runs section by section.
  const registered = trip.participants
    .filter((p) => p.status === "REGISTERED")
    .sort((a, b) => compareSections(a.student.section, b.student.section) || a.rollNo.localeCompare(b.rollNo));

  return (
    <>
      <PrintToolbar title={`${DOCS[doc]} — ${trip.title}`}>
        <div className="flex flex-wrap gap-1">
          {(Object.keys(DOCS) as Doc[]).filter((d) => d !== "rooms" || trip.overnight).map((d) => (
            <Link
              key={d}
              href={`/trip-docs/${trip.id}?doc=${d}`}
              className={cx("rounded-lg px-2.5 py-1.5 text-[13px] font-medium", d === doc ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2")}
            >
              {DOCS[d]}
            </Link>
          ))}
        </div>
      </PrintToolbar>
      <div className="px-4 py-8 print:p-0">
        <style>{`@page { size: A4; margin: 0; }`}</style>
        <div className="mx-auto flex max-w-[210mm] flex-col gap-6 print:max-w-none print:gap-0">
          {registered.length === 0 ? (
            <Paper>
              <p className="text-center text-sm">No students are registered for this trip yet.</p>
            </Paper>
          ) : doc === "slips" ? (
            registered.map((p) => <Slip key={p.id} trip={trip} p={p} settings={settings} />)
          ) : doc === "list" ? (
            <StudentList trip={trip} rows={registered} settings={settings} />
          ) : doc === "rooms" ? (
            <RoomList trip={trip} rows={registered} settings={settings} />
          ) : (
            <BusLists trip={trip} rows={registered} settings={settings} />
          )}
        </div>
      </div>
    </>
  );
}

type Row = FullTrip["participants"][number];

function Paper({ children, className, band = "14mm" }: { children: React.ReactNode; className?: string; band?: string }) {
  return (
    <article className={cx("bg-white p-[12mm] text-[13px] leading-relaxed text-black shadow-pop print:px-[16mm] print:py-0 print:shadow-none", className)}>
      <PrintFrame top={band} bottom={band}>
        {children}
      </PrintFrame>
    </article>
  );
}

function Letterhead({ settings, subtitle }: { settings: Settings; subtitle: string }) {
  return (
    <header className="border-b-2 border-black pb-2 text-center">
      <p className="text-lg font-bold tracking-tight uppercase">{settings.collegeName}</p>
      {settings.collegeAddress && <p className="text-[12px]">{settings.collegeAddress}</p>}
      <p className="mt-0.5 text-[12px] font-semibold tracking-[0.15em] uppercase">{subtitle}</p>
    </header>
  );
}

const t12 = (hhmm: string) => formatMinutes(parseHHMM(hhmm));

/** Half-page slip: two fit on an A4 sheet. */
function Slip({ trip, p, settings }: { trip: FullTrip; p: Row; settings: Settings }) {
  const fee = Number(trip.feeAmount);
  return (
    <Paper band="7mm" className="break-inside-avoid print:min-h-[130mm] print:border-b print:border-dashed print:border-black">
      <Letterhead settings={settings} subtitle="Parent permission slip" />
      <p className="mt-3 text-center text-[15px] font-semibold">
        {trip.title} <span className="font-normal">({TRIP_TYPE_LABELS[trip.type]})</span>
      </p>
      <table className="mt-3 w-full border-collapse text-[12px]">
        <tbody>
          {[
            ["Destination", trip.destination],
            ["Departure", `${formatDate(fromDbDate(trip.departDate), { weekday: true })}, ${t12(trip.departTime)}${trip.meetingPoint ? ` from ${trip.meetingPoint}` : ""}`],
            ["Return", `${formatDate(fromDbDate(trip.returnDate), { weekday: true })}, ${t12(trip.returnTime)}`],
            ["Teacher in charge", `${trip.inChargeName}${trip.inChargePhone ? ` (${trip.inChargePhone})` : ""}`],
            ...(fee > 0 ? [["Fee", `Rs. ${fee.toLocaleString()}${trip.feeDeadline ? ` (pay by ${formatDate(fromDbDate(trip.feeDeadline))})` : ""}`]] : []),
            ...(trip.itinerary ? [["Plan", trip.itinerary]] : []),
          ].map(([k, v]) => (
            <tr key={k}>
              <th className="w-32 border border-black bg-neutral-100 px-2 py-1 text-left align-top font-semibold">{k}</th>
              <td className="border border-black px-2 py-1 whitespace-pre-line">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-3 text-justify">
        I, <span className="font-semibold">{p.student.fatherName}</span>, father/guardian of{" "}
        <span className="font-semibold">{p.student.fullName}</span> (Roll No. {p.rollNo}, {p.student.program} {p.student.section}), give
        permission for my son/daughter to go on this trip. He/she will follow the instructions of the teachers. I will not hold the
        college responsible for any loss caused by my child&apos;s own carelessness.
      </p>
      <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-3 text-[12px]">
        <p>Any illness / medicine: ____________________</p>
        <p>Phone in emergency: {p.emergencyPhone ?? p.student.parentPhone}</p>
        <p className="mt-4">Father/guardian signature: ____________________</p>
        <p className="mt-4">Date: ______________</p>
      </div>
      {trip.consentDeadline && (
        <p className="mt-2 text-[11px]">Please send this slip back to the Discipline Office by {formatDate(fromDbDate(trip.consentDeadline))}.</p>
      )}
    </Paper>
  );
}

function StudentList({ trip, rows, settings }: { trip: FullTrip; rows: Row[]; settings: Settings }) {
  const fee = Number(trip.feeAmount);
  const vehicle = new Map(trip.vehicles.map((v) => [v.id, v.name]));
  const room = new Map(trip.rooms.map((r) => [r.id, r.name]));
  return (
    <Paper>
      <Letterhead settings={settings} subtitle="Trip student list" />
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold">{trip.title}</p>
          <p>
            {trip.destination} · {tripWhen(trip)}
          </p>
        </div>
        <p className="text-right">
          Printed {formatDate(localParts(new Date(), settings.timezone).date)}
          <br />
          {rows.length} students
        </p>
      </div>
      {trip.staff.length > 0 && (
        <p className="mt-2">
          <span className="font-semibold">Staff: </span>
          {[`${trip.inChargeName} (in charge)`, ...trip.staff.map((s) => `${s.name} (${s.role}${s.phone ? `, ${s.phone}` : ""})`)].join(" · ")}
        </p>
      )}
      <table className="mt-3 w-full border-collapse text-[11px]">
        <thead>
          <tr>
            {["#", "Roll no.", "Name", "Father", "Section", "Consent", ...(fee > 0 ? ["Fee"] : []), "Emergency", "Vehicle", ...(trip.overnight ? ["Room"] : [])].map((h) => (
              <th key={h} className="border border-black bg-neutral-100 px-1.5 py-1 text-left font-semibold">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((p, i) => (
            <tr key={p.id} className="break-inside-avoid">
              <td className="border border-black px-1.5 py-1">{i + 1}</td>
              <td className="border border-black px-1.5 py-1 font-mono">{p.rollNo}</td>
              <td className="border border-black px-1.5 py-1">{p.student.fullName}</td>
              <td className="border border-black px-1.5 py-1">{p.student.fatherName}</td>
              <td className="border border-black px-1.5 py-1">{p.student.section}</td>
              <td className="border border-black px-1.5 py-1">{CONSENT_LABELS[p.consent]}</td>
              {fee > 0 && (
                <td className="border border-black px-1.5 py-1">
                  {Number(p.feePaid) >= fee ? `Paid${p.receiptNo ? ` (${p.receiptNo})` : ""}` : `Due ${fee - Number(p.feePaid)}`}
                </td>
              )}
              <td className="border border-black px-1.5 py-1">{p.emergencyPhone ?? p.student.parentPhone}</td>
              <td className="border border-black px-1.5 py-1">{p.vehicleId ? vehicle.get(p.vehicleId) : "—"}</td>
              {trip.overnight && <td className="border border-black px-1.5 py-1">{p.roomId ? room.get(p.roomId) : "—"}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-14 flex justify-between text-[12px]">
        {["Teacher in charge", "Discipline In-Charge", "Principal"].map((s) => (
          <div key={s} className="text-center">
            <div className="mb-1 w-40 border-b border-black" />
            <p className="font-semibold">{s}</p>
          </div>
        ))}
      </div>
    </Paper>
  );
}

function BusLists({ trip, rows, settings }: { trip: FullTrip; rows: Row[]; settings: Settings }) {
  const groups = [
    ...trip.vehicles.map((v) => ({ key: String(v.id), title: v.name, driver: v.driverName ? `${v.driverName}${v.driverPhone ? `, ${v.driverPhone}` : ""}` : null, rows: rows.filter((p) => p.vehicleId === v.id) })),
    { key: "none", title: "No vehicle assigned", driver: null, rows: rows.filter((p) => p.vehicleId == null) },
  ].filter((g) => g.rows.length > 0);
  return (
    <>
      {groups.map((g) => (
        <Paper key={g.key} className="break-after-page">
          <Letterhead settings={settings} subtitle="Bus list" />
          <div className="mt-3 flex flex-wrap justify-between gap-2">
            <div>
              <p className="text-[15px] font-semibold">{g.title}</p>
              <p>
                {trip.title} · {trip.destination}
              </p>
            </div>
            <p className="text-right">
              {g.driver && (
                <>
                  Driver: {g.driver}
                  <br />
                </>
              )}
              In charge: {trip.inChargeName}
              {trip.inChargePhone && `, ${trip.inChargePhone}`}
            </p>
          </div>
          <table className="mt-3 w-full border-collapse text-[11px]">
            <thead>
              <tr>
                {["#", "Roll no.", "Name", "Section", "Emergency phone", "Medical notes", "Out", "Back"].map((h) => (
                  <th key={h} className="border border-black bg-neutral-100 px-1.5 py-1 text-left font-semibold">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {g.rows.map((p, i) => (
                <tr key={p.id} className="break-inside-avoid">
                  <td className="border border-black px-1.5 py-1">{i + 1}</td>
                  <td className="border border-black px-1.5 py-1 font-mono">{p.rollNo}</td>
                  <td className="border border-black px-1.5 py-1">{p.student.fullName}</td>
                  <td className="border border-black px-1.5 py-1">{p.student.section}</td>
                  <td className="border border-black px-1.5 py-1">{p.emergencyPhone ?? p.student.parentPhone}</td>
                  <td className="border border-black px-1.5 py-1">{p.medicalNotes ?? ""}</td>
                  <td className="w-10 border border-black px-1.5 py-1" />
                  <td className="w-10 border border-black px-1.5 py-1" />
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-[12px]">Total: {g.rows.length}</p>
        </Paper>
      ))}
    </>
  );
}

function RoomList({ trip, rows, settings }: { trip: FullTrip; rows: Row[]; settings: Settings }) {
  const unplaced = rows.filter((p) => p.roomId == null);
  return (
    <Paper>
      <Letterhead settings={settings} subtitle="Room list" />
      <div className="mt-3 flex flex-wrap justify-between gap-2">
        <div>
          <p className="text-[15px] font-semibold">{trip.title}</p>
          <p>
            {trip.destination} · {tripWhen(trip)}
          </p>
        </div>
        <p className="text-right">
          {trip.rooms.length} rooms · {rows.length - unplaced.length} of {rows.length} students placed
        </p>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {trip.rooms.map((r) => {
          const occupants = rows.filter((p) => p.roomId === r.id);
          return (
            <div key={r.id} className="break-inside-avoid border border-black">
              <p className="flex justify-between border-b border-black bg-neutral-100 px-2 py-1 font-semibold">
                <span>{r.name}</span>
                <span className="font-normal">
                  {occupants.length}/{r.beds} beds
                </span>
              </p>
              {(r.place || r.notes) && <p className="border-b border-black px-2 py-0.5 text-[11px]">{[r.place, r.notes].filter(Boolean).join(" · ")}</p>}
              <ol className="px-2 py-1 text-[12px]">
                {occupants.map((p, i) => (
                  <li key={p.id}>
                    {i + 1}. {p.student.fullName} <span className="font-mono text-[11px]">({p.rollNo}, {p.student.section})</span>
                  </li>
                ))}
                {occupants.length === 0 && <li className="text-neutral-500">Empty</li>}
              </ol>
            </div>
          );
        })}
      </div>
      {unplaced.length > 0 && (
        <p className="mt-4 text-[12px]">
          <span className="font-semibold">Not yet placed ({unplaced.length}): </span>
          {unplaced.map((p) => `${p.student.fullName} (${p.student.section})`).join(", ")}
        </p>
      )}
    </Paper>
  );
}
