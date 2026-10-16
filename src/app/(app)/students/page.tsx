import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { ArrowLeft, ChevronLeft, GraduationCap, ChevronRight, Download, LayoutGrid, List, MessageCircle, Printer, Upload, UserX } from "lucide-react";
import type { Prisma } from "@/generated/prisma/client";
import type { StudentStatus } from "@/generated/prisma/enums";
import { FilterForm } from "@/components/filter-form";
import { StudentDialog } from "@/components/student-dialog";
import { NewSectionDialog, ProgramsDialog, SectionSettings } from "./section-forms";
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
import { SHIFT_LABELS } from "@/lib/settings";

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
  const [{ programs }, sections, programRows, programCounts] = await Promise.all([
    getClassOptions(),
    getSectionOptions(),
    prisma.program.findMany({ orderBy: { name: "asc" } }),
    prisma.student.groupBy({ by: ["program"], _count: { _all: true } }),
  ]);
  const counts = new Map(programCounts.map((g) => [g.program, g._count._all]));
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
            <Link href="/students/promote" className={buttonClass("secondary")}>
              <GraduationCap className="size-4" aria-hidden /> End of session
            </Link>
            <ProgramsDialog programs={programRows.map((p) => ({ id: p.id, name: p.name, students: counts.get(p.name) ?? 0 }))} />
            <NewSectionDialog />
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
    { label: "By section", href: "/students", active: !list || (typeof sp.section === "string" && !sp.q), Icon: LayoutGrid },
    { label: "All students", href: "/students?view=all", active: list && !(typeof sp.section === "string" && !sp.q), Icon: List },
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
      {list ? <StudentList sp={sp} /> : <SectionsOverview
          year={sp.year === "FIRST" || sp.year === "SECOND" ? sp.year : ""}
          shift={sp.shift === "MORNING" || sp.shift === "EVENING" ? sp.shift : ""}
        />}
    </>
  );
}

