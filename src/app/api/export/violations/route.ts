import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { can, getCurrentUser } from "@/lib/auth";
import { CASE_STATUS_LABELS, SEVERITY_LABELS, VIOLATION_ACTION_LABELS } from "@/lib/labels";
import { getSettings } from "@/lib/settings";
import { fromDbDate, localParts } from "@/lib/time";
import { parseViolationFilters, queryViolations } from "@/lib/violations";

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!can.viewReports(user.role)) return new Response("Not allowed", { status: 403 });

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const format = params.format === "csv" ? "csv" : "xlsx";
  const settings = await getSettings();
  const { rows } = await queryViolations(parseViolationFilters(params), settings, { limit: 20_000 });

  const sheet = XLSX.utils.json_to_sheet(
    rows.map((v) => ({
      "Case No": v.id,
      Date: fromDbDate(v.incidentDate),
      Time: v.incidentTime ?? "",
      "Roll No": v.rollNo,
      Name: v.student.fullName,
      "Father Name": v.student.fatherName,
      Program: v.student.program,
      Section: v.student.section,
      Violation: v.type.name,
      Severity: SEVERITY_LABELS[v.severity],
      Place: v.location ?? "",
      Description: v.description,
      "Reported By": v.reportedBy ?? "",
      "Action Taken": VIOLATION_ACTION_LABELS[v.actionTaken],
      "Suspension Days": v.suspensionDays ?? "",
      "Fine (Rs)": v.fineAmount,
      "Fine Paid": v.fineAmount > 0 ? (v.finePaid ? "Yes" : "No") : "",
      Status: CASE_STATUS_LABELS[v.status],
      "Closing Note": v.closingNote ?? "",
      "Parent Phone": v.student.parentPhone,
      "Recorded By": v.recordedBy.fullName,
    })),
  );
  sheet["!cols"] = [8, 11, 7, 12, 22, 22, 20, 14, 26, 9, 14, 50, 20, 22, 9, 9, 9, 8, 30, 14, 18].map((wch) => ({ wch }));

  const filename = `violations-${localParts(new Date(), settings.timezone).date}.${format}`;
  if (format === "csv") {
    return new Response("﻿" + XLSX.utils.sheet_to_csv(sheet), {
      headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` },
    });
  }
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Violations");
  const buffer: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
