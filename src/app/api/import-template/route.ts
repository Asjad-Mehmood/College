import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { SHIFT_LABELS } from "@/lib/settings";

const HEAD = ["Roll No", "Full Name", "Father Name", "Program", "Section", "Parent Phone", "Student Phone", "Status"];

/** Excel template for bulk import, filled with this college's own programs and sections. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return new Response("Sign in required", { status: 401 });
  if (user.role !== "ADMIN") return new Response("Not allowed", { status: 403 });

  const [programs, sections, batches] = await Promise.all([
    prisma.program.findMany({ orderBy: { name: "asc" }, select: { name: true } }),
    prisma.section.findMany({ orderBy: { name: "asc" }, select: { name: true, year: true, shift: true } }),
    prisma.batch.findMany({ where: { passedOut: false }, orderBy: { startYear: "desc" }, select: { name: true } }),
  ]);
  const p = (i: number) => programs[i % Math.max(programs.length, 1)]?.name ?? ["FSc Pre-Medical", "ICS"][i % 2];
  const s = (i: number) => sections[i % Math.max(sections.length, 1)]?.name ?? ["1A", "1B"][i % 2];
  const yy = String(new Date().getFullYear()).slice(2);

  const book = XLSX.utils.book_new();
  const cols = [12, 24, 24, 20, 10, 15, 15, 10].map((wch) => ({ wch }));

  // 1. The sheet to fill (empty, so example rows are never imported by mistake).
  const students = XLSX.utils.aoa_to_sheet([HEAD]);
  students["!cols"] = cols;
  XLSX.utils.book_append_sheet(book, students, "Students");

  // 2. A filled-in example.
  const example = XLSX.utils.aoa_to_sheet([
    HEAD,
    [`${yy}-101`, "Muhammad Ali", "Muhammad Aslam", p(0), s(0), "03001234567", "03111234567", "Active"],
    [`${yy}-102`, "Ayesha Bibi", "Ghulam Rasool", p(1), s(1), "03211234567", "", "Active"],
    [`${yy}-103`, "Hamza Ahmed", "Ahmed Khan", p(0), s(0), "03331234567", "", ""],
  ]);
  example["!cols"] = cols;
  XLSX.utils.book_append_sheet(book, example, "Example");

  // 3. What can be written in Program and Section.
  const rows = Math.max(programs.length, sections.length, batches.length, 1);
  const lists = XLSX.utils.aoa_to_sheet([
    ["Programs", "", "Sections", "Year", "Shift", "", "Batches studying now"],
    ...Array.from({ length: rows }, (_, i) => [
      programs[i]?.name ?? "",
      "",
      sections[i]?.name ?? "",
      sections[i] ? (sections[i].year === "FIRST" ? "1st year" : sections[i].year === "SECOND" ? "2nd year" : "") : "",
      sections[i] ? SHIFT_LABELS[sections[i].shift] : "",
      "",
      batches[i]?.name ?? "",
    ]),
  ]);
  lists["!cols"] = [22, 2, 12, 10, 10, 2, 22].map((wch) => ({ wch }));
  XLSX.utils.book_append_sheet(book, lists, "Lists");

  // 4. Simple instructions.
  const help = XLSX.utils.aoa_to_sheet([
    ["How to fill this file"],
    [""],
    ["1. Write one student per row in the “Students” sheet. Look at the “Example” sheet if unsure."],
    ["2. Must fill: Roll No, Full Name, Father Name, Program, Section, Parent Phone."],
    ["3. Can leave empty: Student Phone, Status (empty = Active). Status can be Active, Struck off or Graduated."],
    ["4. Program and Section: write them as in the “Lists” sheet. A new name is added automatically."],
    ["5. Phone numbers like 03001234567. If Excel removes the first 0, that is fine — the portal adds it back."],
    ["6. If a roll number is already in the portal, that student is updated (not added twice)."],
    ["7. Save the file and upload it in Settings → Bulk import students. Click “Check first” to see problems before importing."],
    [""],
    ["Tip: you can also copy the rows from any Excel sheet and paste them in the portal (Paste from Excel). Copy the heading row too."],
  ]);
  help["!cols"] = [{ wch: 110 }];
  XLSX.utils.book_append_sheet(book, help, "How to fill");

  const buffer: Buffer = XLSX.write(book, { type: "buffer", bookType: "xlsx" });
  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="student-import-template.xlsx"',
    },
  });
}
