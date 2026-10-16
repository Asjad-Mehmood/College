"use server";

import { refresh } from "next/cache";
import type { DisciplineAction, LateReason } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { ACTION_LABELS, REASON_LABELS } from "@/lib/labels";
import { prisma } from "@/lib/prisma";
import { closedYearMessage } from "@/lib/scope";
import { fromDbDate } from "@/lib/time";

export type ActionResult = { ok: boolean; message?: string };

async function adminOnly() {
  return requireUser(["ADMIN"]);
}

/** Message if the record belongs to a closed (archived) academic year. */
async function locked(id: number) {
  const r = await prisma.lateRecord.findUnique({ where: { id }, select: { lateDate: true } });
  return r ? closedYearMessage(fromDbDate(r.lateDate)) : null;
}

export async function setFinePaid(id: number, paid: boolean): Promise<ActionResult> {
  await adminOnly();
  const closed = await locked(id);
  if (closed) return { ok: false, message: closed };
  await prisma.lateRecord.update({
    where: { id },
    data: { finePaid: paid, finePaidAt: paid ? new Date() : null },
  });
  refresh();
  return { ok: true, message: paid ? "Fine marked as paid." : "Fine marked as unpaid." };
}

export async function updateRecord(
  id: number,
  input: { reason: LateReason; actionTaken: DisciplineAction; fineAmount: number; remarks: string },
): Promise<ActionResult> {
  await adminOnly();
  const closed = await locked(id);
  if (closed) return { ok: false, message: closed };
  if (!(input.reason in REASON_LABELS) || !(input.actionTaken in ACTION_LABELS)) {
    return { ok: false, message: "Invalid reason or action." };
  }
  const fineAmount = Math.max(0, Math.min(999_999, Math.round(Number(input.fineAmount) || 0)));
  await prisma.lateRecord.update({
    where: { id },
    data: {
      reason: input.reason,
      actionTaken: input.actionTaken,
      fineAmount,
      ...(fineAmount === 0 ? { finePaid: false, finePaidAt: null } : {}),
      remarks: input.remarks.trim().slice(0, 1000) || null,
    },
  });
  refresh();
  return { ok: true, message: "Record updated." };
}

export async function deleteRecord(id: number): Promise<ActionResult> {
  await adminOnly();
  const closed = await locked(id);
  if (closed) return { ok: false, message: closed };
  await prisma.lateRecord.delete({ where: { id } });
  refresh();
  return { ok: true, message: "Record deleted." };
}
