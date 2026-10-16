import Link from "next/link";
import { Avatar, Pill, StrikeBadge, Table, Td, Th, buttonClass } from "@/components/ui";
import { SEVERITY_LABELS, SEVERITY_LEVEL, VIOLATION_ACTION_LABELS } from "@/lib/labels";
import { formatDate, fromDbDate } from "@/lib/time";
import type { ViolationRow } from "@/lib/violations";

/** Violation cases, shared by the search view and the day view. */
export function ViolationTable({ rows, manage = false }: { rows: ViolationRow[]; manage?: boolean }) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Case</Th>
          <Th>Student</Th>
          <Th>Violation</Th>
          <Th>Action / fine</Th>
          <Th>Status</Th>
          {manage && (
            <Th className="no-print text-right">
              <span className="sr-only">Manage</span>
            </Th>
          )}
        </tr>
      </thead>
      <tbody>
        {rows.map((v) => (
          <tr key={v.id} className="hover:bg-surface-2/50">
            <Td className="whitespace-nowrap">
              <Link href={`/violations/${v.id}`} className="font-medium hover:underline">
                #{v.id}
              </Link>
              <span className="block text-[12px] text-muted tabular">{formatDate(fromDbDate(v.incidentDate))}</span>
            </Td>
            <Td>
              <Link href={`/students/${encodeURIComponent(v.rollNo)}`} className="group flex items-center gap-3">
                <span className="no-print">
                  <Avatar name={v.student.fullName} photoUrl={v.student.photoUrl} size="sm" />
                </span>
                <span>
                  <span className="block font-medium group-hover:underline">{v.student.fullName}</span>
                  <span className="block text-[12px] text-muted">
                    <span className="font-mono">{v.rollNo}</span> · {v.student.program} {v.student.section}
                  </span>
                </span>
              </Link>
            </Td>
            <Td className="max-w-72">
              <span className="flex flex-wrap items-center gap-2">
                <Link href={`/violations/${v.id}`} className="font-medium hover:underline">
                  {v.type.name}
                </Link>
                <StrikeBadge level={SEVERITY_LEVEL[v.severity]} label={SEVERITY_LABELS[v.severity]} />
              </span>
              <span className="mt-0.5 block truncate text-[12px] text-muted" title={v.description}>
                {v.description}
              </span>
              {v.studentTotal > 1 && <span className="block text-[12px] text-danger-ink">{v.studentTotal} violations by this student</span>}
            </Td>
            <Td className="text-[13px]">
              <span className="block">
                {v.actionTaken === "SUSPENSION" ? `Suspension · ${v.suspensionDays} days` : VIOLATION_ACTION_LABELS[v.actionTaken]}
              </span>
              {v.fineAmount > 0 && (
                <span className="mt-1 block">
                  <Pill tone={v.finePaid ? "good" : "critical"}>
                    Rs. {v.fineAmount} · {v.finePaid ? "Paid" : "Unpaid"}
                  </Pill>
                </span>
              )}
            </Td>
            <Td>
              <Pill tone={v.status === "OPEN" ? "accent" : "neutral"}>{v.status === "OPEN" ? "Open" : "Closed"}</Pill>
            </Td>
            {manage && (
            <Td className="no-print text-right">
              <Link href={`/violations/${v.id}`} className={buttonClass(v.status === "OPEN" ? "primary" : "secondary", "sm")}>
                Manage
              </Link>
            </Td>
          )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