async function SectionsOverview({ year, shift }: { year: string; shift: string }) {
  const user = await requireUser(["ADMIN", "PRINCIPAL"]);
  const [allSections, groups, inactive] = await Promise.all([
    getSectionOptions(),
    prisma.student.groupBy({ by: ["section", "program"], where: { status: "ACTIVE" }, _count: { _all: true } }),
    prisma.student.groupBy({ by: ["section"], where: { status: { not: "ACTIVE" } }, _count: { _all: true } }),
  ]);
  const info = new Map<string, { count: number; programs: Map<string, number> }>();
  for (const g of groups) {
    const entry = info.get(g.section) ?? { count: 0, programs: new Map<string, number>() };
    entry.count += g._count._all;
    entry.programs.set(g.program, (entry.programs.get(g.program) ?? 0) + g._count._all);
    info.set(g.section, entry);
  }
  const inactiveBy = new Map(inactive.map((g) => [g.section, g._count._all]));
  const sections = shift ? allSections.filter((x) => x.shift === shift) : allSections;
  const hasEvening = allSections.some((x) => x.shift === "EVENING");
  const countOf = (name: string) => info.get(name)?.count ?? 0;
  const total = sections.reduce((sum, x) => sum + countOf(x.name), 0);
  const firstYear = sections.filter((x) => x.year === "FIRST").reduce((sum, x) => sum + countOf(x.name), 0);
  const secondYear = sections.filter((x) => x.year === "SECOND").reduce((sum, x) => sum + countOf(x.name), 0);
  const largest = Math.max(1, ...sections.map((x) => countOf(x.name)));
  const avg = sections.length ? Math.round(total / sections.length) : 0;

  const link = (o: { year?: string; shift?: string }) => {
    const qs = new URLSearchParams();
    const y = o.year ?? year;
    const sh = o.shift ?? shift;
    if (y) qs.set("year", y);
    if (sh) qs.set("shift", sh);
    return qs.size ? `/students?${qs}` : "/students";
  };
  const yearTabs = [
    { key: "", label: "All years" },
    { key: "FIRST", label: "1st year" },
    { key: "SECOND", label: "2nd year" },
  ];
  const shiftTabs = [
    { key: "", label: "Both shifts" },
    { key: "MORNING", label: "Morning" },
    { key: "EVENING", label: "Evening" },
  ];
  const groupsByYear = [
    { key: "FIRST" as const, title: "1st year" },
    { key: "SECOND" as const, title: "2nd year" },
    { key: null, title: "Year not set" },
  ]
    .filter((g) => !year || g.key === year)
    .map((g) => ({ ...g, list: sections.filter((x) => x.year === g.key) }))
    .filter((g) => g.list.length > 0);

  const stats = [
    { label: "Active students", value: total.toLocaleString(), sub: `${sections.length} sections` },
    { label: "1st year", value: firstYear.toLocaleString(), sub: `${sections.filter((x) => x.year === "FIRST").length} sections` },
    { label: "2nd year", value: secondYear.toLocaleString(), sub: `${sections.filter((x) => x.year === "SECOND").length} sections` },
    { label: "Average class size", value: avg.toLocaleString(), sub: `${sections.filter((x) => !countOf(x.name)).length} empty sections` },
  ];

  if (allSections.length === 0) {
    return (
      <Card>
        <EmptyState icon={<UserX className="size-5" />} title="No sections yet">
          {can.administer(user.role) ? (
            <>
              Use <span className="font-medium text-ink">Add section</span> above (for example CD1, 1st year), then add students to it.
            </>
          ) : (
            "The Discipline In-Charge hasn't created any sections yet."
          )}
        </EmptyState>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stats.map((x) => (
          <Card key={x.label} className="px-4 py-3.5">
            <p className="text-[12px] text-muted">{x.label}</p>
            <p className="mt-0.5 text-2xl font-semibold tabular">{x.value}</p>
            <p className="text-[12px] text-muted">{x.sub}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
        {(hasEvening || shift) && (
          <div className="inline-flex gap-1 rounded-xl bg-surface-2 p-1">
            {shiftTabs.map((t) => (
              <Link
                key={t.key}
                href={link({ shift: t.key })}
                className={cx(
                  "rounded-lg px-3 py-1 text-[13px] font-medium",
                  shift === t.key ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink",
                )}
              >
                {t.label}
              </Link>
            ))}
          </div>
        )}
        <div className="inline-flex gap-1 rounded-xl bg-surface-2 p-1">
          {yearTabs.map((t) => (
            <Link
              key={t.key}
              href={link({ year: t.key })}
              className={cx(
                "rounded-lg px-3 py-1 text-[13px] font-medium",
                year === t.key ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink",
              )}
            >
              {t.label}
            </Link>
          ))}
        </div>
        </div>
        <ButtonLink size="sm" href="/api/export/students">
          <Download className="size-4" aria-hidden /> Export all (Excel)
        </ButtonLink>
      </div>

      {groupsByYear.map((g) => {
        const yearTotal = g.list.reduce((sum, x) => sum + countOf(x.name), 0);
        return (
          <section key={g.title}>
            <div className="mb-3 flex items-baseline gap-2 border-b border-line pb-2">
              <h2 className="text-base font-semibold">{g.title}</h2>
              <span className="text-[13px] text-muted tabular">
                {g.list.length} {g.list.length === 1 ? "section" : "sections"} · {yearTotal.toLocaleString()} students
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {g.list.map((sec) => {
                const i = info.get(sec.name);
                const count = i?.count ?? 0;
                const progs = [...(i?.programs ?? new Map<string, number>()).entries()].sort((x, y) => y[1] - x[1]);
                const off = inactiveBy.get(sec.name) ?? 0;
                return (
                  <Link key={sec.id} href={`/students?section=${encodeURIComponent(sec.name)}`} className="group">
                    <Card className="flex h-full flex-col p-4 transition-colors group-hover:border-accent/60">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-3">
                          <span className="flex size-10 items-center justify-center rounded-xl bg-accent-soft text-[13px] font-semibold text-accent-ink">
                            {sec.name.replace(/\s+/g, "").slice(0, 4)}
                          </span>
                          <div>
                            <p className="font-semibold tracking-tight group-hover:underline">Section {sec.name}</p>
                            <p className="text-[12px] text-muted">
                              {sec.year ? YEAR_LABELS[sec.year] : "Year not set"} · {SHIFT_LABELS[sec.shift]}
                            </p>
                          </div>
                        </div>
                        <ChevronRight className="size-4 text-muted transition-transform group-hover:translate-x-0.5" aria-hidden />
                      </div>
                      <div className="mt-4 flex items-baseline justify-between">
                        <p className="text-2xl font-semibold tabular">
                          {count} <span className="text-[12px] font-normal text-muted">students</span>
                        </p>
                        {off > 0 && <span className="text-[12px] text-muted">+{off} inactive</span>}
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                        <div className="h-full rounded-full bg-accent" style={{ width: `${(count / largest) * 100}%` }} />
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {progs.length === 0 ? (
                          <span className="text-[12px] text-muted">No students yet</span>
                        ) : (
                          progs.map(([name, n]) => (
                            <span key={name} className="rounded-md bg-surface-2 px-1.5 py-0.5 text-[11px] text-ink-2">
                              {name} <span className="tabular text-muted">{n}</span>
                            </span>
                          ))
                        )}
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </section>
        );
      })}
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

  const [students, total, classes, sectionRow, sectionOpts] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: section ? [{ rollNo: "asc" }] : [{ program: "asc" }, { section: "asc" }, { rollNo: "asc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.student.count({ where }),
    getClassOptions(),
    section ? prisma.section.findUnique({ where: { name: section } }) : null,
    getSectionOptions(),
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
      {section && !q && (
        <SectionHeader
          section={section}
          sectionRow={sectionRow}
          sectionOpts={sectionOpts}
          programs={classes.programs}
          program={program}
          status={status}
          admin={can.administer(user.role)}
        />
      )}
      {section && !q ? (
        <Card className="p-4">
          <FilterForm action="/students">
            <input type="hidden" name="view" value="all" />
            <input type="hidden" name="section" value={section} />
            <Input type="search" name="q" placeholder={`Search in ${section}: roll no., name, father's name or phone`} aria-label={`Search in section ${section}`} />
          </FilterForm>
        </Card>
      ) : (
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
      )}

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
                <Th className="w-10">#</Th>
                <Th>Student</Th>
                <Th>Father / guardian</Th>
                <Th>Class</Th>
                <Th>Parent phone</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {students.map((s, idx) => {
                return (
                  <tr key={s.rollNo} className="hover:bg-surface-2/50">
                    <Td className="text-[12px] text-muted tabular">{(page - 1) * PAGE_SIZE + idx + 1}</Td>
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
                    <Td>
                      <span className="flex items-center gap-2">
                        <a href={`tel:${s.parentPhone}`} className="font-mono text-[13px] hover:underline">
                          {s.parentPhone}
                        </a>
                        <a
                          href={`https://wa.me/${s.parentPhone.replace(/\D/g, "").replace(/^0/, "92")}`}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-md p-1 text-muted hover:bg-surface-2 hover:text-ink"
                          aria-label={`WhatsApp ${s.fullName}'s parent`}
                        >
                          <MessageCircle className="size-3.5" aria-hidden />
                        </a>
                      </span>
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

async function SectionHeader({
  section,
  sectionRow,
  sectionOpts,
  programs,
  program,
  status,
  admin,
}: {
  section: string;
  sectionRow: { id: number; name: string; year: "FIRST" | "SECOND" | null; shift: "MORNING" | "EVENING" } | null;
  sectionOpts: { name: string; year: "FIRST" | "SECOND" | null }[];
  programs: string[];
  program: string;
  status: string;
  admin: boolean;
}) {
  const groups = await prisma.student.groupBy({ by: ["program", "status"], where: { section }, _count: { _all: true } });
  const byStatus = (st: string) => groups.filter((g) => g.status === st).reduce((a, g) => a + g._count._all, 0);
  const all = groups.reduce((a, g) => a + g._count._all, 0);
  const active = byStatus("ACTIVE");
  const progCounts = new Map<string, number>();
  for (const g of groups) if (g.status === "ACTIVE") progCounts.set(g.program, (progCounts.get(g.program) ?? 0) + g._count._all);
  const idx = sectionOpts.findIndex((x) => x.name === section);
  const prev = idx > 0 ? sectionOpts[idx - 1] : null;
  const next = idx >= 0 && idx < sectionOpts.length - 1 ? sectionOpts[idx + 1] : null;
  const href = (o: { program?: string; status?: string }) => {
    const qs = new URLSearchParams({ section });
    const pr = o.program ?? program;
    const st = o.status ?? status;
    if (pr) qs.set("program", pr);
    if (st !== "ACTIVE") qs.set("status", st);
    return `/students?${qs}`;
  };
  const statusTabs = [
    { key: "ACTIVE", label: "Active", n: active },
    { key: "STRUCK_OFF", label: "Struck off", n: byStatus("STRUCK_OFF") },
    { key: "GRADUATED", label: "Graduated", n: byStatus("GRADUATED") },
    { key: "ALL", label: "All", n: all },
  ];
  const enc = encodeURIComponent(section);

  return (
    <Card className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface-2/40 px-5 py-2.5 text-[13px]">
        <Link href={sectionRow?.year ? `/students?year=${sectionRow.year}` : "/students"} className="inline-flex items-center gap-1.5 font-medium text-ink-2 hover:text-ink">
          <ArrowLeft className="size-4" aria-hidden /> All sections
        </Link>
        <div className="flex items-center gap-1">
          {prev && (
            <Link href={`/students?section=${encodeURIComponent(prev.name)}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink">
              <ChevronLeft className="size-4" aria-hidden /> {prev.name}
            </Link>
          )}
          {next && (
            <Link href={`/students?section=${encodeURIComponent(next.name)}`} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-ink-2 hover:bg-surface-2 hover:text-ink">
              {next.name} <ChevronRight className="size-4" aria-hidden />
            </Link>
          )}
        </div>
      </div>
      <div className="p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <span className="flex size-14 items-center justify-center rounded-2xl bg-accent-soft text-base font-semibold text-accent-ink">
              {section.replace(/\s+/g, "").slice(0, 4)}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-2xl font-semibold tracking-tight">Section {section}</h2>
                <Pill tone={sectionRow?.year ? "accent" : "neutral"}>{sectionRow?.year ? YEAR_LABELS[sectionRow.year] : "Year not set"}</Pill>
                {sectionRow && <Pill tone={sectionRow.shift === "EVENING" ? "warning" : "neutral"}>{SHIFT_LABELS[sectionRow.shift]} shift</Pill>}
              </div>
              <p className="mt-0.5 text-[13px] text-ink-2">
                <span className="font-semibold text-ink tabular">{active}</span> active students
                {all > active && ` · ${all - active} inactive`}
                {progCounts.size > 0 && ` · ${progCounts.size} ${progCounts.size === 1 ? "program" : "programs"}`}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {admin && <StudentDialog programs={programs} sections={sectionOpts} defaultSection={section} />}
            <a href={`/class-list/${enc}`} target="_blank" rel="noreferrer" className={buttonClass("secondary")}>
              <Printer className="size-4" aria-hidden /> Class list
            </a>
            <a href={`/api/export/students?section=${enc}${status !== "ACTIVE" ? `&status=${status}` : ""}`} className={buttonClass("secondary")}>
              <Download className="size-4" aria-hidden /> Excel
            </a>
            {admin && sectionRow && <SectionSettings id={sectionRow.id} name={sectionRow.name} year={sectionRow.year} shift={sectionRow.shift} students={all} />}
          </div>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <Link
              href={href({ program: "" })}
              className={cx("rounded-full border px-3 py-1 text-[13px]", !program ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-2")}
            >
              All programs <span className="tabular opacity-70">{active}</span>
            </Link>
            {[...progCounts.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => (
              <Link
                key={name}
                href={href({ program: name })}
                className={cx("rounded-full border px-3 py-1 text-[13px]", program === name ? "border-accent bg-accent-soft text-accent-ink" : "border-line text-ink-2 hover:bg-surface-2")}
              >
                {name} <span className="tabular opacity-70">{n}</span>
              </Link>
            ))}
          </div>
          <div className="inline-flex gap-1 rounded-xl bg-surface-2 p-1">
            {statusTabs.map((t) => (
              <Link
                key={t.key}
                href={href({ status: t.key })}
                className={cx("rounded-lg px-2.5 py-1 text-[12px] font-medium", status === t.key ? "bg-surface text-ink shadow-card" : "text-ink-2 hover:text-ink")}
              >
                {t.label} <span className="tabular opacity-70">{t.n}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Card>
  );
}
