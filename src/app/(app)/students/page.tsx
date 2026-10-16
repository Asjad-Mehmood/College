import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ChevronLeft, ChevronRight, LayoutGrid, List, Upload, UserX } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { StudentStatus } from "@/generated/prisma/enums";
import { FilterForm } from "@/components/filter-form";
import { StudentDialog } from "@/components/student-dialog";
import { NewSectionForm, SectionSettings } from "./section-forms";
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
  cx,
} from "@/components/ui";
import { can, requireUser } from "@/lib/auth";
import { STUDENT_STATUS_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { getClassOptions } from "@/lib/records";
import { YEAR_LABELS, getSectionOptions } from "@/lib/section-options";
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
        <Content searchParams={props.searchParams} />
      </Suspense>
    </div>
  );
}

async function Header() {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const [{ programs }, sections] = await Promise.all([getClassOptions(), getSectionOptions()]);
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
            <StudentDialog programs={programs} sections={sections} />
          </>
        )
      }
    />
  );
}

type SP = PageProps<"/students">["searchParams"];

async function Content({ searchParams }: { searchParams: SP }) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  const sp = await searchParams;
  // Sections overview unless the list is asked for or filtered (old links keep working).
  const list = sp.view === "all" || ["q", "program", "section", "status", "page"].some((k) => typeof sp[k] === "string");
  const tabs = [
    { label: "By section", href: "/students", active: !list, Icon: LayoutGrid },
    { label: "All students", href: "/students?view=all", active: list, Icon: List },
  ];
  return (
    <>
      <div className="mb-4 inline-flex rounded-xl border border-line bg-surface p-1 shadow-card" role="tablist">
        {tabs.map(({ label, href, active, Icon }) => (
          <Link
            key={label}
            href={href}
            role="tab"
            aria-selected={active}
            className={cx(
              "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
              active ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </Link>
        ))}
      </div>
      {list ? <StudentList sp={sp} /> : <SectionsOverview />}
    </>
  );
}

async function SectionsOverview() {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const settings = await getSettings();
  const today = localParts(new Date(), settings.timezone).date;
  const [sections, groups, lates] = await Promise.all([
    getSectionOptions(),
    prisma.student.groupBy({ by: ["section", "program"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.$queryRaw<{ section: string; lates: bigint }[]>`
      SELECT s.section, COUNT(*) AS lates
      FROM late_records r JOIN students s ON s.roll_no = r.roll_no
      WHERE r.late_date >= ${toDbDate(monthStart(today))} AND r.late_date <= ${toDbDate(today)}
      GROUP BY s.section
    `,
  ]);
  const latesBySection = new Map(lates.map((l) => [l.section, Number(l.lates)]));
  const info = new Map<string, { count: number; programs: string[] }>();
  for (const g of groups) {
    const entry = info.get(g.section) ?? { count: 0, programs: [] };
    entry.count += g._count._all;
    entry.programs.push(g.program);
    info.set(g.section, entry);
  }
  const total = [...info.values()].reduce((sum, v) => sum + v.count, 0);
  const groupsByYear = [
    { key: "FIRST" as const, title: "1st year" },
    { key: "SECOND" as const, title: "2nd year" },
    { key: null, title: "Year not set" },
  ]
    .map((g) => ({ ...g, list: sections.filter((x) => x.year === g.key) }))
    .filter((g) => g.list.length > 0);

  return (
    <div className="flex flex-col gap-5">
      {can.administer(user.role) && <NewSectionForm />}
      {sections.length === 0 ? (
        <Card>
          <EmptyState icon={<UserX className="size-5" />} title="No sections yet">
            Add your first section above (for example CD1, 1st year), then add students to it.
          </EmptyState>
        </Card>
      ) : (
        <>
          <p className="text-[13px] text-ink-2">
            <span className="font-semibold text-ink tabular">{total.toLocaleString()}</span> active students in{" "}
            <span className="font-semibold text-ink tabular">{sections.length}</span> sections
          </p>
          {groupsByYear.map((g) => (
            <section key={g.title}>
              <h2 className="mb-3 text-[13px] font-semibold tracking-wide text-muted uppercase">{g.title}</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {g.list.map((sec) => {
                  const i = info.get(sec.name);
                  const late = latesBySection.get(sec.name) ?? 0;
                  return (
                    <Link key={sec.id} href={`/students?section=${encodeURIComponent(sec.name)}`} className="group">
                      <Card className="h-full p-4 transition-colors group-hover:border-line-strong">
                        <p className="text-lg font-semibold tracking-tight group-hover:underline">{sec.name}</p>
                        <p className="mt-0.5 truncate text-[12px] text-muted" title={i?.programs.join(", ")}>
                          {i?.programs.join(", ") || "No students yet"}
                        </p>
                        <p className="mt-3 text-2xl font-semibold tabular">{i?.count ?? 0}</p>
                        <p className="text-[12px] text-muted">students</p>
                        {late > 0 && (
                          <p className="mt-2 text-[12px] text-ink-2">
                            <span className="font-medium tabular">{late}</span> late this month
                          </p>
                        )}
                      </Card>
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

async function StudentList({ sp }: { sp: Awaited<SP> }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
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

  const [students, total, classes, sectionRow] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: [{ program: "asc" }, { section: "asc" }, { rollNo: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: { _count: { select: { lateRecords: { where: monthWhere } } } },
    }),
    prisma.student.count({ where }),
    getClassOptions(),
    section ? prisma.section.findUnique({ where: { name: section } }) : null,
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    if (q) qs.set("q", q);
    if (program) qs.set("program", program);
    if (section) qs.set("section", section);
    if (status !== "ACTIVE") qs.set("status", status);
    if (p > 1) qs.set("page", String(p));
    qs.set("view", "all");
    return `/students?${qs}`;
  };

  return (
    <div className="flex flex-col gap-4">
      {section && !q && !program && (
        <div className="flex flex-wrap items-center gap-3">
          <Link href="/students" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-2 hover:text-ink">
            <ArrowLeft className="size-4" aria-hidden /> All sections
          </Link>
          <h2 className="text-lg font-semibold">Section {section}</h2>
          {sectionRow?.year && <Pill>{YEAR_LABELS[sectionRow.year]}</Pill>}
          {sectionRow && can.administer(user.role) && <SectionSettings id={sectionRow.id} name={sectionRow.name} year={sectionRow.year} students={total} />}
        </div>
      )}
      <Card className="p-4">
        <FilterForm action="/students" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
          <input type="hidden" name="view" value="all" />
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
