import type { Metadata } from "next";
import { Suspense } from "react";
import { PrintToolbar } from "@/components/print-toolbar";
import { Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { YEAR_LABELS } from "@/lib/section-options";
import { getSettings } from "@/lib/settings";
import { formatDate, localParts } from "@/lib/time";

export const metadata: Metadata = { title: "Class list" };

export default function ClassListPage(props: PageProps<"/class-list/[section]">) {
  return (
    <>
      <PrintToolbar title="Class list" />
      <Suspense fallback={<Skeleton className="mx-auto mt-8 h-[800px] w-full max-w-[210mm] rounded-none" />}>
        <Sheet params={props.params} />
      </Suspense>
    </>
  );
}

async function Sheet({ params }: { params: PageProps<"/class-list/[section]">["params"] }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const section = decodeURIComponent((await params).section);
  const [students, row, settings] = await Promise.all([
    prisma.student.findMany({ where: { section, status: "ACTIVE" }, orderBy: { rollNo: "asc" } }),
    prisma.section.findUnique({ where: { name: section } }),
    getSettings(),
  ]);
  const programs = [...new Set(students.map((s) => s.program))].join(", ");
  const head = ["#", "Roll no.", "Name", "Father / guardian", "Program", "Parent phone", "Signature"];
  return (
    <div className="px-4 py-8 print:p-0">
      <style>{`@page { size: A4; margin: 12mm; }`}</style>
      <article className="mx-auto max-w-[210mm] bg-white p-[12mm] text-[13px] leading-relaxed text-black shadow-pop print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-black pb-2 text-center">
          <p className="text-lg font-bold tracking-tight uppercase">{settings.collegeName}</p>
          {settings.collegeAddress && <p className="text-[12px]">{settings.collegeAddress}</p>}
          <p className="mt-0.5 text-[12px] font-semibold tracking-[0.15em] uppercase">Class list</p>
        </header>
        <div className="mt-3 flex flex-wrap justify-between gap-2">
          <div>
            <p className="text-[15px] font-semibold">
              Section {section}
              {row?.year && ` · ${YEAR_LABELS[row.year]}`}
            </p>
            <p>{programs || "—"}</p>
          </div>
          <p className="text-right">
            Printed {formatDate(localParts(new Date(), settings.timezone).date)}
            <br />
            {students.length} students
          </p>
        </div>
        <table className="mt-3 w-full border-collapse text-[12px]">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={i} className="border border-black bg-neutral-100 px-1.5 py-1 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {students.map((s, i) => (
              <tr key={s.rollNo} className="break-inside-avoid">
                <td className="border border-black px-1.5 py-1">{i + 1}</td>
                <td className="border border-black px-1.5 py-1 font-mono">{s.rollNo}</td>
                <td className="border border-black px-1.5 py-1">{s.fullName}</td>
                <td className="border border-black px-1.5 py-1">{s.fatherName}</td>
                <td className="border border-black px-1.5 py-1">{s.program}</td>
                <td className="border border-black px-1.5 py-1 font-mono">{s.parentPhone}</td>
                <td className="w-28 border border-black" />
              </tr>
            ))}
          </tbody>
        </table>
      </article>
    </div>
  );
}
