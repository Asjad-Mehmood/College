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
  status: "status",
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
};

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

export async function importStudents(file: File): Promise<ImportReport> {
  let rows: Record<string, unknown>[];
  try {
    const book = XLSX.read(await file.arrayBuffer(), { type: "array", raw: false });
    const sheet = book.Sheets[book.SheetNames[0]];
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "", raw: false });
  } catch {
    return { ok: false, message: "Couldn't read the file. Upload an .xlsx, .xls or .csv file." };
  }
  if (rows.length === 0) return { ok: false, message: "The first sheet has no rows." };

  const mapping = new Map<string, Field>();
  for (const key of Object.keys(rows[0])) {
    const field = HEADERS[key.toLowerCase().replace(/[^a-z0-9]/g, "")];
    if (field && ![...mapping.values()].includes(field)) mapping.set(key, field);
  }
  const missing = REQUIRED.filter((f) => ![...mapping.values()].includes(f));
  if (missing.length) {
    return {
      ok: false,
      message: `Missing column(s): ${missing.join(", ")}. Download the template to see the expected headers.`,
    };
  }

  const errors: { row: number; message: string }[] = [];
  const valid = new Map<string, Record<Field, string | null>>();
  rows.forEach((raw, i) => {
    const rowNo = i + 2; // header is row 1
    const rec = {} as Record<Field, string | null>;
    for (const [key, field] of mapping) rec[field] = String(raw[key] ?? "").trim();
    if (Object.values(rec).every((v) => !v)) return; // blank line

    rec.rollNo = (rec.rollNo ?? "").toUpperCase().replace(/\s+/g, "");
    rec.parentPhone = phone(rec.parentPhone ?? "");
    rec.studentPhone = rec.studentPhone ? phone(rec.studentPhone) : null;
    rec.photoUrl = rec.photoUrl || null;
    const st = status(rec.status ?? "");

    const missingHere = REQUIRED.filter((f) => !rec[f]);
    if (missingHere.length) return errors.push({ row: rowNo, message: `Missing ${missingHere.join(", ")}` });
    const tooLong = (Object.keys(MAX_LEN) as Field[]).find((f) => (rec[f]?.length ?? 0) > MAX_LEN[f]!);
    if (tooLong) return errors.push({ row: rowNo, message: `${tooLong} is longer than ${MAX_LEN[tooLong]} characters` });
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
  const hasPhoto = [...mapping.values()].includes("photoUrl");
  const hasStudentPhone = [...mapping.values()].includes("studentPhone");
  const hasStatus = [...mapping.values()].includes("status");
  for (let i = 0; i < records.length; i += 500) {
    const chunk = records.slice(i, i + 500);
    const values = chunk.map(
      (r) =>
        Prisma.sql`(${r.rollNo}, ${r.fullName}, ${r.fatherName}, ${r.program}, ${r.section}, ${r.studentPhone}, ${r.parentPhone}, ${r.photoUrl}, ${r.status}::"StudentStatus", now(), now())`,
    );
    await prisma.$executeRaw`
      INSERT INTO students (roll_no, full_name, father_name, program, section, student_phone, parent_phone, photo_url, status, created_at, updated_at)
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
