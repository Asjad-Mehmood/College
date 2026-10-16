import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUser, can } from "@/lib/auth";
import { ACTION_LABELS, CARD_LABELS, REASON_LABELS } from "@/lib/labels";
import { parseRecordFilters, queryLedger } from "@/lib/records";
import { getSettings } from "@/lib/settings";
import { formatTime, localParts } from "@/lib/time";

const MAX_ROWS = 20_000;

export async function GET(request: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!can.viewReports(user.role)) return new Response("Not allowed", { status: 403 });

  const params = Object.fromEntries(request.nextUrl.searchParams);
  const format = params.format === "csv" ? "csv" : "xlsx";
  const filters = parseRecordFilters(params);
  const settings = await getSettings();
  const { rows } = await queryLedger(filters, settings, { limit: MAX_ROWS });

  const sheet = XLSX.utils.json_to_sheet(
    rows.map((r) => ({
      "Roll No": r.rollNo,
      Name: r.fullName,
      "Father Name": r.fatherName,
      Program: r.program,
      Section: r.section,
      Date: r.lateDate,
      "Arrival Time": formatTime(r.arrivedAt, settings.timezone),
      "Minutes Late": r.minutesLate,
      "Strike (month)": r.strikeNo,
      "Lates This Month": r.monthCount,
      Reason: REASON_LABELS[r.reason],
      "Action Taken": ACTION_LABELS[r.actionTaken],
      "ID Card": CARD_LABELS[r.cardStatus],
      "Fine (Rs)": r.fineAmount,
      "Fine Paid": r.fineAmount > 0 ? (r.finePaid ? "Yes" : "No") : "",
      "Parent Phone": r.parentPhone,
      Remarks: r.remarks ?? "",
      "Recorded By": r.recordedBy,
    })),
  );
  sheet["!cols"] = [10, 22, 22, 20, 14, 11, 11, 8, 8, 8, 16, 18, 10, 9, 9, 14, 30, 18].map((wch) => ({ wch }));

  const stamp = localParts(new Date(), settings.timezone).date;
  const filename = `late-records-${stamp}.${format}`;

  if (format === "csv") {
    // BOM so Excel opens the UTF-8 file correctly.
    const csv = "﻿" + XLSX.utils.sheet_to_csv(sheet);
    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  }

  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Late records");
  const buffer: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
