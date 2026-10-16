import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClassOptions } from "@/lib/records";
import { getSettings } from "@/lib/settings";
import { localParts } from "@/lib/time";
import { TripForm } from "../trip-form";

export const metadata: Metadata = { title: "Plan a trip" };

export default function NewTripPage() {
  return (
    <div className="mx-auto max-w-6xl">
      <PageHeader title="Plan a trip" description="Registration opens as soon as the trip is created." />
      <Suspense fallback={<Skeleton className="h-[600px] rounded-2xl" />}>
        <Form />
      </Suspense>
    </div>
  );
}

async function Form() {
  await requireUser(["ADMIN"]);
  const [{ programs }, settings, counts] = await Promise.all([
    getClassOptions(),
    getSettings(),
    prisma.student.groupBy({ by: ["program"], where: { status: "ACTIVE" }, _count: { _all: true } }),
  ]);
  return (
    <TripForm
      programs={programs}
      programCounts={Object.fromEntries(counts.map((c) => [c.program, c._count._all]))}
      today={localParts(new Date(), settings.timezone).date}
    />
  );
}
