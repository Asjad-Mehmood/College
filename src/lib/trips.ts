import "server-only";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMinutes, fromDbDate, parseHHMM } from "@/lib/time";

export const STAFF_ROLES = ["In-charge", "Assistant", "Female staff escort", "Sports coach", "Medical / first aid"];

export async function getTrip(id: number) {
  return prisma.trip.findUnique({
    where: { id },
    include: {
      staff: { orderBy: { id: "asc" } },
      vehicles: { orderBy: { id: "asc" } },
      participants: {
        orderBy: [{ student: { program: "asc" } }, { student: { section: "asc" } }, { rollNo: "asc" }],
        include: {
          student: {
            select: {
              fullName: true,
              fatherName: true,
              program: true,
              section: true,
              parentPhone: true,
              photoUrl: true,
              status: true,
            },
          },
        },
      },
    },
  });
}

export type FullTrip = NonNullable<Awaited<ReturnType<typeof getTrip>>>;

/** Counts behind the progress bars on the list and overview. */
export function tripSummary(trip: { seats: number | null; feeAmount: unknown }, participants: { status: string; consent: string; feePaid: unknown }[]) {
  const active = participants.filter((p) => p.status === "REGISTERED");
  const fee = Number(trip.feeAmount);
  const paid = active.filter((p) => fee > 0 && Number(p.feePaid) >= fee).length;
  return {
    registered: active.length,
    withdrawn: participants.length - active.length,
    seatsLeft: trip.seats == null ? null : Math.max(0, trip.seats - active.length),
    consentReceived: active.filter((p) => p.consent === "RECEIVED").length,
    consentRefused: active.filter((p) => p.consent === "REFUSED").length,
    consentPending: active.filter((p) => p.consent === "PENDING").length,
    feePaid: paid,
    feePending: fee > 0 ? active.length - paid : 0,
    collected: active.reduce((sum, p) => sum + Number(p.feePaid), 0),
  };
}

export function tripWhen(t: { departDate: Date; departTime: string; returnDate: Date; returnTime: string }) {
  const d = fromDbDate(t.departDate);
  const r = fromDbDate(t.returnDate);
  const dep = `${formatDate(d, { weekday: true })}, ${formatMinutes(parseHHMM(t.departTime))}`;
  const ret = d === r ? formatMinutes(parseHHMM(t.returnTime)) : `${formatDate(r, { weekday: true })}, ${formatMinutes(parseHHMM(t.returnTime))}`;
  return `${dep} → ${ret}`;
}

export type Eligibility = { blocks: string[]; warnings: string[] };

/**
 * Whether a student can be added to a trip. Blocks stop enrolment; warnings
 * (open severe violations) need the In-Charge to confirm.
 */
export async function checkEligibility(
  trip: { id: number; status: string; programs: string[]; seats: number | null },
  student: { rollNo: string; program: string; status: string },
  registeredCount: number,
): Promise<Eligibility> {
  const blocks: string[] = [];
  const warnings: string[] = [];
  if (trip.status !== "OPEN") blocks.push("Registration for this trip is closed.");
  if (student.status !== "ACTIVE") blocks.push("The student is not active (struck off or graduated).");
  if (trip.programs.length > 0 && !trip.programs.includes(student.program)) {
    blocks.push(`This trip is only for ${trip.programs.join(", ")}.`);
  }
  if (trip.seats != null && registeredCount >= trip.seats) blocks.push("All seats are filled.");
  const existing = await prisma.tripParticipant.findUnique({
    where: { tripId_rollNo: { tripId: trip.id, rollNo: student.rollNo } },
  });
  if (existing?.status === "REGISTERED") blocks.push("Already registered for this trip.");

  const severe = await prisma.violation.findMany({
    where: { rollNo: student.rollNo, status: "OPEN", severity: "SEVERE" },
    include: { type: { select: { name: true } } },
  });
  for (const v of severe) {
    warnings.push(`Open severe violation: ${v.type.name} (${formatDate(fromDbDate(v.incidentDate))}, case #${v.id}).`);
  }
  return { blocks, warnings };
}

export function tripParentMessage(
  kind: "notice" | "consent" | "fee",
  args: { studentName: string; tripTitle: string; destination: string; when: string; meetingPoint: string | null; fee: number; balance: number; collegeName: string; deadline: string | null },
) {
  const sign = `– Discipline In-Charge, ${args.collegeName}`;
  if (kind === "consent") {
    return `Respected Parent, please submit your signed permission for ${args.studentName} to join the ${args.tripTitle} (${args.destination}, ${args.when})${args.deadline ? ` by ${args.deadline}` : ""}. ${sign}`;
  }
  if (kind === "fee") {
    return `Respected Parent, the trip fee of Rs. ${args.balance} for ${args.studentName} (${args.tripTitle}) is still due${args.deadline ? `; please pay by ${args.deadline}` : ""}. ${sign}`;
  }
  return (
    `Respected Parent, ${args.studentName} is registered for the ${args.tripTitle} to ${args.destination}, ${args.when}. ` +
    `${args.meetingPoint ? `Meeting point: ${args.meetingPoint}. ` : ""}${args.fee > 0 ? `Fee: Rs. ${args.fee}. ` : ""}${sign}`
  );
}
