import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { can, getCurrentUser } from "@/lib/auth";
import { CONSENT_LABELS } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { formatTime, fromDbDate } from "@/lib/time";
import { getTrip } from "@/lib/trips";

export async function GET(_: NextRequest, ctx: RouteContext<"/api/export/trips/[id]">) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!can.viewReports(user.role)) return new Response("Not allowed", { status: 403 });
  const id = Number((await ctx.params).id);
  const trip = Number.isInteger(id) ? await getTrip(id) : null;
  if (!trip) return new Response("Not found", { status: 404 });
  const settings = await getSettings();
  const fee = Number(trip.feeAmount);
  const vehicle = new Map(trip.vehicles.map((v) => [v.id, v.name]));

  const sheet = XLSX.utils.json_to_sheet(
    trip.participants.map((p) => ({
      "Roll No": p.rollNo,
      Name: p.student.fullName,
      "Father Name": p.student.fatherName,
      Program: p.student.program,
      Section: p.student.section,
      Status: p.status === "REGISTERED" ? "Registered" : "Withdrawn",
      Consent: CONSENT_LABELS[p.consent],
      "Consent Date": p.consentAt ? fromDbDate(p.consentAt) : "",
      "Fee (Rs)": fee,
      "Paid (Rs)": Number(p.feePaid),
      "Receipt No": p.receiptNo ?? "",
      Vehicle: p.vehicleId ? (vehicle.get(p.vehicleId) ?? "") : "",
      "Emergency Phone": p.emergencyPhone ?? p.student.parentPhone,
      "Medical Notes": p.medicalNotes ?? "",
      Departed: p.departedAt ? formatTime(p.departedAt, settings.timezone) : "",
      Returned: p.returnedAt ? formatTime(p.returnedAt, settings.timezone) : "",
      "Discipline Override": p.overrideNote ?? "",
    })),
  );
  sheet["!cols"] = [12, 22, 22, 20, 14, 11, 10, 12, 8, 9, 12, 16, 15, 28, 9, 9, 30].map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Students");
  const buffer: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  const name = trip.title.replace(/[^\w-]+/g, "-").slice(0, 40);
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="trip-${trip.id}-${name}.xlsx"`,
    },
  });
}
