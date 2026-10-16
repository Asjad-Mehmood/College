"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import type { ConsentStatus, TripType } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { TRIP_TYPE_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { isValidYmd, localParts, toDbDate } from "@/lib/time";
import { checkEligibility, type Eligibility } from "@/lib/trips";

export type FormState = { ok?: boolean; message?: string } | null;

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

async function admin() {
  return requireUser(["ADMIN"]);
}

/* ---------- Trip ---------- */

export async function saveTrip(_: FormState, fd: FormData): Promise<FormState> {
  const user = await admin();
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const id = Number(get("id")) || null;
  const type = get("type") as TripType;
  const departDate = get("departDate");
  const returnDate = get("returnDate");
  const departTime = get("departTime");
  const returnTime = get("returnTime");
  const seatsRaw = get("seats");
  const seats = seatsRaw ? Number(seatsRaw) : null;
  const fee = Number(get("feeAmount") || 0);
  const feeDeadline = get("feeDeadline");
  const consentDeadline = get("consentDeadline");
  const programs = fd.getAll("programs").map(String).filter(Boolean);

  if (!get("title")) return { ok: false, message: "Give the trip a title." };
  if (!(type in TRIP_TYPE_LABELS)) return { ok: false, message: "Choose the type of trip." };
  if (!get("destination")) return { ok: false, message: "Enter the destination." };
  if (!get("inChargeName")) return { ok: false, message: "Enter the teacher in charge." };
  if (!isValidYmd(departDate) || !isValidYmd(returnDate)) return { ok: false, message: "Enter departure and return dates." };
  if (!TIME.test(departTime) || !TIME.test(returnTime)) return { ok: false, message: "Enter departure and return times." };
  if (`${returnDate} ${returnTime}` <= `${departDate} ${departTime}`) {
    return { ok: false, message: "The return must be after the departure." };
  }
  if (seats !== null && (!Number.isInteger(seats) || seats < 1 || seats > 2000)) {
    return { ok: false, message: "Seats must be a whole number (leave empty for no limit)." };
  }
  if (!Number.isFinite(fee) || fee < 0 || fee > 999_999) return { ok: false, message: "Enter a valid fee." };
  for (const d of [feeDeadline, consentDeadline]) {
    if (d && !isValidYmd(d)) return { ok: false, message: "Check the deadline dates." };
  }

  const data = {
    title: get("title").slice(0, 120),
    type,
    destination: get("destination").slice(0, 150),
    purpose: get("purpose").slice(0, 2000) || null,
    itinerary: get("itinerary").slice(0, 4000) || null,
    departDate: toDbDate(departDate),
    departTime,
    returnDate: toDbDate(returnDate),
    returnTime,
    meetingPoint: get("meetingPoint").slice(0, 150) || null,
    programs,
    seats,
    feeAmount: Math.round(fee),
    feeDeadline: feeDeadline ? toDbDate(feeDeadline) : null,
    consentDeadline: consentDeadline ? toDbDate(consentDeadline) : null,
    inChargeName: get("inChargeName").slice(0, 100),
    inChargePhone: get("inChargePhone").slice(0, 20) || null,
  };

  if (id) {
    const existing = await prisma.trip.findUnique({ where: { id }, include: { _count: { select: { participants: { where: { status: "REGISTERED" } } } } } });
    if (!existing) return { ok: false, message: "Trip not found." };
    if (seats !== null && seats < existing._count.participants) {
      return { ok: false, message: `${existing._count.participants} students are already registered; seats can't be fewer.` };
    }
    await prisma.trip.update({ where: { id }, data });
    redirect(`/trips/${id}`);
  }
  const trip = await prisma.trip.create({ data: { ...data, createdById: user.id } });
  redirect(`/trips/${trip.id}?tab=students`);
}

export async function setTripRegistration(id: number, open: boolean) {
  await admin();
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip || !["OPEN", "CLOSED"].includes(trip.status)) return;
  await prisma.trip.update({ where: { id }, data: { status: open ? "OPEN" : "CLOSED" } });
  refresh();
}

export async function cancelTrip(id: number, reason: string): Promise<FormState> {
  await admin();
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip || !["OPEN", "CLOSED"].includes(trip.status)) return { ok: false, message: "Only trips that haven't left can be cancelled." };
  if (!reason.trim()) return { ok: false, message: "Give a reason for cancelling." };
  await prisma.trip.update({ where: { id }, data: { status: "CANCELLED", cancelReason: reason.trim().slice(0, 300) } });
  refresh();
  return { ok: true };
}

