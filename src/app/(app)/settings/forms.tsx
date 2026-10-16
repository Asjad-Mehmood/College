"use client";

import { useRef, useState, useTransition } from "react";
import { FileSpreadsheet, KeyRound, Mail, Snowflake, Sun, UploadCloud, UserPlus } from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { Button, Field, FormMessage, Input, Pill, Select, cx, fieldClass } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";
import type { ImportReport } from "@/lib/student-import";
import { ROLE_LABELS } from "@/lib/labels";
import {
  createUser,
  resetPassword,
  saveSettings,
  setSchedule,
  setUserActive,
  setUserEmail,
  uploadStudents,
  type SettingsState,
} from "./actions";

export type SettingsValues = {
  collegeName: string;
  collegeAddress: string;
  timezone: string;
  schedule: "SUMMER" | "WINTER";
  summerStartTime: string;
  winterStartTime: string;
  eveningSummerStartTime: string;
  eveningWinterStartTime: string;
  gracePeriodMins: number;
  habitualThreshold: number;
  criticalThreshold: number;
  defaultFineAmount: number;
};

const TIMEZONES = ["Asia/Karachi", "Asia/Kolkata", "Asia/Dhaka", "Asia/Dubai", "Asia/Riyadh", "Europe/London", "UTC"];

export function ScheduleToggle({
  schedule,
  summer,
  winter,
  eveningSummer,
  eveningWinter,
}: {
  schedule: "SUMMER" | "WINTER";
  summer: string;
  winter: string;
  eveningSummer: string;
  eveningWinter: string;
}) {
  const [pending, start] = useTransition();
  const options = [
    { value: "SUMMER" as const, label: "Summer", time: `Morning ${summer} · Evening ${eveningSummer}`, Icon: Sun },
    { value: "WINTER" as const, label: "Winter", time: `Morning ${winter} · Evening ${eveningWinter}`, Icon: Snowflake },
  ];
  return (
    <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label="Active timing schedule">
      {options.map(({ value, label, time, Icon }) => {
        const active = schedule === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={pending}
            onClick={() => !active && start(() => setSchedule(value))}
            className={cx(
              "flex items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors disabled:opacity-60",
              active ? "border-accent bg-accent-soft ring-2 ring-accent/25" : "border-line hover:bg-surface-2",
            )}
          >
            <Icon className={cx("size-5", active ? "text-accent-ink" : "text-muted")} aria-hidden />
            <span>
              <span className={cx("block text-sm font-semibold", active && "text-accent-ink")}>{label} timing</span>
              <span className="block text-[13px] text-muted">{time}</span>
            </span>
            {active && <span className="ml-auto"><Pill tone="accent">Active</Pill></span>}
          </button>
        );
      })}
    </div>
  );
}

