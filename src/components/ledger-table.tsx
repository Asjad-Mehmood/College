import Link from "next/link";
import { Ticket } from "lucide-react";
import { RecordManager } from "@/components/record-manager";
import { Avatar, Pill, StrikeBadge, Table, Td, Th, buttonClass } from "@/components/ui";
import { ACTION_LABELS, REASON_LABELS } from "@/lib/labels";
import type { LedgerRow } from "@/lib/records";
import type { Settings } from "@/lib/settings";
import { ordinal, strikeLevel } from "@/lib/strikes";
import { formatDate, formatTime } from "@/lib/time";

/** Late-arrival rows, shared by the search view and the day view. */
export function LedgerTable({
  rows,
  settings,
  manage,
  showDate = true,
}: {
  rows: LedgerRow[];
  settings: Settings;
  manage: boolean;
  showDate?: boolean;
}) {
  return (
    <Table>
      <thead>
        <tr>
          <Th>Student</Th>
          <Th>Class</Th>
          <Th>{showDate ? "Date & arrival" : "Arrival"}</Th>
          <Th>This month</Th>
          <Th>Reason / action</Th>
          <Th>Fine</Th>
          <Th className="no-print text-right">
            <span className="sr-only">Actions</span>
          </Th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id} className="hover:bg-surface-2/50">
            <Td>
              <Link href={`/students/${encodeURIComponent(r.rollNo)}`} className="group flex items-center gap-3">
                <span className="no-print">
                  <Avatar name={r.fullName} photoUrl={r.photoUrl} size="sm" />
                </span>
                <span>
                  <span className="block font-medium group-hover:underline">{r.fullName}</span>
                  <span className="block font-mono text-[12px] text-muted">{r.rollNo}</span>
                </span>
              </Link>
            </Td>
            <Td>
              <span className="block">{r.program}</span>
              <span className="block text-[12px] text-muted">{r.section}</span>
            </Td>
            <Td className="whitespace-nowrap">
              {showDate ? (
                <>
                  <span className="block">{formatDate(r.lateDate)}</span>
                  <span className="block text-[12px] text-muted tabular">
                    {formatTime(r.arrivedAt, settings.timezone)} · {r.minutesLate} min late
                  </span>
                </>
              ) : (
                <>
                  <span className="block tabular">{formatTime(r.arrivedAt, settings.timezone)}</span>
                  <span className="block text-[12px] text-muted tabular">{r.minutesLate} min late</span>
                </>
              )}
            </Td>
            <Td>
              <StrikeBadge level={strikeLevel(r.strikeNo, settings)} label={`${ordinal(r.strikeNo)} time`} />
            </Td>
            <Td>
              <span className="block">{REASON_LABELS[r.reason]}</span>
              <span className="block text-[12px] text-muted">{ACTION_LABELS[r.actionTaken]}</span>
            </Td>
            <Td>
              {r.fineAmount > 0 ? (
                <Pill tone={r.finePaid ? "good" : "critical"}>
                  Rs. {r.fineAmount} · {r.finePaid ? "Paid" : "Unpaid"}
                </Pill>
              ) : (
                <span className="text-muted">—</span>
              )}
            </Td>
            <Td className="no-print">
              <div className="flex justify-end gap-1.5">
                <a href={`/pass/${r.id}`} target="_blank" rel="noreferrer" className={buttonClass("ghost", "sm")} title="Print gate pass">
                  <Ticket className="size-3.5" aria-hidden />
                  <span className="sr-only">Gate pass</span>
                </a>
                {manage && (
                  <RecordManager
                    compact
                    record={{
                      id: r.id,
                      fullName: r.fullName,
                      dateLabel: formatDate(r.lateDate),
                      reason: r.reason,
                      actionTaken: r.actionTaken,
                      fineAmount: r.fineAmount,
                      finePaid: r.finePaid,
                      remarks: r.remarks,
                    }}
                  />
                )}
              </div>
            </Td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
}
