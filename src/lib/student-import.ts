import "server-only";
import * as XLSX from "xlsx";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

type Field =
  | "rollNo"
  | "fullName"
  | "fatherName"
  | "program"
  | "section"
  | "studentPhone"
  | "parentPhone"
  | "photoUrl"
  | "status";

// Accepted header spellings (lower-cased, letters and digits only).
const HEADERS: Record<string, Field> = {
  rollno: "rollNo", rollnumber: "rollNo", roll: "rollNo", id: "rollNo", studentid: "rollNo",
  fullname: "fullName", name: "fullName", studentname: "fullName",
  fathername: "fatherName", father: "fatherName", guardianname: "fatherName", guardian: "fatherName", fatherguardianname: "fatherName",
  program: "program", programme: "program", department: "program", degree: "program", group: "program",
  section: "section", class: "section", yearsection: "section", year: "section",
  studentphone: "studentPhone", studentmobile: "studentPhone", mobile: "studentPhone",
  parentphone: "parentPhone", fatherphone: "parentPhone", guardianphone: "parentPhone", parentmobile: "parentPhone", fathermobile: "parentPhone", parentcontact: "parentPhone",
  photourl: "photoUrl", photo: "photoUrl", picture: "photoUrl", image: "photoUrl",
  contact: "parentPhone", contactno: "parentPhone", phone: "parentPhone", phoneno: "parentPhone", fathercontact: "parentPhone",
  fatherno: "parentPhone", parentno: "parentPhone", parentcontactno: "parentPhone", whatsapp: "parentPhone", fatherwhatsapp: "parentPhone",
  studentcontact: "studentPhone", studentno: "studentPhone", studentwhatsapp: "studentPhone", ownphone: "studentPhone",
  studentfullname: "fullName", nameofstudent: "fullName", fname: "fatherName", fathersname: "fatherName", sofather: "fatherName",
  rno: "rollNo", regno: "rollNo", registrationno: "rollNo", admissionno: "rollNo", classrollno: "rollNo",
  subject: "program", subjects: "program", course: "program", classsection: "section",
  status: "status",
};

/** Column order used when pasted rows have no header row (same as the template). */
const DEFAULT_ORDER: Field[] = ["rollNo", "fullName", "fatherName", "program", "section", "parentPhone", "studentPhone", "status"];
const norm = (v: unknown) => String(v ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

const LABELS: Record<Field, string> = {
  rollNo: "Roll No", fullName: "Full Name", fatherName: "Father Name", program: "Program", section: "Section",
  studentPhone: "Student Phone", parentPhone: "Parent Phone", photoUrl: "Photo URL", status: "Status",
};

const REQUIRED: Field[] = ["rollNo", "fullName", "fatherName", "program", "section", "parentPhone"];
const MAX_LEN: Partial<Record<Field, number>> = {
  rollNo: 20, fullName: 100, fatherName: 100, program: 50, section: 20, studentPhone: 20, parentPhone: 20, photoUrl: 255,
};

export type ImportReport = {
  ok: boolean;
  message: string;
  inserted?: number;
  updated?: number;
  errors?: { row: number; message: string }[];
  totalErrors?: number;
  /** Set on a check (nothing saved yet). */
  checked?: boolean;
  preview?: { row: number; rollNo: string; fullName: string; program: string; section: string; parentPhone: string; isNew: boolean }[];
  newSections?: string[];
  newPrograms?: string[];
};

/** Reads an Excel/CSV file into rows of cells. Uses a sheet named "Students" if there is one. */
function readFile(buffer: ArrayBuffer): string[][] {
  const book = XLSX.read(buffer, { type: "array", raw: false });
  const name = book.SheetNames.find((n) => n.trim().toLowerCase() === "students") ?? book.SheetNames[0];
  return XLSX.utils.sheet_to_json<string[]>(book.Sheets[name], { header: 1, defval: "", raw: false, blankrows: false });
}

/** Rows copied from Excel / Google Sheets arrive tab-separated; CSV text also works. */
function readText(text: string): string[][] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n").filter((l) => l.trim());
  if (lines.length === 0) return [];
  const sep = lines.some((l) => l.includes("\t")) ? "\t" : null;
  if (sep) return lines.map((l) => l.split(sep));
  const book = XLSX.read(lines.join("\n"), { type: "string", raw: false });
  return XLSX.utils.sheet_to_json<string[]>(book.Sheets[book.SheetNames[0]], { header: 1, defval: "", raw: false, blankrows: false });
}

/** Excel drops the leading 0 from numbers like 03001234567. */
function phone(value: string) {
  const v = value.trim();
  return /^3\d{9}$/.test(v) ? `0${v}` : v;
}

