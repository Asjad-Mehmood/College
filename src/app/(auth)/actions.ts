"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, homeFor } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { prisma } from "@/lib/prisma";

export type FormState = { ok?: boolean; message?: string } | null;

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!username || !password) {
    return { ok: false, message: "Enter your username and password." };
  }
  const user = await prisma.user.findUnique({ where: { username } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, message: "Incorrect username or password." };
  }
  await createSession(user.id);
  redirect(homeFor(user.role));
}

export async function logout() {
  await destroySession();
  redirect("/login");
}

/** First-run only: creates the Discipline In-Charge account. */
export async function setupAdmin(_: FormState, formData: FormData): Promise<FormState> {
  const fullName = String(formData.get("fullName") ?? "").trim();
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const collegeName = String(formData.get("collegeName") ?? "").trim();

  if (!fullName || !username || !collegeName) {
    return { ok: false, message: "All fields are required." };
  }
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) {
    return { ok: false, message: "Username: 3–50 letters, numbers, dots, dashes or underscores." };
  }
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if ((await prisma.user.count()) > 0) {
    return { ok: false, message: "Setup is already complete. Sign in instead." };
  }

  const user = await prisma.user.create({
    data: { fullName, username, passwordHash: await hashPassword(password), role: "ADMIN" },
  });
  await prisma.portalSettings.upsert({
    where: { id: 1 },
    update: { collegeName },
    create: { id: 1, collegeName },
  });
  await createSession(user.id);
  redirect("/settings");
}
