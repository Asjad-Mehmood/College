import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getClassOptions } from "@/lib/records";
import { getSettings } from "@/lib/settings";
import { fromDbDate, localParts } from "@/lib/time";
import { TripForm } from "../../trip-form";

export const metadata: Metadata = { title: "Edit trip" };

export default function EditTripPage(props: PageProps<"/trips/[id]/edit">) {
  return (
    <div className="mx-auto max-w-4xl">
      <Suspense fallback={<Skeleton className="h-[600px] rounded-2xl" />}>
        <Edit params={props.params} />
      </Suspense>
    </div>
  );
}

async function Edit({ params }: { params: PageProps<"/trips/[id]/edit">["params"] }) {
  await requireUser(["ADMIN"]);
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [trip, { programs }, settings] = await Promise.all([
    prisma.trip.findUnique({ where: { id } }),
    getClassOptions(),
    getSettings(),
  ]);
  if (!trip) notFound();
  const d = (x: Date | null) => (x ? fromDbDate(x) : "");
  return (
    <>
      <Link href={`/trips/${id}`} className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> {trip.title}
      </Link>
      <PageHeader title="Edit trip" />
      <TripForm
        today={localParts(new Date(), settings.timezone).date}
        programs={[...new Set([...programs, ...trip.programs])]}
        values={{
          id: trip.id,
          title: trip.title,
          type: trip.type,
          destination: trip.destination,
          purpose: trip.purpose ?? "",
          itinerary: trip.itinerary ?? "",
          departDate: d(trip.departDate),
          departTime: trip.departTime,
          returnDate: d(trip.returnDate),
          returnTime: trip.returnTime,
          meetingPoint: trip.meetingPoint ?? "",
          programs: trip.programs,
          seats: trip.seats?.toString() ?? "",
          feeAmount: Number(trip.feeAmount).toString(),
          feeDeadline: d(trip.feeDeadline),
          consentDeadline: d(trip.consentDeadline),
          inChargeName: trip.inChargeName,
          inChargePhone: trip.inChargePhone ?? "",
        }}
      />
    </>
  );
}
