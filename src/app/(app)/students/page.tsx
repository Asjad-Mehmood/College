import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Upload, UserX } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { StudentStatus } from "@/generated/prisma/enums";
import { FilterForm } from "@/components/filter-form";
import { StudentDialog } from "@/components/student-dialog";
import {
  Avatar,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Pill,
  Select,
  Skeleton,
  StrikeBadge,
  Table,
  Td,
  Th,
  buttonClass,
} from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { STUDENT_STATUS_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getClassOptions } from "@/lib/records";
import { getSettings } from "@/lib/settings";
import { strikeLevel } from "@/lib/strikes";
import { localParts, monthStart, nextMonthStart, toDbDate } from "@/lib/time";

export const metadata: Metadata = { title: "Students" };

const PAGE_SIZE = 50;

export default function StudentsPage(props: PageProps<"/students">) {
  return (
    <div>
      <Suspense
        fallback={
          <PageHeader title="Students" description="Every student imported for this session." />
        }
      >
        <Header />
      </Suspense>
      <Suspense
        fallback={
          <div className="flex flex-col gap-4">
            <Skeleton className="h-16 rounded-2xl" />
            <Skeleton className="h-[480px] rounded-2xl" />
          </div>
        }
      >
        <StudentList searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Header() {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const { programs } = await getClassOptions();
  return (
    <PageHeader
      title="Students"
      description="Every student imported for this session."
      actions={
        can.administer(user.role) && (
          <>
            <Link href="/settings#import" className={buttonClass("secondary")}>
              <Upload className="size-4" aria-hidden /> Bulk import
            </Link>
            <StudentDialog programs={programs} />
          </>
        )
      }
    />
  );
}

async function StudentList({ searchParams }: { searchParams: PageProps<"/students">["searchParams"] }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const sp = await searchParams;
  const str = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string).trim() : "");
  const q = str("q").slice(0, 100);
  const program = str("program");
  const section = str("section");
  const status = (["ACTIVE", "STRUCK_OFF", "GRADUATED", "ALL"].includes(str("status")) ? str("status") : "ACTIVE") as
    | StudentStatus
    | "ALL";
  const page = Math.max(1, Number.parseInt(str("page"), 10) || 1);

  const settings = await getSettings();
  const today = localParts(new Date(), settings.timezone).date;
  const monthWhere = { lateDate: { gte: toDbDate(monthStart(today)), lt: toDbDate(nextMonthStart(today)) } };

  const digits = q.replace(/\D/g, "");
  const where: Prisma.StudentWhereInput = {
    ...(status !== "ALL" && { status }),
    ...(program && { program }),
    ...(section && { section }),
    ...(q && {
      OR: [
        { rollNo: { contains: q, mode: "insensitive" } },
        { fullName: { contains: q, mode: "insensitive" } },
        { fatherName: { contains: q, mode: "insensitive" } },
        ...(digits.length >= 4
          ? [{ parentPhone: { contains: digits } }, { studentPhone: { contains: digits } }]
          : []),
      ],
    }),
  };

  const [students, total, classes] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: [{ program: "asc" }, { section: "asc" }, { rollNo: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { lateRecords: { where: monthWhere } } } },
    }),
    prisma.student.count({ where }),
    getClassOptions(),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (program) qs.set("program", program);
    if (section) qs.set("section", section);
    if (status !== "ACTIVE") qs.set("status", status);
    if (p > 1) qs.set("page", String(p));
    return `/students?${qs}`;
  };

  return (
    <div className="flex flex-col gap-4">
      <Card className="p-4">
        <FilterForm action="/students" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <Input type="search" name="q" defaultValue={q} placeholder="Roll no., name, father's name or phone" aria-label="Search students" />
          <Select name="program" defaultValue={program} aria-label="Program">
            <option value="">All programs</option>
            {classes.programs.map((p) => (
              <option key={p}>{p}</option>
            ))}
          </Select>
          <Select name="section" defaultValue={section} aria-label="Section">
            <option value="">All sections</option>
            {classes.sections.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </Select>
          <Select name="status" defaultValue={status} aria-label="Status">
            <option value="ACTIVE">Active students</option>
            <option value="STRUCK_OFF">Struck off</option>
            <option value="GRADUATED">Graduated</option>
            <option value="ALL">All statuses</option>
          </Select>
        </FilterForm>
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between border-b border-line px-5 py-3 text-[13px] text-ink-2">
          <span>
            <span className="font-semibold text-ink tabular">{total.toLocaleString()}</span> {total === 1 ? "student" : "students"}
          </span>
          {pages > 1 && <span className="tabular">Page {page} of {pages}</span>}
        </div>
        {students.length === 0 ? (
          <EmptyState icon={<UserX className="size-5" />} title="No students found">
            {q || program || section ? "Try a different search or filter." : "Import the student list from Settings to get started."}
          </EmptyState>
        ) : (
          <Table>
            <thead>
              <tr>
                <Th>Student</Th>
                <Th>Father / guardian</Th>
                <Th>Class</Th>
                <Th>Parent phone</Th>
                <Th>This month</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {students.map((s) => {
                const count = s._count.lateRecords;
                return (
                  <tr key={s.rollNo} className="hover:bg-surface-2/50">
                    <Td>
                      <Link href={`/students/${encodeURIComponent(s.rollNo)}`} className="group flex items-center gap-3">
                        <Avatar name={s.fullName} photoUrl={s.photoUrl} size="sm" />
                        <span>
                          <span className="block font-medium group-hover:underline">{s.fullName}</span>
                          <span className="block font-mono text-[12px] text-muted">{s.rollNo}</span>
                        </span>
                      </Link>
                    </Td>
                    <Td>{s.fatherName}</Td>
                    <Td>
                      <span className="block">{s.program}</span>
                      <span className="block text-[12px] text-muted">{s.section}</span>
                    </Td>
                    <Td className="font-mono text-[13px]">{s.parentPhone}</Td>
                    <Td>
                      {count > 0 ? (
                        <StrikeBadge level={strikeLevel(count, settings)} label={`${count} late`} />
                      ) : (
                        <span className="text-muted">—</span>
                      )}
                    </Td>
                    <Td>
                      <Pill tone={s.status === "ACTIVE" ? "neutral" : "warning"}>{STUDENT_STATUS_LABELS[s.status]}</Pill>
                    </Td>
                  </tr>
                );
              })}
            </tbody>
          </Table>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-line px-5 py-3">
            {page > 1 ? (
              <ButtonLink size="sm" href={pageHref(page - 1)}>
                <ChevronLeft className="size-4" aria-hidden /> Previous
              </ButtonLink>
            ) : (
              <span />
            )}
            {page < pages && (
              <ButtonLink size="sm" href={pageHref(page + 1)}>
                Next <ChevronRight className="size-4" aria-hidden />
              </ButtonLink>
            )}
          </div>
        )}
      </Card>
    </div>
  );
}
