import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSettings } from "@/lib/settings";
import { fromDbDate, localParts } from "@/lib/time";
import { getViolationTypes } from "@/lib/violations";
import { ViolationForm } from "../../violation-form";

export const metadata: Metadata = { title: "Edit violation" };

export default function EditViolationPage(props: PageProps<"/violations/[id]/edit">) {
  return (
    <div className="mx-auto max-w-3xl">
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Edit params={props.params} />
      </Suspense>
    </div>
  );
}

async function Edit({ params }: { params: PageProps<"/violations/[id]/edit">["params"] }) {
  await requireUser(["ADMIN"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [violation, settings, types] = await Promise.all([
    prisma.violation.findUnique({ where: { id }, include: { student: true } }),
    getSettings(),
    getViolationTypes(),
  ]);
  if (!violation) notFound();
  const s = violation.student;
  const others = violation.incidentGroup
    ? await prisma.violation.findMany({ where: { incidentGroup: violation.incidentGroup, id: { not: id } }, include: { student: { select: { fullName: true } } } })
    : [];
  return (
    <>
      <Link href={`/violations/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Case #{id}
      </Link>
      <PageHeader
        title="Edit violation"
        description={others.length ? `Shared case: changes also apply to ${others.map((o) => o.student.fullName).join(", ")}.` : undefined}
      />
      <ViolationForm
        mode="edit"
        violationId={id}
        today={localParts(new Date(), settings.timezone).date}
        types={types.map((t) => ({ id: t.id, name: t.name, severity: t.severity, defaultFineAmount: t.defaultFineAmount, active: t.active }))}
        student={{ rollNo: s.rollNo, fullName: s.fullName, program: s.program, section: s.section, photoUrl: s.photoUrl }}
        initial={{
          typeId: violation.typeId,
          incidentDate: fromDbDate(violation.incidentDate),
          incidentTime: violation.incidentTime ?? "",
          location: violation.location ?? "",
          description: violation.description,
          reportedBy: violation.reportedBy ?? "",
          actionTaken: violation.actionTaken,
          suspensionDays: violation.suspensionDays,
          fineAmount: Number(violation.fineAmount),
        }}
      />
    </>
  );
}
