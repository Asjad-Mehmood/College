import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { connection } from "next/server";
import { prisma } from "@/lib/prisma";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <>
      <LoginForm />
      <Suspense>
        <FirstRunHint />
      </Suspense>
    </>
  );
}

async function FirstRunHint() {
  await connection();
  if ((await prisma.user.count()) > 0) return null;
  return (
    <p className="mt-4 rounded-xl border border-accent/25 bg-accent-soft px-4 py-3 text-center text-[13px] text-accent-ink">
      No accounts exist yet.{" "}
      <Link href="/setup" className="font-semibold underline underline-offset-2">
        Set up the portal
      </Link>
    </p>
  );
}
