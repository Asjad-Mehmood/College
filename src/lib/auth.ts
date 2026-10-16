import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Role } from "@/generated/prisma/enums";
import { prisma } from "@/lib/prisma";

export const SESSION_COOKIE = "lc_session";
const SESSION_DAYS = 30;

export type CurrentUser = {
  id: number;
  fullName: string;
  username: string;
  role: Role;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  await prisma.session.create({ data: { id: hashToken(token), userId, expiresAt } });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession() {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (token) {
    await prisma.session.deleteMany({ where: { id: hashToken(token) } });
  }
  store.delete(SESSION_COOKIE);
}

/** The signed-in user, or null. Deduplicated per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { id: hashToken(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt < new Date() || !session.user.active) {
    return null;
  }
  const { id, fullName, username, role } = session.user;
  return { id, fullName, username, role };
});

export function homeFor(role: Role) {
  return role === "GATE" ? "/gate" : "/dashboard";
}

/**
 * Use at the top of every page section and server action that touches data.
 * Redirects to login when signed out, or to the user's home page when their
 * role isn't allowed here.
 */
export async function requireUser(roles?: Role[]): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (roles && !roles.includes(user.role)) redirect(homeFor(user.role));
  return user;
}

export const can = {
  logLate: (role: Role) => role === "ADMIN" || role === "GATE",
  manageRecords: (role: Role) => role === "ADMIN",
  viewReports: (role: Role) => role === "ADMIN" || role === "PRINCIPAL",
  administer: (role: Role) => role === "ADMIN",
};
