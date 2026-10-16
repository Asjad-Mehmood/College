import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ArrowRight, GraduationCap } from "lucide-react";
import { Card, CardHeader, PageHeader, Skeleton } from "@/components/ui";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getSectionOptions } from "@/lib/section-options";
import { PromoteForm } from "./promote-form";

export const metadata: Metadata = { title: "Promote students" };

export default function PromotePage() {
  return (
    <div className="mx-auto max-w-4xl">
      <Link href="/students" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
        <ArrowLeft className="size-4" aria-hidden /> Students
      </Link>
      <PageHeader title="End of session: promote students" description="Move every class up a year in one step." />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Preview />
      </Suspense>
    </div>
  );
}

async function Preview() {
  await requireUser(["ADMIN"]);
  const [sections, counts] = await Promise.all([
    getSectionOptions(),
    prisma.student.groupBy({ by: ["section"], where: { status: "ACTIVE" }, _count: { _all: true } }),
  ]);
  const n = new Map(counts.map((c) => [c.section, c._count._all]));
  const first = sections.filter((s) => s.year === "FIRST");
  const second = sections.filter((s) => s.year === "SECOND");
  const noYear = sections.filter((s) => !s.year);
  const sum = (list: typeof sections) => list.reduce((a, s) => a + (n.get(s.name) ?? 0), 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 md:grid-cols-[1fr_auto_1fr] md:items-stretch">
        <Card>
          <CardHeader title="2nd year → Graduated" description={`${sum(second)} students in ${second.length} sections`} />
          <Chips list={second} n={n} />
        </Card>
        <div className="hidden items-center md:flex">
          <GraduationCap className="size-6 text-muted" aria-hidden />
        </div>
        <Card>
          <CardHeader title="1st year → 2nd year" description={`${sum(first)} students in ${first.length} sections keep their section`} />
          <Chips list={first} n={n} />
        </Card>
      </div>
      {noYear.length > 0 && (
        <p className="rounded-xl bg-warning/12 px-4 py-3 text-[13px] ring-1 ring-warning/40 ring-inset">
          {noYear.length} sections have no year set ({noYear.map((s) => s.name).join(", ")}) and won&apos;t change. Set their year on the
          section page first if they should move.
        </p>
      )}
      <Card>
        <CardHeader title="What happens" />
        <ol className="flex flex-col gap-2 px-5 py-4 text-sm">
          <li className="flex gap-2">
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden />
            <span>
              Active students in 2nd-year sections are marked <b>Graduated</b>. Their records (lates, violations, trips, sports) are kept.
            </span>
          </li>
          <li className="flex gap-2">
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /> 1st-year sections become 2nd-year sections; their students
            stay in the same section.
          </li>
          <li className="flex gap-2">
            <ArrowRight className="mt-0.5 size-4 shrink-0 text-muted" aria-hidden /> The emptied 2nd-year sections can be reused for the new 1st
            year, then import the new students into them.
          </li>
        </ol>
        <div className="border-t border-line p-5">
          <PromoteForm />
        </div>
      </Card>
    </div>
  );
}

function Chips({ list, n }: { list: { name: string }[]; n: Map<string, number> }) {
  if (list.length === 0) return <p className="px-5 py-4 text-[13px] text-muted">No sections.</p>;
  return (
    <div className="flex flex-wrap gap-1.5 px-5 py-4">
      {list.map((s) => (
        <span key={s.name} className="rounded-md bg-surface-2 px-2 py-1 text-[13px]">
          {s.name} <span className="text-muted tabular">{n.get(s.name) ?? 0}</span>
        </span>
      ))}
    </div>
  );
}
