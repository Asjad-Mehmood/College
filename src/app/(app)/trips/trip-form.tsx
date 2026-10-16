"use client";

import Link from "next/link";
import { useState } from "react";
import { BedDouble, Banknote } from "lucide-react";
import type { TripType } from "@/generated/prisma/enums";
import { Button, Card, CardHeader, Field, FormMessage, Input, Select, Textarea, buttonClass, cx } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import { TRIP_TYPE_LABELS } from "@/lib/labels";
import { saveTrip } from "./actions";

export type TripValues = {
  id?: number;
  title: string;
  type: TripType;
  destination: string;
  purpose: string;
  itinerary: string;
  departDate: string;
  departTime: string;
  returnDate: string;
  returnTime: string;
  meetingPoint: string;
  programs: string[];
  seats: string;
  feeAmount: string;
  feeDeadline: string;
  consentDeadline: string;
  inChargeName: string;
  inChargePhone: string;
  overnight: boolean;
};

type Draft = {
  title: string;
  destination: string;
  departDate: string;
  departTime: string;
  returnDate: string;
  returnTime: string;
  overnight: boolean;
  programs: string[];
  seats: string;
  feeAmount: string;
  consentDeadline: string;
  feeDeadline: string;
};

function readDraft(form: HTMLFormElement): Draft {
  const fd = new FormData(form);
  const str = (k: string) => String(fd.get(k) ?? "");
  return {
    title: str("title"),
    destination: str("destination"),
    departDate: str("departDate"),
    departTime: str("departTime"),
    returnDate: str("returnDate"),
    returnTime: str("returnTime"),
    overnight: fd.get("overnight") === "on",
    programs: fd.getAll("programs").map(String),
    seats: str("seats"),
    feeAmount: fd.get("hasFee") ? str("feeAmount") : "",
    consentDeadline: str("consentDeadline"),
    feeDeadline: str("feeDeadline"),
  };
}

