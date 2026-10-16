"use client";

import { useRef } from "react";
import { Pencil, UserPlus, X } from "lucide-react";
import { saveStudent } from "@/app/(app)/students/actions";
import { Button, Field, FormMessage, Input, Select } from "@/components/ui";
import { useFormAction } from "@/components/use-form-action";

export type StudentFields = {
  rollNo: string;
  fullName: string;
  fatherName: string;
  program: string;
  section: string;
  parentPhone: string;
  studentPhone: string | null;
  photoUrl: string | null;
  status: string;
};

export function StudentDialog({ student, programs, sections }: { student?: StudentFields; programs: string[]; sections: { name: string; year: "FIRST" | "SECOND" | null }[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const editing = !!student;
  const [state, onSubmit, pending] = useFormAction(saveStudent, null, { resetOnSuccess: !editing });

  return (
    <>
      <Button variant={editing ? "secondary" : "primary"} onClick={() => dialogRef.current?.showModal()}>
        {editing ? <Pencil className="size-4" aria-hidden /> : <UserPlus className="size-4" aria-hidden />}
        {editing ? "Edit" : "Add student"}
      </Button>
      <dialog
        ref={dialogRef}
        className="m-auto w-[min(36rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-black/50"
      >
        <form onSubmit={onSubmit}>
          <div className="flex items-center justify-between border-b border-line px-5 py-4">
            <p className="font-semibold">{editing ? "Edit student" : "Add a student"}</p>
            <button type="button" onClick={() => dialogRef.current?.close()} className="rounded-lg p-1.5 hover:bg-surface-2" aria-label="Close">
              <X className="size-5" />
            </button>
          </div>
          <div className="grid max-h-[70vh] gap-3 overflow-y-auto px-5 py-4 sm:grid-cols-2">
            {editing && <input type="hidden" name="originalRollNo" value={student.rollNo} />}
            <Field label="Roll number *">
              <Input name="rollNo" required maxLength={20} defaultValue={student?.rollNo} className="font-mono uppercase" />
            </Field>
            <Field label="Status">
              <Select name="status" defaultValue={student?.status ?? "ACTIVE"}>
                <option value="ACTIVE">Active</option>
                <option value="STRUCK_OFF">Struck off</option>
                <option value="GRADUATED">Graduated</option>
              </Select>
            </Field>
            <Field label="Full name *">
              <Input name="fullName" required maxLength={100} defaultValue={student?.fullName} />
            </Field>
            <Field label="Father / guardian name *">
              <Input name="fatherName" required maxLength={100} defaultValue={student?.fatherName} />
            </Field>
            <Field label="Program *">
              <Input name="program" required maxLength={50} list="program-options" defaultValue={student?.program} placeholder="e.g. ICS" />
              <datalist id="program-options">
                {programs.map((p) => (
                  <option key={p} value={p} />
                ))}
              </datalist>
            </Field>
            <Field label="Section *" hint={sections.length === 0 ? "Create a section first (Students → By section)." : undefined}>
              <Select name="section" required defaultValue={student?.section ?? ""}>
                <option value="" disabled>
                  Choose a section…
                </option>
                {(["FIRST", "SECOND", null] as const).map((y) => {
                  const list = sections.filter((x) => x.year === y);
                  if (list.length === 0) return null;
                  return (
                    <optgroup key={y ?? "none"} label={y === "FIRST" ? "1st year" : y === "SECOND" ? "2nd year" : "Year not set"}>
                      {list.map((x) => (
                        <option key={x.name} value={x.name}>
                          {x.name}
                        </option>
                      ))}
                    </optgroup>
                  );
                })}
                {student && !sections.some((x) => x.name === student.section) && <option value={student.section}>{student.section}</option>}
              </Select>
            </Field>
            <Field label="Parent phone *" hint="Used for WhatsApp / SMS alerts">
              <Input name="parentPhone" type="tel" required maxLength={20} defaultValue={student?.parentPhone} placeholder="03XX XXXXXXX" />
            </Field>
            <Field label="Student phone">
              <Input name="studentPhone" type="tel" maxLength={20} defaultValue={student?.studentPhone ?? ""} />
            </Field>
            <Field label="Photo URL" className="sm:col-span-2" hint="Link to the student's passport photo">
              <Input name="photoUrl" type="url" maxLength={255} defaultValue={student?.photoUrl ?? ""} placeholder="https://…" />
            </Field>
            <div className="sm:col-span-2">
              <FormMessage state={state} />
            </div>
          </div>
          <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
            <Button type="button" variant="ghost" onClick={() => dialogRef.current?.close()}>
              Close
            </Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending ? "Saving…" : editing ? "Save changes" : "Add student"}
            </Button>
          </div>
        </form>
      </dialog>
    </>
  );
}
