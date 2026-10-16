import type { Metadata } from "next";
import { Suspense } from "react";
import { connection } from "next/server";
import { redirect } from "next/navigation";
import { Skeleton } from "@/components/ui";
import { prisma } from "@/lib/prisma";
import { SetupForm } from "./setup-form";

export const metadata: Metadata = { title: "Set up" };

export default function SetupPage() {
  return (
    <Suspense fallback={<Skeleton className="h-96 rounded-2xl" />}>
      <Setup />
    </Suspense>
  );
}

async function Setup() {
  await connection();
  if ((await prisma.user.count()) > 0) redirect("/");
  return <SetupForm />;
}