export function TripForm({
  values,
  programs,
  programCounts = {},
  today,
}: {
  values?: TripValues;
  programs: string[];
  /** Active students per program, for the "who can go" estimate */
  programCounts?: Record<string, number>;
  today: string;
}) {
  const [state, onSubmit, pending] = useFormAction(saveTrip, null);
  const v = values;
  const [hasFee, setHasFee] = useState(v ? Number(v.feeAmount) > 0 : false);
  const [draft, setDraft] = useState<Draft>({
    title: v?.title ?? "",
    destination: v?.destination ?? "",
    departDate: v?.departDate ?? "",
    departTime: v?.departTime ?? "08:00",
    returnDate: v?.returnDate ?? "",
    returnTime: v?.returnTime ?? "17:00",
    overnight: v?.overnight ?? false,
    programs: v?.programs ?? [],
    seats: v?.seats ?? "",
    feeAmount: v && Number(v.feeAmount) > 0 ? v.feeAmount : "",
    consentDeadline: v?.consentDeadline ?? "",
    feeDeadline: v?.feeDeadline ?? "",
  });
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
    <form onSubmit={onSubmit} onChange={(e) => setDraft(readDraft(e.currentTarget))} className="flex flex-col gap-5">
      {v?.id && <input type="hidden" name="id" value={v.id} />}
      <Card>
        <CardHeader title="Trip details" />
        <div className="grid gap-4 p-5 sm:grid-cols-2">
          <Field label="Title *" className="sm:col-span-2">
            <Input name="title" required maxLength={120} defaultValue={v?.title} placeholder="e.g. Study tour to Lahore Museum" />
          </Field>
          <Field label="Type *">
            <Select name="type" defaultValue={v?.type ?? "STUDY_TOUR"}>
              {(Object.keys(TRIP_TYPE_LABELS) as TripType[]).map((t) => (
                <option key={t} value={t}>
                  {TRIP_TYPE_LABELS[t]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Destination *">
            <Input name="destination" required maxLength={150} defaultValue={v?.destination} placeholder="e.g. Lahore Museum, Mall Road" />
          </Field>
          <Field label="Purpose" className="sm:col-span-2">
            <Textarea name="purpose" rows={2} maxLength={2000} defaultValue={v?.purpose} placeholder="What students will learn or do" />
          </Field>
          <Field label="Itinerary / plan" className="sm:col-span-2" hint="Printed on the parent permission slip">
            <Textarea name="itinerary" rows={3} maxLength={4000} defaultValue={v?.itinerary} placeholder={"08:00 Depart college\n10:00 Museum visit\n13:00 Lunch\n16:00 Return"} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="When & where" />
        <label className="flex cursor-pointer items-start gap-3 border-b border-line px-5 py-4 has-[:checked]:bg-accent-soft/50">
          <input type="checkbox" name="overnight" defaultChecked={v?.overnight} className="mt-0.5 size-4.5 accent-[var(--accent)]" />
          <BedDouble className="mt-0.5 size-4.5 text-muted" aria-hidden />
          <span>
            <span className="block text-sm font-medium">Night stay</span>
            <span className="block text-[12px] text-muted">Adds a Rooms tab to allocate students to rooms and beds.</span>
          </span>
        </label>
        <div className="grid gap-4 p-5 sm:grid-cols-4">
          <Field label="Departure date *">
            <Input name="departDate" type="date" required min={v ? undefined : today} defaultValue={v?.departDate} />
          </Field>
          <Field label="Departure time *">
            <Input name="departTime" type="time" required defaultValue={v?.departTime ?? "08:00"} />
          </Field>
          <Field label="Return date *">
            <Input name="returnDate" type="date" required min={v ? undefined : today} defaultValue={v?.returnDate} />
          </Field>
          <Field label="Return time *">
            <Input name="returnTime" type="time" required defaultValue={v?.returnTime ?? "17:00"} />
          </Field>
          <Field label="Meeting point" className="sm:col-span-2">
            <Input name="meetingPoint" maxLength={150} defaultValue={v?.meetingPoint ?? "College main gate"} />
          </Field>
          <Field label="Teacher in charge *">
            <Input name="inChargeName" required maxLength={100} defaultValue={v?.inChargeName} />
          </Field>
          <Field label="In-charge phone">
            <Input name="inChargePhone" type="tel" maxLength={20} defaultValue={v?.inChargePhone} />
          </Field>
        </div>
      </Card>

      <Card>
        <CardHeader title="Who can go & cost" />
        <div className="flex flex-col gap-4 p-5">
          <fieldset>
            <legend className="text-[13px] font-medium text-ink-2">Programs</legend>
            <p className="mb-2 text-[12px] text-muted">Leave all unticked to open the trip to every program.</p>
            <div className="flex flex-wrap gap-2">
              {programs.map((p) => (
                <label key={p} className={cx("inline-flex cursor-pointer items-center gap-2 rounded-full border border-line px-3 py-1.5 text-[13px] has-[:checked]:border-accent/50 has-[:checked]:bg-accent-soft has-[:checked]:text-accent-ink")}>
                  <input type="checkbox" name="programs" value={p} defaultChecked={v?.programs.includes(p)} className="accent-[var(--accent)]" />
                  {p}
                </label>
              ))}
              {programs.length === 0 && <span className="text-[13px] text-muted">Import students first to choose programs.</span>}
            </div>
          </fieldset>
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Seats" hint="Empty = no limit">
              <Input name="seats" type="number" min={1} max={2000} defaultValue={v?.seats} />
            </Field>
            <Field label="Consent deadline">
              <Input name="consentDeadline" type="date" defaultValue={v?.consentDeadline} />
            </Field>
          </div>
          <div className="rounded-xl border border-line">
            <label className="flex cursor-pointer items-start gap-3 px-4 py-3">
              <input
                type="checkbox"
                name="hasFee"
                checked={hasFee}
                onChange={(e) => setHasFee(e.target.checked)}
                className="mt-0.5 size-4.5 accent-[var(--accent)]"
              />
              <Banknote className="mt-0.5 size-4.5 text-muted" aria-hidden />
              <span>
                <span className="block text-sm font-medium">This trip has a fee</span>
                <span className="block text-[12px] text-muted">Leave off for trips the college pays for — no fee tracking at all.</span>
              </span>
            </label>
            {hasFee && (
              <div className="grid gap-4 border-t border-line p-4 sm:grid-cols-2">
                <Field label="Fee per student (Rs.) *">
                  <Input name="feeAmount" type="number" min={1} step={50} required defaultValue={v && Number(v.feeAmount) > 0 ? v.feeAmount : ""} />
                </Field>
                <Field label="Fee deadline">
                  <Input name="feeDeadline" type="date" defaultValue={v?.feeDeadline} />
                </Field>
              </div>
            )}
          </div>
        </div>
      </Card>

      <FormMessage state={state} />
      <div className="flex justify-end gap-2">
        <Link href={v?.id ? `/trips/${v.id}` : "/trips"} className={buttonClass("ghost")}>
          Cancel
        </Link>
        <Button type="submit" variant="primary" size="lg" disabled={pending}>
          {pending ? "Saving…" : v?.id ? "Save changes" : "Create trip"}
        </Button>
      </div>
    </form>
    <TripPreview draft={draft} programCounts={programCounts} today={today} />
    </div>
  );
}

const fmtDate = (ymd: string) =>
  ymd ? new Date(`${ymd}T00:00:00Z`).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }) : "—";

function TripPreview({ draft: d, programCounts, today }: { draft: Draft; programCounts: Record<string, number>; today: string }) {
  const days = d.departDate && d.returnDate ? Math.round((Date.parse(d.returnDate) - Date.parse(d.departDate)) / 86_400_000) : null;
  const eligible = d.programs.length
    ? d.programs.reduce((a, p) => a + (programCounts[p] ?? 0), 0)
    : Object.values(programCounts).reduce((a, n) => a + n, 0);
  const seats = Number(d.seats) || null;
  const fee = Number(d.feeAmount) || 0;
  const expected = fee * (seats != null ? Math.min(seats, eligible || seats) : eligible);
  const lead = d.departDate ? Math.round((Date.parse(d.departDate) - Date.parse(today)) / 86_400_000) : null;

  const warnings: string[] = [];
  if (days != null && days < 0) warnings.push("Return date is before the departure date.");
  if (days === 0 && d.returnTime && d.departTime && d.returnTime <= d.departTime) warnings.push("Return time is before the departure time.");
  if (days != null && days > 0 && !d.overnight) warnings.push("This trip spans more than one day — tick Night stay to plan rooms.");
  if (d.consentDeadline && d.departDate && d.consentDeadline > d.departDate) warnings.push("Consent deadline is after departure.");
  if (d.feeDeadline && d.departDate && d.feeDeadline > d.departDate) warnings.push("Fee deadline is after departure.");
  if (lead != null && lead >= 0 && lead < 3) warnings.push(`Only ${lead === 0 ? "today" : `${lead} day${lead === 1 ? "" : "s"}`} to collect consent forms.`);
  if (seats != null && seats > eligible && eligible > 0) warnings.push(`More seats (${seats}) than eligible students (${eligible}).`);

  return (
    <aside className="flex flex-col gap-4 lg:sticky lg:top-6">
      <Card className="overflow-hidden">
        <div className="border-b border-line bg-surface-2/50 px-5 py-3">
          <p className="text-[12px] font-medium tracking-wide text-muted uppercase">Trip summary</p>
          <p className="mt-1 truncate font-semibold">{d.title || "Untitled trip"}</p>
          <p className="truncate text-[13px] text-ink-2">{d.destination || "Destination not set"}</p>
        </div>
        <dl className="flex flex-col gap-3 px-5 py-4 text-[13px]">
          <Row label="Leaves">{d.departDate ? `${fmtDate(d.departDate)}, ${d.departTime || "—"}` : "—"}</Row>
          <Row label="Returns">{d.returnDate ? `${fmtDate(d.returnDate)}, ${d.returnTime || "—"}` : "—"}</Row>
          <Row label="Duration">
            {days == null || days < 0 ? "—" : days === 0 ? "Day trip" : `${days + 1} days · ${days} night${days === 1 ? "" : "s"}`}
          </Row>
          <Row label="Open to">{d.programs.length ? d.programs.join(", ") : "All programs"}</Row>
          <Row label="Eligible students">{eligible.toLocaleString()}</Row>
          <Row label="Seats">{seats ?? "No limit"}</Row>
          <Row label="Fee">{fee ? `Rs. ${fee.toLocaleString()} per student` : "Free (college-paid)"}</Row>
          {fee > 0 && <Row label="Fee if all go">{`Rs. ${expected.toLocaleString()}`}</Row>}
          {lead != null && lead >= 0 && <Row label="Time to prepare">{lead === 0 ? "Leaves today" : `${lead} day${lead === 1 ? "" : "s"}`}</Row>}
        </dl>
      </Card>
      {warnings.length > 0 && (
        <div className="rounded-2xl bg-warning/12 px-4 py-3 text-[13px] ring-1 ring-warning/40 ring-inset">
          <p className="font-semibold">Check before saving</p>
          <ul className="mt-1 list-disc pl-5 text-ink-2">
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="px-1 text-[12px] text-muted">After creating the trip you can add students (by roll number or a whole section), staff, buses and rooms.</p>
    </aside>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-right font-medium">{children}</dd>
    </div>
  );
}
