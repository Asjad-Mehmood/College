import type { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import type { Prisma } from "@/generated/prisma/client";
import type { StudentStatus } from "@/generated/prisma/enums";
import { can, getCurrentUser } from "@/lib/auth";
import { STUDENT_STATUS_LABELS } from "@/lib/labels";
import { scoped } from "@/lib/scope";

export async function GET(request: NextRequest) {
  const prisma = await scoped();
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (!can.viewReports(user.role)) return new Response("Not allowed", { status: 403 });

  const p = request.nextUrl.searchParams;
  const section = p.get("section") ?? "";
  const program = p.get("program") ?? "";
  const status = p.get("status") ?? "ACTIVE";
  const where: Prisma.StudentWhereInput = {
    ...(section && { section }),
    ...(program && { program }),
    ...(["ACTIVE", "STRUCK_OFF", "GRADUATED"].includes(status) && { status: status as StudentStatus }),
  };
  const students = await prisma.student.findMany({ where, orderBy: [{ section: "asc" }, { rollNo: "asc" }], take: 20_000 });
  const sheet = XLSX.utils.json_to_sheet(
    students.map((s) => ({
      "Roll No": s.rollNo,
      Name: s.fullName,
      "Father Name": s.fatherName,
      Program: s.program,
      Section: s.section,
      "Parent Phone": s.parentPhone,
      "Student Phone": s.studentPhone ?? "",
      Status: STUDENT_STATUS_LABELS[s.status],
    })),
  );
  sheet["!cols"] = [12, 24, 24, 14, 10, 16, 16, 12].map((wch) => ({ wch }));
  const book = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(book, sheet, "Students");
  const buffer: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  const name = `students${section ? `-${section.replace(/[^\w-]+/g, "")}` : ""}.xlsx`;
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${name}"`,
    },
  });
}