export function SettingsForm({ values }: { values: SettingsValues }) {
  const [state, onSubmit, pending] = useFormAction<SettingsState>(saveSettings, null);
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="College name" className="sm:col-span-2">
          <Input name="collegeName" required maxLength={150} defaultValue={values.collegeName} />
        </Field>
        <Field label="Address" hint="Printed on the warning letter letterhead" className="sm:col-span-2">
          <Input name="collegeAddress" maxLength={255} defaultValue={values.collegeAddress} />
        </Field>
        <div className="grid gap-3 rounded-xl border border-line p-4 sm:col-span-2 sm:grid-cols-2">
          <p className="text-sm font-semibold sm:col-span-2">Morning shift</p>
          <Field label="Summer start time">
            <Input name="summerStartTime" type="time" required defaultValue={values.summerStartTime} />
          </Field>
          <Field label="Winter start time">
            <Input name="winterStartTime" type="time" required defaultValue={values.winterStartTime} />
          </Field>
        </div>
        <div className="grid gap-3 rounded-xl border border-line p-4 sm:col-span-2 sm:grid-cols-2">
          <p className="text-sm font-semibold sm:col-span-2">Evening shift</p>
          <Field label="Summer start time">
            <Input name="eveningSummerStartTime" type="time" required defaultValue={values.eveningSummerStartTime} />
          </Field>
          <Field label="Winter start time">
            <Input name="eveningWinterStartTime" type="time" required defaultValue={values.eveningWinterStartTime} />
          </Field>
        </div>
        <Field label="Grace period (minutes)" hint="Arrivals within this window are not counted as late">
          <Input name="gracePeriodMins" type="number" min={0} max={120} required defaultValue={values.gracePeriodMins} />
        </Field>
        <Field label="Timezone">
          <Select name="timezone" defaultValue={values.timezone}>
            {[...new Set([values.timezone, ...TIMEZONES])].map((tz) => (
              <option key={tz}>{tz}</option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="border-t border-line pt-5">
        <p className="text-sm font-semibold">Warning levels</p>
        <p className="mt-0.5 text-[13px] text-muted">
          Monthly late counts that trigger each level. Below the habitual threshold the student gets a verbal warning.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Habitual offender at" hint="Prompts a written warning">
            <Input name="habitualThreshold" type="number" min={2} max={31} required defaultValue={values.habitualThreshold} />
          </Field>
          <Field label="Critical at" hint="Prompts a fine or parent meeting">
            <Input name="criticalThreshold" type="number" min={2} max={31} required defaultValue={values.criticalThreshold} />
          </Field>
          <Field label="Default fine (Rs.)">
            <Input name="defaultFineAmount" type="number" min={0} step={50} required defaultValue={values.defaultFineAmount} />
          </Field>
        </div>
      </div>

      <FormMessage state={state} />
      <div className="flex justify-end">
        <Button type="submit" variant="primary" disabled={pending}>
          {pending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </form>
  );
}

export function ImportForm() {
  const [fileName, setFileName] = useState<string | null>(null);
  const [report, onSubmit, pending] = useFormAction<ImportReport | null>(
    async (prev, fd) => {
      const res = await uploadStudents(prev, fd);
      if (res.ok) setFileName(null);
      return res;
    },
    null,
    { resetOnSuccess: true },
  );
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const file = e.dataTransfer.files[0];
          if (file && inputRef.current) {
            const dt = new DataTransfer();
            dt.items.add(file);
            inputRef.current.files = dt.files;
            setFileName(file.name);
          }
        }}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
          dragging ? "border-accent bg-accent-soft" : "border-line-strong/70 hover:border-accent/60 hover:bg-surface-2/60",
        )}
      >
        <div className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent-ink">
          {fileName ? <FileSpreadsheet className="size-6" aria-hidden /> : <UploadCloud className="size-6" aria-hidden />}
        </div>
        {fileName ? (
          <p className="text-sm font-medium">{fileName}</p>
        ) : (
          <>
            <p className="text-sm font-medium">Drop the student list here, or click to choose</p>
            <p className="text-[13px] text-muted">Excel (.xlsx, .xls) or CSV · first sheet only · up to 4 MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          name="file"
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
          className="sr-only"
          onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
        />
      </label>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        <a href="/student-import-template.csv" download className="text-[13px] font-medium text-accent-ink hover:underline">
          Download the template (CSV)
        </a>
        <Button type="submit" variant="primary" disabled={pending || !fileName}>
          <UploadCloud className="size-4" aria-hidden />
          {pending ? "Importing…" : "Import students"}
        </Button>
      </div>

      {report && (
        <div className="flex flex-col gap-2">
          <FormMessage state={report} />
          {report.errors && report.errors.length > 0 && (
            <div className="rounded-xl border border-line">
              <p className="border-b border-line px-4 py-2 text-[13px] font-medium">
                Skipped rows{report.totalErrors! > report.errors.length && ` (first ${report.errors.length} of ${report.totalErrors})`}
              </p>
              <ul className="max-h-48 divide-y divide-line overflow-y-auto text-[13px]">
                {report.errors.map((e) => (
                  <li key={e.row} className="flex gap-3 px-4 py-1.5">
                    <span className="w-14 shrink-0 text-muted tabular">Row {e.row}</span>
                    <span>{e.message}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </form>
  );
}

export function NewUserForm() {
  const [state, onSubmit, pending] = useFormAction<SettingsState>(createUser, null, { resetOnSuccess: true });
  return (
    <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-2">
      <Field label="Full name">
        <Input name="fullName" required maxLength={100} />
      </Field>
      <Field label="Role">
        <Select name="role" defaultValue="GATE">
          {(Object.keys(ROLE_LABELS) as Role[]).map((r) => (
            <option key={r} value={r}>
              {ROLE_LABELS[r]}
            </option>
          ))}
        </Select>
      </Field>
      <Field label="Email" hint="Used to sign in">
        <Input name="email" type="email" required maxLength={120} autoCapitalize="none" autoComplete="off" />
      </Field>
      <Field label="Password" hint="At least 8 characters">
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </Field>
      <div className="sm:col-span-2">
        <FormMessage state={state} />
      </div>
      <div className="flex justify-end sm:col-span-2">
        <Button type="submit" variant="primary" disabled={pending}>
          <UserPlus className="size-4" aria-hidden /> {pending ? "Creating…" : "Create account"}
        </Button>
      </div>
    </form>
  );
}

export function UserRowActions({ userId, active, isSelf, email }: { userId: number; active: boolean; isSelf: boolean; email: string }) {
  const [mode, setMode] = useState<"idle" | "password" | "email">("idle");
  const [newEmail, setNewEmail] = useState(email.includes("@") ? email : "");
  const [password, setPassword] = useState("");
  const [state, setState] = useState<SettingsState>(null);
  const [pending, start] = useTransition();

  if (mode === "email") {
    return (
      <form
        className="flex flex-wrap items-center justify-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await setUserEmail(userId, newEmail);
            setState(res);
            if (res?.ok) setMode("idle");
          });
        }}
      >
        <input
          type="email"
          value={newEmail}
          onChange={(e) => setNewEmail(e.target.value)}
          placeholder="name@college.edu.pk"
          maxLength={120}
          required
          autoFocus
          autoComplete="off"
          className={fieldClass("h-8 w-56")}
        />
        <Button size="sm" variant="primary" type="submit" disabled={pending}>
          Save
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => setMode("idle")}>
          Cancel
        </Button>
        {state && !state.ok && <span className="w-full text-right text-[12px] text-danger-ink">{state.message}</span>}
      </form>
    );
  }
  if (mode === "password") {
    return (
      <form
        className="flex flex-wrap items-center justify-end gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await resetPassword(userId, password);
            setState(res);
            if (res?.ok) {
              setMode("idle");
              setPassword("");
            }
          });
        }}
      >
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="New password"
          minLength={8}
          required
          autoFocus
          autoComplete="new-password"
          className={fieldClass("h-8 w-40")}
        />
        <Button size="sm" variant="primary" type="submit" disabled={pending}>
          Save
        </Button>
        <Button size="sm" variant="ghost" type="button" onClick={() => setMode("idle")}>
          Cancel
        </Button>
        {state && !state.ok && <span className="w-full text-right text-[12px] text-danger-ink">{state.message}</span>}
      </form>
    );
  }
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {state?.ok && <span className="text-[12px] text-success-ink">{state.message}</span>}
      <Button size="sm" variant={email.includes("@") ? "secondary" : "primary"} onClick={() => setMode("email")}>
        <Mail className="size-3.5" aria-hidden /> {email.includes("@") ? "Change email" : "Set email"}
      </Button>
      <Button size="sm" onClick={() => setMode("password")}>
        <KeyRound className="size-3.5" aria-hidden /> Reset password
      </Button>
      {!isSelf && (
        <Button
          size="sm"
          variant={active ? "danger" : "secondary"}
          disabled={pending}
          onClick={() => start(async () => setState(await setUserActive(userId, !active)))}
        >
          {active ? "Deactivate" : "Re-activate"}
        </Button>
      )}
    </div>
  );
}
