import type { Metadata } from "next";
import { Suspense } from "react";
import { ScanSearch, Search, UserX } from "lucide-react";
import { Card, EmptyState, Input, PageHeader, Skeleton } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { requireUser } from "@/lib/auth";
import { STUDENT_STATUS_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { resolveRoll } from "@/lib/student-lookup";
import { AuditList } from "./audit-list";

export const metadata: Metadata = { title: "Audit" };

export default function AuditPage(props: PageProps<"/audit">) {
  return (
    <div>
      <PageHeader
        title="General audit"
        description="Search any student and open their complete record: details, lates, violations, fines, trips and sports."
      />
      <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Content({ searchParams }: { searchParams: PageProps<"/audit">["searchParams"] }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const sp = await searchParams;
  const q = (typeof sp.q === "string" ? sp.q.trim() : "").slice(0, 100);
  const digits = q.replace(/\D/g, "");
  // Nothing is loaded until something is searched.
  const [students, exact] = q
    ? await Promise.all([
        prisma.student.findMany({
          where: {
            OR: [
              { rollNo: { contains: q, mode: "insensitive" } },
              { fullName: { contains: q, mode: "insensitive" } },
              { fatherName: { contains: q, mode: "insensitive" } },
              ...(digits.length >= 4 ? [{ parentPhone: { contains: digits } }, { studentPhone: { contains: digits } }] : []),
            ],
          },
          orderBy: { rollNo: "asc" },
          take: 40,
          select: { rollNo: true, fullName: true, fatherName: true, program: true, section: true, photoUrl: true, status: true },
        }),
        resolveRoll(q),
      ])
    : [[], null];
  const autoOpen = exact ?? (students.length === 1 ? students[0].rollNo : undefined);

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <FilterForm action="/audit">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input
              type="search"
              name="q"
              defaultValue={q}
              autoFocus
              placeholder="Roll no. (even last digits), name, father's name or phone"
              aria-label="Search students"
              className="h-12 pl-10 text-base"
            />
          </div>
        </FilterForm>
      </Card>
      {!q ? (
        <Card>
          <EmptyState icon={<ScanSearch className="size-5" />} title="Search for a student">
            Type a roll number, name, father&apos;s name or phone above. An exact roll number opens the full audit straight away.
          </EmptyState>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <p className="border-b border-line px-5 py-3 text-[13px] text-ink-2">
            <span className="font-semibold text-ink tabular">{students.length}</span> {students.length === 40 ? "or more " : ""}
            {students.length === 1 ? "match" : "matches"} for “{q}” — click a student to open the full audit
          </p>
          {students.length === 0 ? (
            <EmptyState icon={<UserX className="size-5" />} title="No students found">
              Try a different name or roll number.
            </EmptyState>
          ) : (
            <AuditList key={q} autoOpen={autoOpen} rows={students.map((s) => ({ ...s, status: STUDENT_STATUS_LABELS[s.status] }))} />
          )}
        </Card>
      )}
    </div>
  );
}
