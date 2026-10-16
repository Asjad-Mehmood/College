import type { Metadata } from "next";
import { Suspense } from "react";
import { PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { formatDate } from "@/lib/time";
import { getScope } from "@/lib/scope";
import { ScopePicker } from "./scope-picker";

export const metadata: Metadata = { title: "Choose year and batch" };

export default function SelectPage(props: PageProps<"/select">) {
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader title="Choose year and batch" description="Everything in the portal will show only what you pick here. You can switch any time from the sidebar." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Picker searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Picker({ searchParams }: { searchParams: PageProps<"/select">["searchParams"] }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const sp = await searchParams;
  const s = await getScope();
  return (
    <ScopePicker
      next={typeof sp.next === "string" ? sp.next : undefined}
      currentYearId={s.year.id}
      currentBatchId={s.unset ? undefined : (s.batch?.id ?? 0)}
      years={s.years.map((y) => ({ ...y, label: `${formatDate(y.from)} – ${formatDate(y.to)}` }))}
      batches={s.batches}
    />
  );
}
