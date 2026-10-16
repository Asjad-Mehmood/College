import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { localParts } from "@/lib/time";
import { getViolationTypes } from "@/lib/violations";
import { ViolationForm } from "../violation-form";

export const metadata: Metadata = { title: "Record violation" };

export default function NewViolationPage(props: PageProps<"/violations/new">) {
  return (
    <div className="mx-auto max-w-3xl">
      <PageHeader title="Record a violation" description="Log a discipline violation reported by staff." />
      <Suspense fallback={<Skeleton className="h-40 rounded-2xl" />}>
        <Form searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Form({ searchParams }: { searchParams: PageProps<"/violations/new">["searchParams"] }) {
  await requireUser(["ADMIN"]);
  const roll = (await searchParams).roll;
  const [settings, types] = await Promise.all([getSettings(), getViolationTypes({ activeOnly: true })]);
  const today = localParts(new Date(), settings.timezone).date;
  return (
    <ViolationForm
      mode="create"
      today={today}
      initialRoll={typeof roll === "string" ? roll.slice(0, 20) : undefined}
      types={types.map((t) => ({ id: t.id, name: t.name, severity: t.severity, defaultFineAmount: t.defaultFineAmount, active: t.active }))}
    />
  );
}
