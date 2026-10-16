import { Suspense } from "react";
import { logout } from "@/app/(auth)/actions";
import { BrandMark } from "@/components/brand";
import { BottomNav, LogoutButton, MobileMenu, SideNav } from "@/components/nav";
import { Avatar, Skeleton } from "@/components/ui";
import { APP_NAME, APP_TAGLINE } from "@/lib/app";
import { requireUser } from "@/lib/auth";
import { ROLE_LABELS } from "@/lib/labels";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="min-h-dvh lg:pl-64">
      {/* Desktop sidebar */}
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex">
        <div className="flex h-16 items-center gap-3 px-5">
          <BrandMark />
          <div className="leading-tight">
            <p className="text-sm font-semibold">{APP_NAME}</p>
            <p className="text-[12px] text-muted">{APP_TAGLINE}</p>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-3 py-3">
          <Suspense fallback={<NavSkeleton />}>
            <SideNavForUser />
          </Suspense>
        </div>
        <div className="border-t border-line p-3">
          <Suspense fallback={<Skeleton className="h-12" />}>
            <UserCard />
          </Suspense>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="no-print sticky top-0 z-20 flex h-14 items-center justify-between border-b border-line bg-surface/95 px-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-1.5">
          <Suspense>
            <MobileMenuForUser />
          </Suspense>
          <BrandMark className="size-8" />
          <p className="ml-1 text-sm font-semibold">{APP_NAME}</p>
        </div>
        <LogoutButton action={logout} compact />
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pt-6 pb-28 sm:px-6 lg:px-8 lg:pb-10">
        {children}
      </main>

      <Suspense>
        <BottomNavForUser />
      </Suspense>
    </div>
  );
}

function NavSkeleton() {
  return (
    <div className="flex flex-col gap-1.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Skeleton key={i} className="h-10" />
      ))}
    </div>
  );
}

async function SideNavForUser() {
  const user = await requireUser();
  return <SideNav role={user.role} />;
}

async function MobileMenuForUser() {
  const user = await requireUser();
  return <MobileMenu role={user.role} />;
}

async function BottomNavForUser() {
  const user = await requireUser();
  return <BottomNav role={user.role} />;
}

async function UserCard() {
  const user = await requireUser();
  return (
    <div className="flex items-center gap-2.5">
      <Avatar name={user.fullName} size="sm" />
      <div className="min-w-0 flex-1 leading-tight">
        <p className="truncate text-[13px] font-medium">{user.fullName}</p>
        <p className="truncate text-[12px] text-muted">{ROLE_LABELS[user.role]}</p>
      </div>
      <LogoutButton action={logout} compact />
    </div>
  );
}