export async function deleteTrip(id: number) {
  await admin();
  const trip = await prisma.trip.findUnique({ where: { id } });
  if (!trip || !["OPEN", "CLOSED", "CANCELLED"].includes(trip.status)) return;
  await prisma.trip.delete({ where: { id } });
  redirect("/trips");
}

/* ---------- Staff ---------- */

export async function addStaff(tripId: number, input: { name: string; phone: string; role: string }): Promise<FormState> {
  await admin();
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Enter the staff member's name." };
  await prisma.tripStaff.create({
    data: { tripId, name: name.slice(0, 100), phone: input.phone.trim().slice(0, 20) || null, role: input.role.trim().slice(0, 40) || "Assistant" },
  });
  refresh();
  return { ok: true };
}

export async function removeStaff(id: number) {
  await admin();
  await prisma.tripStaff.delete({ where: { id } });
  refresh();
}

/* ---------- Students ---------- */

export type CheckResult =
  | { ok: true; student: { rollNo: string; fullName: string; program: string; section: string }; eligibility: Eligibility }
  | { ok: false; message: string };

async function loadForEnrolment(tripId: number) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip) return null;
  const registered = await prisma.tripParticipant.count({ where: { tripId, status: "REGISTERED" } });
  return { trip, registered };
}

export async function checkStudentForTrip(tripId: number, rawRoll: string): Promise<CheckResult> {
  await admin();
  const rollNo = rawRoll.trim().toUpperCase().replace(/\s+/g, "");
  if (!rollNo) return { ok: false, message: "Enter a roll number." };
  const ctx = await loadForEnrolment(tripId);
  if (!ctx) return { ok: false, message: "Trip not found." };
  const student = await prisma.student.findFirst({ where: { rollNo: { equals: rollNo, mode: "insensitive" } } });
  if (!student) return { ok: false, message: `No student found with roll number “${rollNo}”.` };
  return {
    ok: true,
    student: { rollNo: student.rollNo, fullName: student.fullName, program: student.program, section: student.section },
    eligibility: await checkEligibility(ctx.trip, student, ctx.registered),
  };
}

export async function addParticipant(tripId: number, rollNo: string, overrideNote?: string): Promise<FormState> {
  await admin();
  const ctx = await loadForEnrolment(tripId);
  const student = await prisma.student.findUnique({ where: { rollNo } });
  if (!ctx || !student) return { ok: false, message: "Trip or student not found." };
  const { blocks, warnings } = await checkEligibility(ctx.trip, student, ctx.registered);
  if (blocks.length) return { ok: false, message: blocks[0] };
  if (warnings.length && !overrideNote?.trim()) {
    return { ok: false, message: "Confirm why this student may go despite the warning." };
  }
  // Re-registering a withdrawn student keeps their consent and payment history.
  await prisma.tripParticipant.upsert({
    where: { tripId_rollNo: { tripId, rollNo } },
    update: { status: "REGISTERED", overrideNote: overrideNote?.trim().slice(0, 200) || null },
    create: { tripId, rollNo, overrideNote: overrideNote?.trim().slice(0, 200) || null },
  });
  refresh();
  return { ok: true, message: `Added ${student.fullName}.` };
}

export async function addClass(tripId: number, program: string, section: string): Promise<FormState> {
  await admin();
  const ctx = await loadForEnrolment(tripId);
  if (!ctx) return { ok: false, message: "Trip not found." };
  if (ctx.trip.status !== "OPEN") return { ok: false, message: "Registration for this trip is closed." };
  const students = await prisma.student.findMany({
    where: { status: "ACTIVE", program, ...(section ? { section } : {}) },
    orderBy: { rollNo: "asc" },
  });
  if (students.length === 0) return { ok: false, message: "No active students in that class." };

  let added = 0;
  const skipped: string[] = [];
  let registered = ctx.registered;
  for (const s of students) {
    const { blocks, warnings } = await checkEligibility(ctx.trip, s, registered);
    if (blocks.some((b) => b.startsWith("Already registered"))) continue;
    if (blocks.length || warnings.length) {
      skipped.push(`${s.fullName} (${s.rollNo}): ${(blocks[0] ?? warnings[0]).replace(/\.$/, "")}`);
      continue;
    }
    await prisma.tripParticipant.upsert({
      where: { tripId_rollNo: { tripId, rollNo: s.rollNo } },
      update: { status: "REGISTERED" },
      create: { tripId, rollNo: s.rollNo },
    });
    added += 1;
    registered += 1;
  }
  refresh();
  const msg = `Added ${added} ${added === 1 ? "student" : "students"}.`;
  return {
    ok: added > 0 || skipped.length === 0,
    message: skipped.length ? `${msg} Skipped ${skipped.length}: ${skipped.slice(0, 5).join("; ")}${skipped.length > 5 ? "; …" : ""}` : msg,
  };
}

