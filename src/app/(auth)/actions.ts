"use server";

import { redirect } from "next/navigation";
import { createSession, destroySession, homeFor } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/password";
import { isEmail } from "@/lib/email";
import { prisma } from "@/lib/prisma";

export type FormState = { ok?: boolean; message?: string } | null;

export async function login(_: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) {
    return { ok: false, message: "Enter your email and password." };
  }
  // Accounts created before email sign-in can still use their old username.
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await verifyPassword(password, user.passwordHash))) {
    return { ok: false, message: "Incorrect email or password." };
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
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const collegeName = String(formData.get("collegeName") ?? "").trim();

  if (!fullName || !email || !collegeName) {
    return { ok: false, message: "All fields are required." };
  }
  if (!isEmail(email)) {
    return { ok: false, message: "Enter a valid email address." };
  }
  if (password.length < 8) {
    return { ok: false, message: "Password must be at least 8 characters." };
  }
  if ((await prisma.user.count()) > 0) {
    return { ok: false, message: "Setup is already complete. Sign in instead." };
  }

  const user = await prisma.user.create({
    data: { fullName, email, passwordHash: await hashPassword(password), role: "ADMIN" },
  });
  await prisma.portalSettings.upsert({
    where: { id: 1 },
    update: { collegeName },
    create: { id: 1, collegeName },
  });
  await createSession(user.id);
  redirect("/settings");
}
