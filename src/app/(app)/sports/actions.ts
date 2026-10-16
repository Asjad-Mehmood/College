"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@/generated/prisma/client";
import type { ConsentStatus, MemberStatus, TrialResult } from "@/generated/prisma/enums";
import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveRoll } from "@/lib/student-lookup";
import { getSettings } from "@/lib/settings";
import { isValidYmd, localParts, toDbDate } from "@/lib/time";
import { openSevereWarnings } from "@/lib/sports";

export type FormState = { ok?: boolean; message?: string } | null;

const admin = () => requireUser(["ADMIN"]);
const clean = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

/* ---------- Sports & teams ---------- */

export async function saveSport(_: FormState, fd: FormData): Promise<FormState> {
  await admin();
  const id = Number(fd.get("id")) || null;
  const name = clean(fd.get("name"), 60);
  if (!name) return { ok: false, message: "Enter the sport's name." };
  const data = { name, coach: clean(fd.get("coach"), 100) || null };
  try {
    if (id) await prisma.sport.update({ where: { id }, data });
    else await prisma.sport.create({ data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return { ok: false, message: `“${name}” already exists.` };
    throw e;
  }
  refresh();
  return { ok: true, message: id ? "Sport updated." : `Added ${name}.` };
}

export async function setSportActive(id: number, active: boolean) {
  await admin();
  await prisma.sport.update({ where: { id }, data: { active } });
  refresh();
}

/* ---------- Events & houses ---------- */

export async function createEvent(_: FormState, fd: FormData): Promise<FormState> {
  await admin();
  const name = clean(fd.get("name"), 120);
  const start = clean(fd.get("startDate"), 10);
  const end = clean(fd.get("endDate"), 10) || start;
  if (!name) return { ok: false, message: "Enter the event's name." };
  if (!isValidYmd(start) || !isValidYmd(end)) return { ok: false, message: "Enter the start and end dates." };
  if (end < start) return { ok: false, message: "The end date can't be before the start." };
  const event = await prisma.sportsEvent.create({
    data: { name, startDate: toDbDate(start), endDate: toDbDate(end), venue: clean(fd.get("venue"), 100) || null, notes: clean(fd.get("notes"), 300) || null },
  });
  redirect(`/sports/events/${event.id}`);
}

export async function deleteEvent(id: number) {
  await admin();
  await prisma.sportsEvent.delete({ where: { id } });
  redirect("/sports");
}

/** Adds a sport to an event: creates the college's team for it. */
export async function addSportToEvent(eventId: number, sportId: number): Promise<FormState> {
  await admin();
  if (!sportId) return { ok: false, message: "Choose a sport." };
  const res = await prisma.team.createMany({ data: [{ eventId, sportId }], skipDuplicates: true });
  refresh();
  return res.count === 0 ? { ok: false, message: "That sport is already in this event." } : { ok: true, message: "Sport added. Open it to pick the players." };
}

export async function removeSportFromEvent(eventId: number, sportId: number) {
  await admin();
  await prisma.team.deleteMany({ where: { eventId, sportId } });
  refresh();
}

export async function setManager(teamId: number, manager: string): Promise<FormState> {
  await admin();
  await prisma.team.update({ where: { id: teamId }, data: { manager: clean(manager, 100) || null } });
  refresh();
  return { ok: true };
}

export type StudentHit = { rollNo: string; fullName: string; section: string; program: string };

/** Quick search across the whole college by name, father's name or roll number. */
export async function searchStudents(q: string): Promise<StudentHit[]> {
  await admin();
  const term = q.trim().slice(0, 60);
  if (term.length < 2) return [];
  return prisma.student.findMany({
    where: {
      status: "ACTIVE",
      OR: [
        { rollNo: { contains: term, mode: "insensitive" } },
        { fullName: { contains: term, mode: "insensitive" } },
        { fatherName: { contains: term, mode: "insensitive" } },
      ],
    },
    select: { rollNo: true, fullName: true, section: true, program: true },
    orderBy: { fullName: "asc" },
    take: 8,
  });
}

export async function deleteTeam(id: number) {
  await admin();
  const team = await prisma.team.delete({ where: { id } });
  redirect(`/sports/events/${team.eventId}`);
}

/* ---------- Squad ---------- */

export type CheckResult =
  | { ok: true; student: { rollNo: string; fullName: string; section: string }; blocks: string[]; warnings: string[] }
  | { ok: false; message: string };

export async function checkForTeam(teamId: number, rawRoll: string): Promise<CheckResult> {
  await admin();
  const rollNo = rawRoll.trim().toUpperCase().replace(/\s+/g, "");
  if (!rollNo) return { ok: false, message: "Enter a roll number." };
  const student = await prisma.student.findFirst({ where: { rollNo: { equals: (await resolveRoll(rollNo)) ?? rollNo, mode: "insensitive" } } });
  if (!student) return { ok: false, message: `No student found with roll number “${rollNo}”.` };
  const blocks: string[] = [];
  if (student.status !== "ACTIVE") blocks.push("The student is not active (struck off or graduated).");
  if (await prisma.teamMember.findUnique({ where: { teamId_rollNo: { teamId, rollNo: student.rollNo } } })) blocks.push("Already in this team.");
  return { ok: true, student: { rollNo: student.rollNo, fullName: student.fullName, section: student.section }, blocks, warnings: await openSevereWarnings(student.rollNo) };
}

export async function addMember(teamId: number, rollNo: string, overrideNote?: string): Promise<FormState> {
  const user = await admin();
  const check = await checkForTeam(teamId, rollNo);
  if (!check.ok) return check;
  if (check.blocks.length) return { ok: false, message: check.blocks[0] };
  if (check.warnings.length && !overrideNote?.trim()) return { ok: false, message: "Confirm why this student may join despite the warning." };
  await prisma.teamMember.create({ data: { teamId, rollNo: check.student.rollNo, addedById: user.id, overrideNote: overrideNote?.trim().slice(0, 200) || null } });
  refresh();
  return { ok: true, message: `Added ${check.student.fullName}.` };
}

export async function updateMember(
  id: number,
  input: { role?: string; jerseyNo?: string; position?: string; status?: MemberStatus; consent?: ConsentStatus; medicalNote?: string },
): Promise<FormState> {
  await admin();
  const m = await prisma.teamMember.findUnique({ where: { id } });
  if (!m) return { ok: false, message: "Not found." };
  const data: Prisma.TeamMemberUpdateInput = {};
  if (input.role !== undefined) {
    if (!["Captain", "Vice-captain", "Player"].includes(input.role)) return { ok: false, message: "Invalid role." };
    data.role = input.role;
    // One captain and one vice-captain per team.
    if (input.role !== "Player") await prisma.teamMember.updateMany({ where: { teamId: m.teamId, role: input.role, id: { not: id } }, data: { role: "Player" } });
  }
  if (input.jerseyNo !== undefined) {
    const n = input.jerseyNo.trim() ? Number(input.jerseyNo) : null;
    if (n !== null && (!Number.isInteger(n) || n < 0 || n > 999)) return { ok: false, message: "Jersey number must be 0–999." };
    if (n !== null && (await prisma.teamMember.count({ where: { teamId: m.teamId, jerseyNo: n, id: { not: id } } }))) return { ok: false, message: `Jersey ${n} is already taken.` };
    data.jerseyNo = n;
  }
  if (input.position !== undefined) data.position = clean(input.position, 40) || null;
  if (input.status) data.status = input.status;
  if (input.consent) data.consent = input.consent;
  if (input.medicalNote !== undefined) data.medicalNote = clean(input.medicalNote, 300) || null;
  await prisma.teamMember.update({ where: { id }, data });
  refresh();
  return { ok: true };
}

export async function removeMember(id: number) {
  await admin();
  await prisma.teamMember.delete({ where: { id } });
  refresh();
}

/* ---------- Trials ---------- */

export async function createTrial(_: FormState, fd: FormData): Promise<FormState> {
  await admin();
  const sportId = Number(fd.get("sportId"));
  const date = clean(fd.get("trialDate"), 10);
  if (!sportId || !isValidYmd(date)) return { ok: false, message: "Choose the sport and the trial date." };
  const trial = await prisma.trial.create({
    data: { sportId, trialDate: toDbDate(date), venue: clean(fd.get("venue"), 100) || null, notes: clean(fd.get("notes"), 300) || null },
  });
  redirect(`/sports/trials/${trial.id}`);
}

export async function deleteTrial(id: number) {
  await admin();
  await prisma.trial.delete({ where: { id } });
  redirect("/sports/trials");
}

export async function addCandidates(trialId: number, input: { rollNo?: string; section?: string }): Promise<FormState> {
  await admin();
  let students: { rollNo: string }[] = [];
  if (input.section) students = await prisma.student.findMany({ where: { section: input.section, status: "ACTIVE" }, select: { rollNo: true } });
  else if (input.rollNo?.trim()) {
    const s = await prisma.student.findFirst({ where: { rollNo: { equals: input.rollNo.trim().replace(/\s+/g, ""), mode: "insensitive" }, status: "ACTIVE" } });
    if (!s) return { ok: false, message: "No active student with that roll number." };
    students = [s];
  } else return { ok: false, message: "Enter a roll number or choose a section." };
  const res = await prisma.trialCandidate.createMany({ data: students.map((s) => ({ trialId, rollNo: s.rollNo })), skipDuplicates: true });
  refresh();
  return { ok: true, message: `Added ${res.count}.` };
}

export async function setCandidate(id: number, result: TrialResult, note?: string): Promise<FormState> {
  await admin();
  await prisma.trialCandidate.update({ where: { id }, data: { result, ...(note !== undefined ? { note: clean(note, 200) || null } : {}) } });
  refresh();
  return { ok: true };
}

export async function removeCandidate(id: number) {
  await admin();
  await prisma.trialCandidate.delete({ where: { id } });
  refresh();
}

/** Moves selected/waitlisted candidates into a team squad. */
export async function promoteCandidates(trialId: number, teamId: number): Promise<FormState> {
  const user = await admin();
  const cands = await prisma.trialCandidate.findMany({ where: { trialId, result: { in: ["SELECTED", "WAITLIST"] } } });
  if (cands.length === 0) return { ok: false, message: "Mark some candidates as selected first." };
  let added = 0;
  const skipped: string[] = [];
  for (const c of cands) {
    if (await prisma.teamMember.findUnique({ where: { teamId_rollNo: { teamId, rollNo: c.rollNo } } })) continue;
    if ((await openSevereWarnings(c.rollNo)).length) {
      skipped.push(c.rollNo);
      continue;
    }
    await prisma.teamMember.create({ data: { teamId, rollNo: c.rollNo, status: c.result === "WAITLIST" ? "WAITLIST" : "SELECTED", addedById: user.id } });
    added += 1;
  }
  refresh();
  return { ok: true, message: `Moved ${added} to the squad.${skipped.length ? ` Skipped (open severe violation): ${skipped.join(", ")}.` : ""}` };
}

/* ---------- Achievements ---------- */

export async function addAchievement(_: FormState, fd: FormData): Promise<FormState> {
  await admin();
  const settings = await getSettings();
  const event = clean(fd.get("event"), 120);
  const position = clean(fd.get("position"), 60);
  const date = clean(fd.get("achievedOn"), 10) || localParts(new Date(), settings.timezone).date;
  const teamId = Number(fd.get("teamId")) || null;
  const rollNo = clean(fd.get("rollNo"), 20).toUpperCase().replace(/\s+/g, "") || null;
  if (!event || !position) return { ok: false, message: "Enter the event and the position (e.g. Winner, Runner-up, Gold)." };
  if (!isValidYmd(date)) return { ok: false, message: "Enter a valid date." };
  if (!teamId && !rollNo) return { ok: false, message: "Choose a team or enter a student's roll number." };
  if (rollNo && !(await prisma.student.findUnique({ where: { rollNo } }))) return { ok: false, message: `No student with roll number ${rollNo}.` };
  await prisma.achievement.create({ data: { event, position, achievedOn: toDbDate(date), teamId, rollNo, notes: clean(fd.get("notes"), 300) || null } });
  refresh();
  return { ok: true, message: "Achievement recorded." };
}

export async function deleteAchievement(id: number) {
  await admin();
  await prisma.achievement.delete({ where: { id } });
  refresh();
}
