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

export function TripForm({ values, programs, today }: { values?: TripValues; programs: string[]; today: string }) {
  const [state, onSubmit, pending] = useFormAction(saveTrip, null);
  const v = values;
  const [hasFee, setHasFee] = useState(v ? Number(v.feeAmount) > 0 : false);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
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
  );
}
