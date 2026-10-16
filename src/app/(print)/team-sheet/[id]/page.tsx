import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PrintToolbar } from "@/components/print-toolbar";
import { Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { formatDate, localParts } from "@/lib/time";

export const metadata: Metadata = { title: "Team sheet" };

export default function TeamSheetPage(props: PageProps<"/team-sheet/[id]">) {
  return (
    <>
      <PrintToolbar title="Team sheet" />
      <Suspense fallback={<Skeleton className="mx-auto mt-8 h-[800px] w-full max-w-[210mm] rounded-none" />}>
        <Sheet params={props.params} />
      </Suspense>
    </>
  );
}

async function Sheet({ params }: { params: PageProps<"/team-sheet/[id]">["params"] }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [team, settings] = await Promise.all([
    prisma.team.findUnique({
      where: { id },
      include: {
        sport: true,
        event: true,
        members: { where: { status: "SELECTED" }, include: { student: { select: { fullName: true, fatherName: true, section: true, parentPhone: true } } } },
      },
    }),
    getSettings(),
  ]);
  if (!team) notFound();
  const order = (r: string) => (r === "Captain" ? 0 : r === "Vice-captain" ? 1 : 2);
  const members = [...team.members].sort((a, b) => order(a.role) - order(b.role) || (a.jerseyNo ?? 999) - (b.jerseyNo ?? 999) || a.rollNo.localeCompare(b.rollNo));
  return (
    <div className="px-4 py-8 print:p-0">
      <style>{`@page { size: A4; margin: 14mm; }`}</style>
      <article className="mx-auto max-w-[210mm] bg-white p-[14mm] text-[13px] leading-relaxed text-black shadow-pop print:max-w-none print:p-0 print:shadow-none">
        <header className="border-b-2 border-black pb-2 text-center">
          <p className="text-lg font-bold tracking-tight uppercase">{settings.collegeName}</p>
          {settings.collegeAddress && <p className="text-[12px]">{settings.collegeAddress}</p>}
          <p className="mt-0.5 text-[12px] font-semibold tracking-[0.15em] uppercase">Team sheet</p>
        </header>
        <div className="mt-3 flex flex-wrap justify-between gap-2">
          <div>
            <p className="text-[15px] font-semibold">
              {team.sport.name}
            </p>
            <p>
              {team.event.name}
              {team.manager && ` · Manager: ${team.manager}`}
            </p>
          </div>
          <p className="text-right">
            Printed {formatDate(localParts(new Date(), settings.timezone).date)}
            <br />
            {members.length} players
          </p>
        </div>
        <table className="mt-3 w-full border-collapse text-[12px]">
          <thead>
            <tr>
              {["#", "Jersey", "Roll no.", "Name", "Father", "Section", "Role", "Position", "Contact"].map((h) => (
                <th key={h} className="border border-black bg-neutral-100 px-1.5 py-1 text-left font-semibold">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {members.map((m, i) => (
              <tr key={m.id} className="break-inside-avoid">
                <td className="border border-black px-1.5 py-1">{i + 1}</td>
                <td className="border border-black px-1.5 py-1">{m.jerseyNo ?? ""}</td>
                <td className="border border-black px-1.5 py-1 font-mono">{m.rollNo}</td>
                <td className="border border-black px-1.5 py-1">{m.student.fullName}</td>
                <td className="border border-black px-1.5 py-1">{m.student.fatherName}</td>
                <td className="border border-black px-1.5 py-1">{m.student.section}</td>
                <td className="border border-black px-1.5 py-1">{m.role === "Player" ? "" : m.role}</td>
                <td className="border border-black px-1.5 py-1">{m.position ?? ""}</td>
                <td className="border border-black px-1.5 py-1">{m.student.parentPhone}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-14 flex justify-between text-[12px]">
          {["Team manager", "Discipline In-Charge", "Principal"].map((s) => (
            <div key={s} className="text-center">
              <div className="mb-1 w-40 border-b border-black" />
              <p className="font-semibold">{s}</p>
            </div>
          ))}
        </div>
      </article>
    </div>
  );
}
