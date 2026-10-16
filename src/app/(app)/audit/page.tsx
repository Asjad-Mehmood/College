import type { Metadata } from "next";
import { Suspense } from "react";
import { Search, UserX } from "lucide-react";
import { Card, EmptyState, Input, PageHeader, Skeleton } from "@/components/ui";
import { FilterForm } from "@/components/filter-form";
import { requireUser } from "@/lib/auth";
import { STUDENT_STATUS_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
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
  const students = await prisma.student.findMany({
    where: q
      ? {
          OR: [
            { rollNo: { contains: q, mode: "insensitive" } },
            { fullName: { contains: q, mode: "insensitive" } },
            { fatherName: { contains: q, mode: "insensitive" } },
            ...(digits.length >= 4 ? [{ parentPhone: { contains: digits } }, { studentPhone: { contains: digits } }] : []),
          ],
        }
      : {},
    orderBy: q ? { rollNo: "asc" } : { updatedAt: "desc" },
    take: 40,
    select: { rollNo: true, fullName: true, fatherName: true, program: true, section: true, photoUrl: true, status: true },
  });

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <FilterForm action="/audit">
          <div className="relative">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input type="search" name="q" defaultValue={q} autoFocus placeholder="Roll no. (even last digits), name, father's name or phone" aria-label="Search students" className="pl-10" />
          </div>
        </FilterForm>
      </Card>
      <Card className="overflow-hidden">
        <p className="border-b border-line px-5 py-3 text-[13px] text-ink-2">
          {q ? (
            <>
              <span className="font-semibold text-ink tabular">{students.length}</span> {students.length === 40 ? "or more " : ""}matches — click a student for the full audit
            </>
          ) : (
            "Recently updated students — search to find anyone"
          )}
        </p>
        {students.length === 0 ? (
          <EmptyState icon={<UserX className="size-5" />} title="No students found">
            Try a different name or roll number.
          </EmptyState>
        ) : (
          <AuditList rows={students.map((s) => ({ ...s, status: STUDENT_STATUS_LABELS[s.status] }))} />
        )}
      </Card>
    </div>
  );
}