export async function updateParticipant(
  id: number,
  input: {
    consent?: ConsentStatus;
    feePaid?: number;
    receiptNo?: string;
    medicalNotes?: string;
    emergencyPhone?: string;
  },
): Promise<FormState> {
  await admin();
  const p = await prisma.tripParticipant.findUnique({ where: { id }, include: { trip: true } });
  if (!p) return { ok: false, message: "Not found." };
  const settings = await getSettings();
  const today = toDbDate(localParts(new Date(), settings.timezone).date);
  const data: Record<string, unknown> = {};
  if (input.consent && input.consent !== p.consent) {
    data.consent = input.consent;
    data.consentAt = input.consent === "PENDING" ? null : today;
  }
  if (input.feePaid !== undefined) {
    const fee = Math.round(Number(input.feePaid));
    if (!Number.isFinite(fee) || fee < 0 || fee > 999_999) return { ok: false, message: "Enter a valid amount." };
    if (fee !== Number(p.feePaid)) {
      data.feePaid = fee;
      data.feePaidAt = fee > 0 ? today : null;
    }
  }
  if (input.receiptNo !== undefined) data.receiptNo = input.receiptNo.trim().slice(0, 30) || null;
  if (input.medicalNotes !== undefined) data.medicalNotes = input.medicalNotes.trim().slice(0, 300) || null;
  if (input.emergencyPhone !== undefined) data.emergencyPhone = input.emergencyPhone.trim().slice(0, 20) || null;
  await prisma.tripParticipant.update({ where: { id }, data });
  refresh();
  return { ok: true };
}

export async function setParticipantStatus(id: number, status: "REGISTERED" | "WITHDRAWN"): Promise<FormState> {
  await admin();
  const p = await prisma.tripParticipant.findUnique({ where: { id }, include: { trip: true, student: true } });
  if (!p) return { ok: false, message: "Not found." };
  if (!["OPEN", "CLOSED"].includes(p.trip.status)) return { ok: false, message: "The trip has already left." };
  if (status === "REGISTERED") {
    const registered = await prisma.tripParticipant.count({ where: { tripId: p.tripId, status: "REGISTERED" } });
    if (p.trip.seats != null && registered >= p.trip.seats) return { ok: false, message: "All seats are filled." };
  }
  await prisma.tripParticipant.update({ where: { id }, data: { status, ...(status === "WITHDRAWN" ? { vehicleId: null } : {}) } });
  refresh();
  return { ok: true };
}

export async function removeParticipant(id: number): Promise<FormState> {
  await admin();
  const p = await prisma.tripParticipant.findUnique({ where: { id }, include: { trip: true } });
  if (!p) return { ok: false, message: "Not found." };
  if (Number(p.feePaid) > 0) return { ok: false, message: "A fee was paid; withdraw the student instead so the payment stays on record." };
  if (!["OPEN", "CLOSED"].includes(p.trip.status)) return { ok: false, message: "The trip has already left." };
  await prisma.tripParticipant.delete({ where: { id } });
  refresh();
  return { ok: true };
}

/* ---------- Transport ---------- */

export async function saveVehicle(
  tripId: number,
  input: { id?: number; name: string; driverName: string; driverPhone: string; seats: string },
): Promise<FormState> {
  await admin();
  const name = input.name.trim();
  if (!name) return { ok: false, message: "Enter the bus/van name or number." };
  const seats = input.seats.trim() ? Number(input.seats) : null;
  if (seats !== null && (!Number.isInteger(seats) || seats < 1 || seats > 200)) return { ok: false, message: "Seats must be 1–200." };
  const data = {
    name: name.slice(0, 60),
    driverName: input.driverName.trim().slice(0, 100) || null,
    driverPhone: input.driverPhone.trim().slice(0, 20) || null,
    seats,
  };
  if (input.id) await prisma.tripVehicle.update({ where: { id: input.id }, data });
  else await prisma.tripVehicle.create({ data: { ...data, tripId } });
  refresh();
  return { ok: true };
}

