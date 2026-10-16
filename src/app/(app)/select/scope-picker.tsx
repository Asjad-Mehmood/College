"use client";

import { useState, useTransition } from "react";
import { Archive, ArrowRight, CalendarRange, Check, Layers, Loader2, Users } from "lucide-react";
import { Button, Card, CardHeader, Pill, cx } from "@/components/ui";
import { chooseScope } from "./actions";

type Year = { id: number; name: string; label: string; closed: boolean };
type Batch = { id: number; name: string; startYear: number; endYear: number; passedOut: boolean; students: number };

export function ScopePicker({
  years,
  batches,
  currentYearId,
  currentBatchId,
  next,
}: {
  years: Year[];
  batches: Batch[];
  currentYearId: number;
  currentBatchId?: number;
  next?: string;
}) {
  const [yearId, setYearId] = useState(currentYearId);
  const [batchId, setBatchId] = useState<number>(currentBatchId ?? 0);
  const [pending, start] = useTransition();
  const year = years.find((y) => y.id === yearId);
  const startOf = year ? Number(year.name.slice(0, 4)) : 0;
  // Batches studying in the chosen year come first.
  const inYear = batches.filter((b) => b.startYear <= startOf && startOf < b.endYear);
  const others = batches.filter((b) => !inYear.includes(b));

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <CardHeader title="1. Academic year" />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          {years.map((y) => (
            <button
              key={y.id}
              type="button"
              onClick={() => setYearId(y.id)}
              aria-pressed={y.id === yearId}
              className={cx(
                "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
                y.id === yearId ? "border-accent bg-accent-soft/60 ring-2 ring-accent/25" : "border-line hover:bg-surface-2",
              )}
            >
              {y.closed ? <Archive className="mt-0.5 size-5 text-muted" aria-hidden /> : <CalendarRange className="mt-0.5 size-5 text-accent-ink" aria-hidden />}
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-semibold">
                  {y.name} {y.closed && <Pill>Archived</Pill>}
                </span>
                <span className="block text-[12px] text-muted">{y.label}</span>
              </span>
              {y.id === yearId && <Check className="size-5 text-accent-ink" aria-hidden />}
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardHeader title="2. Batch" description="Pick one batch, or all batches together." />
        <div className="grid gap-3 p-5 sm:grid-cols-2 lg:grid-cols-3">
          <BatchButton active={batchId === 0} onClick={() => setBatchId(0)} title="All batches" sub={`${batches.reduce((a, b) => a + b.students, 0)} students`} Icon={Layers} />
          {[...inYear, ...others].map((b) => (
            <BatchButton
              key={b.id}
              active={batchId === b.id}
              onClick={() => setBatchId(b.id)}
              title={b.name}
              sub={`${b.students} students${b.passedOut ? " · passed out" : inYear.includes(b) ? ` · ${startOf - b.startYear === 0 ? "1st" : "2nd"} year in ${year?.name}` : ""}`}
              Icon={Users}
              dim={!inYear.includes(b)}
            />
          ))}
        </div>
      </Card>

      <div className="flex justify-end">
        <Button variant="primary" size="lg" disabled={pending || !year} onClick={() => start(() => chooseScope(yearId, batchId || null, next))}>
          {pending ? <Loader2 className="size-4 animate-spin" aria-hidden /> : null}
          Open {year?.name} · {batchId ? batches.find((b) => b.id === batchId)?.name : "All batches"} <ArrowRight className="size-4" aria-hidden />
        </Button>
      </div>
    </div>
  );
}

function BatchButton({ active, onClick, title, sub, Icon, dim }: { active: boolean; onClick: () => void; title: string; sub: string; Icon: typeof Users; dim?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "flex items-start gap-3 rounded-xl border p-4 text-left transition-colors",
        active ? "border-accent bg-accent-soft/60 ring-2 ring-accent/25" : "border-line hover:bg-surface-2",
        dim && !active && "opacity-60",
      )}
    >
      <Icon className="mt-0.5 size-5 text-accent-ink" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block text-[12px] text-muted">{sub}</span>
      </span>
      {active && <Check className="size-5 text-accent-ink" aria-hidden />}
    </button>
  );
}
