"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { SCOPE_COOKIE } from "@/lib/scope";

/** Remembers the chosen academic year and batch on this device. */
export async function chooseScope(yearId: number, batchId: number | null, next?: string) {
  await requireUser(["ADMIN", "PRINCIPAL"]);
  (await cookies()).set(SCOPE_COOKIE, `${yearId}.${batchId ?? 0}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}