export async function removeVehicle(id: number) {
  await admin();
  await prisma.tripVehicle.delete({ where: { id } });
  refresh();
}

export async function assignVehicle(participantId: number, vehicleId: number | null): Promise<FormState> {
  await admin();
  if (vehicleId) {
    const v = await prisma.tripVehicle.findUnique({ where: { id: vehicleId }, include: { _count: { select: { participants: true } } } });
    if (!v) return { ok: false, message: "Vehicle not found." };
    if (v.seats != null && v._count.participants >= v.seats) return { ok: false, message: `${v.name} is full.` };
  }
  await prisma.tripParticipant.update({ where: { id: participantId }, data: { vehicleId } });
  refresh();
  return { ok: true };
}

/** Puts every unassigned student into the first vehicle with a free seat. */
export async function autoAssign(tripId: number): Promise<FormState> {
  await admin();
  const vehicles = await prisma.tripVehicle.findMany({
    where: { tripId },
    orderBy: { id: "asc" },
    include: { _count: { select: { participants: true } } },
  });
  const waiting = await prisma.tripParticipant.findMany({
    where: { tripId, status: "REGISTERED", vehicleId: null },
    orderBy: [{ student: { program: "asc" } }, { student: { section: "asc" } }, { rollNo: "asc" }],
  });
  let placed = 0;
  for (const v of vehicles) {
    let free = v.seats == null ? Infinity : v.seats - v._count.participants;
    while (free > 0 && placed < waiting.length) {
      await prisma.tripParticipant.update({ where: { id: waiting[placed].id }, data: { vehicleId: v.id } });
      placed += 1;
      free -= 1;
    }
  }
  refresh();
  const left = waiting.length - placed;
  return { ok: left === 0, message: `Assigned ${placed}.${left ? ` ${left} still need a seat — add another vehicle.` : ""}` };
}

/* ---------- Roll call ---------- */

export async function markRollCall(participantId: number, phase: "departure" | "return", present: boolean): Promise<FormState> {
  await admin();
  const p = await prisma.tripParticipant.findUnique({ where: { id: participantId }, include: { trip: true } });
  if (!p || p.status !== "REGISTERED") return { ok: false, message: "Not found." };
  if (phase === "departure" && !["OPEN", "CLOSED"].includes(p.trip.status)) return { ok: false, message: "Departure is already recorded." };
  if (phase === "return" && p.trip.status !== "DEPARTED") return { ok: false, message: "The trip isn't on the way back." };
  await prisma.tripParticipant.update({
    where: { id: participantId },
    data: phase === "departure" ? { departedAt: present ? new Date() : null } : { returnedAt: present ? new Date() : null },
  });
  return { ok: true };
}

export async function finishRollCall(tripId: number, phase: "departure" | "return", note: string): Promise<FormState> {
  await admin();
  const trip = await prisma.trip.findUnique({ where: { id: tripId }, include: { participants: { where: { status: "REGISTERED" } } } });
  if (!trip) return { ok: false, message: "Trip not found." };
  if (phase === "departure") {
    if (!["OPEN", "CLOSED"].includes(trip.status)) return { ok: false, message: "Departure is already recorded." };
    const present = trip.participants.filter((p) => p.departedAt).length;
    if (present === 0) return { ok: false, message: "Mark the students who are boarding first." };
    const missing = trip.participants.length - present;
    if (missing > 0 && !note.trim()) return { ok: false, message: `${missing} not marked — add a note explaining why before leaving.` };
    await prisma.trip.update({ where: { id: tripId }, data: { status: "DEPARTED", departedAt: new Date(), departureNote: note.trim().slice(0, 300) || null } });
  } else {
    if (trip.status !== "DEPARTED") return { ok: false, message: "The trip isn't on the way back." };
    const travelled = trip.participants.filter((p) => p.departedAt);
    const missing = travelled.filter((p) => !p.returnedAt).length;
    if (missing > 0 && !note.trim()) return { ok: false, message: `${missing} not back — add a note before closing the trip.` };
    await prisma.trip.update({ where: { id: tripId }, data: { status: "RETURNED", returnedAt: new Date(), returnNote: note.trim().slice(0, 300) || null } });
  }
  refresh();
  return { ok: true };
}