function status(value: string) {
  const v = value.trim().toLowerCase().replace(/[\s_-]/g, "");
  if (!v || v === "active") return "ACTIVE";
  if (v === "struckoff") return "STRUCK_OFF";
  if (v === "graduated") return "GRADUATED";
  return null;
}

export async function importStudents(
  source: File | string,
  batchId: number | null = null,
  batchForSection: (section: string) => Promise<number | null> = async () => null,
  opts: { dryRun?: boolean } = {},
): Promise<ImportReport> {
  let grid: string[][];
  try {
    grid = typeof source === "string" ? readText(source) : readFile(await source.arrayBuffer());
  } catch {
    return { ok: false, message: "Couldn't read the list. Upload an .xlsx, .xls or .csv file, or paste rows copied from Excel." };
  }
  grid = grid.map((r) => r.map((c) => String(c ?? "").trim()));
  if (grid.length === 0) return { ok: false, message: "The list is empty." };

  // Find the header row (it may be below a title such as the college name).
  const columns = new Map<number, Field>();
  let headerAt = -1;
  for (let i = 0; i < Math.min(grid.length, 10) && headerAt < 0; i++) {
    const found = new Map<number, Field>();
    grid[i].forEach((cell, c) => {
      const field = HEADERS[norm(cell)];
      if (field && ![...found.values()].includes(field)) found.set(c, field);
    });
    if (found.size >= 3) {
      headerAt = i;
      found.forEach((f, c) => columns.set(c, f));
    }
  }
  if (headerAt < 0) {
    // No header row: use the template order (Roll No, Name, Father Name, Program, Section, Parent Phone, …).
    DEFAULT_ORDER.forEach((f, c) => columns.set(c, f));
  }
  const mapped = [...columns.values()];
  const missing = REQUIRED.filter((f) => !mapped.includes(f));
  if (missing.length) {
    return {
      ok: false,
      message: `Missing column(s): ${missing.map((f) => LABELS[f]).join(", ")}. Download the Excel template to see the columns.`,
    };
  }
  const rows = grid.slice(headerAt + 1).map((cells) => {
    const r = {} as Record<Field, string>;
    columns.forEach((f, c) => (r[f] = cells[c] ?? ""));
    return r;
  });
  if (rows.length === 0) return { ok: false, message: "There are no student rows under the headings." };

  const errors: { row: number; message: string }[] = [];
  const valid = new Map<string, Record<Field, string | null>>();
  rows.forEach((raw, i) => {
    const rowNo = headerAt + i + 2; // spreadsheet row number
    const rec = { ...raw } as Record<Field, string | null>;
    if (Object.values(rec).every((v) => !v)) return; // blank line

    rec.rollNo = (rec.rollNo ?? "").toUpperCase().replace(/\s+/g, "");
    rec.parentPhone = phone(rec.parentPhone ?? "");
    rec.studentPhone = rec.studentPhone ? phone(rec.studentPhone) : null;
    rec.photoUrl = rec.photoUrl || null;
    const st = status(rec.status ?? "");

    const missingHere = REQUIRED.filter((f) => !rec[f]);
    if (missingHere.length) return errors.push({ row: rowNo, message: `Missing ${missingHere.map((f) => LABELS[f]).join(", ")}` });
    const tooLong = (Object.keys(MAX_LEN) as Field[]).find((f) => (rec[f]?.length ?? 0) > MAX_LEN[f]!);
    if (tooLong) return errors.push({ row: rowNo, message: `${LABELS[tooLong]} is longer than ${MAX_LEN[tooLong]} characters` });
    if (!st) return errors.push({ row: rowNo, message: `Unknown status “${rec.status}”` });
    if (rec.photoUrl && !/^https?:\/\//i.test(rec.photoUrl)) {
      return errors.push({ row: rowNo, message: "Photo URL must start with http:// or https://" });
    }
    if (valid.has(rec.rollNo!)) return errors.push({ row: rowNo, message: `Duplicate roll number ${rec.rollNo}` });
    rec.status = st;
    valid.set(rec.rollNo!, rec);
  });

  if (valid.size === 0) {
    return { ok: false, message: "No valid rows to import.", errors: errors.slice(0, 25), totalErrors: errors.length };
  }

  const records = [...valid.values()];
  // Use the existing spelling of programs and sections ("cd1" → "CD1"), so no duplicates are made.
  const [programs, sections] = await Promise.all([
    prisma.program.findMany({ select: { name: true } }),
    prisma.section.findMany({ select: { name: true } }),
  ]);
  const programBy = new Map(programs.map((p) => [norm(p.name), p.name]));
  const sectionBy = new Map(sections.map((p) => [norm(p.name), p.name]));
  for (const r of records) {
    r.program = programBy.get(norm(r.program)) ?? r.program;
    r.section = sectionBy.get(norm(r.section)) ?? r.section;
  }

  if (opts.dryRun) {
    const existingNow = new Set(
      (await prisma.student.findMany({ where: { rollNo: { in: records.map((r) => r.rollNo!) } }, select: { rollNo: true } })).map((s) => s.rollNo),
    );
    const updates = records.filter((r) => existingNow.has(r.rollNo!)).length;
    const rowOf = new Map(rows.map((r, i) => [String(r.rollNo ?? "").toUpperCase().replace(/\s+/g, ""), headerAt + i + 2]));
    return {
      ok: true,
      checked: true,
      message: `${records.length} students are ready: ${records.length - updates} new, ${updates} will be updated.${errors.length ? ` ${errors.length} rows have problems and will be skipped.` : ""}`,
      inserted: records.length - updates,
      updated: updates,
      errors: errors.slice(0, 50),
      totalErrors: errors.length,
      preview: records.slice(0, 200).map((r) => ({
        row: rowOf.get(r.rollNo!) ?? 0,
        rollNo: r.rollNo!,
        fullName: r.fullName!,
        program: r.program!,
        section: r.section!,
        parentPhone: r.parentPhone!,
        isNew: !existingNow.has(r.rollNo!),
      })),
      newPrograms: [...new Set(records.map((r) => r.program!))].filter((p) => !programBy.has(norm(p))),
      newSections: [...new Set(records.map((r) => r.section!))].filter((p) => !sectionBy.has(norm(p))),
    };
  }

  await prisma.program.createMany({ data: [...new Set(records.map((r) => (r.program ?? "").slice(0, 50)))].map((name) => ({ name })), skipDuplicates: true });
  // Sections named in the file are created if they don't exist yet (year can be set later).
  await prisma.section.createMany({ data: [...new Set(records.map((r) => (r.section ?? "").slice(0, 20)))].map((name) => ({ name })), skipDuplicates: true });
  const existing = new Set(
    (
      await prisma.student.findMany({
        where: { rollNo: { in: records.map((r) => r.rollNo!) } },
        select: { rollNo: true },
      })
    ).map((s) => s.rollNo),
  );

  // Upsert in chunks with a single statement each, so large lists stay fast.
  const hasPhoto = mapped.includes("photoUrl");
  const hasStudentPhone = mapped.includes("studentPhone");
  const hasStatus = mapped.includes("status");
  // New students go to the batch studying in their section's year; otherwise the chosen batch.
  const bySection = new Map<string, number | null>();
  for (const sec of new Set(records.map((r) => r.section ?? ""))) bySection.set(sec, (await batchForSection(sec)) ?? batchId);
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500);
    const values = chunk.map(
      (r) =>
        Prisma.sql`(${r.rollNo}, ${r.fullName}, ${r.fatherName}, ${r.program}, ${r.section}, ${r.studentPhone}, ${r.parentPhone}, ${r.photoUrl}, ${r.status}::"StudentStatus", ${bySection.get(r.section ?? "") ?? batchId}, now(), now())`,
    );
    await prisma.$executeRaw`
      INSERT INTO students (roll_no, full_name, father_name, program, section, student_phone, parent_phone, photo_url, status, batch_id, created_at, updated_at)
      VALUES ${Prisma.join(values)}
      ON CONFLICT (roll_no) DO UPDATE SET
        full_name = EXCLUDED.full_name,
        father_name = EXCLUDED.father_name,
        program = EXCLUDED.program,
        section = EXCLUDED.section,
        parent_phone = EXCLUDED.parent_phone,
        ${hasStudentPhone ? Prisma.sql`student_phone = EXCLUDED.student_phone,` : Prisma.empty}
        ${hasPhoto ? Prisma.sql`photo_url = EXCLUDED.photo_url,` : Prisma.empty}
        ${hasStatus ? Prisma.sql`status = EXCLUDED.status,` : Prisma.empty}
        batch_id = COALESCE(students.batch_id, EXCLUDED.batch_id),
        updated_at = now()
    `;
  }

  const updated = records.filter((r) => existing.has(r.rollNo!)).length;
  const inserted = records.length - updated;
  return {
    ok: true,
    message: `Imported ${records.length} students: ${inserted} new, ${updated} updated.${errors.length ? ` ${errors.length} rows skipped.` : ""}`,
    inserted,
    updated,
    errors: errors.slice(0, 25),
    totalErrors: errors.length,
  };
}
