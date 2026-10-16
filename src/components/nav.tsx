"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  ScanLine,
  Settings,
  Users,
} from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { cx } from "@/components/ui";

// Sidebar sections. New modules (trips, violations, …) get their own group.
const GROUPS = [
  {
    title: null,
    items: [
      { href: "/dashboard", label: "Dashboard", short: "Dashboard", icon: LayoutDashboard, roles: ["ADMIN", "PRINCIPAL"] },
      { href: "/students", label: "Students", short: "Students", icon: Users, roles: ["ADMIN", "PRINCIPAL"] },
    ],
  },
  {
    title: "Late arrivals",
    items: [
      { href: "/gate", label: "Gate check-in", short: "Gate", icon: ScanLine, roles: ["ADMIN", "GATE"] },
      { href: "/records", label: "Late records", short: "Records", icon: ClipboardList, roles: ["ADMIN", "PRINCIPAL"] },
    ],
  },
  {
    title: "Administration",
    items: [{ href: "/settings", label: "Settings", short: "Settings", icon: Settings, roles: ["ADMIN"] }],
  },
] as const;

type Item = (typeof GROUPS)[number]["items"][number];

function allowed(item: Item, role: Role) {
  return (item.roles as readonly Role[]).includes(role);
}

function itemsFor(role: Role): Item[] {
  return GROUPS.flatMap((g) => g.items as readonly Item[]).filter((i) => allowed(i, role));
}

function useIsActive() {
  const pathname = usePathname();
  return (href: string) => pathname === href || pathname.startsWith(`${href}/`);
}

export function SideNav({ role }: { role: Role }) {
  const isActive = useIsActive();
  return (
    <nav className="flex flex-col gap-5">
      {GROUPS.map((group) => {
        const items = (group.items as readonly Item[]).filter((i) => allowed(i, role));
        if (items.length === 0) return null;
        return (
          <div key={group.title ?? "main"} className="flex flex-col gap-0.5">
            {group.title && (
              <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{group.title}</p>
            )}
            {items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium transition-colors",
                    active ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                  )}
                >
                  <Icon className="size-[18px]" aria-hidden />
                  {label}
                </Link>
              );
            })}
          </div>
        );
      })}
    </nav>
  );
}

export function BottomNav({ role }: { role: Role }) {
  const isActive = useIsActive();
  const items = itemsFor(role);
  if (items.length < 2) return null;
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg">
        {items.map(({ href, short, icon: Icon }) => {
          const active = isActive(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex flex-1 flex-col items-center gap-0.5 py-2 text-[11px] font-medium",
                active ? "text-accent-ink" : "text-muted",
              )}
            >
              <Icon className="size-5" aria-hidden />
              {short}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

export function LogoutButton({ action, compact }: { action: () => Promise<void>; compact?: boolean }) {
  return (
    <form action={action}>
      <button
        type="submit"
        title="Sign out"
        className={cx(
          "flex items-center gap-2 rounded-lg text-[13px] font-medium text-ink-2 hover:bg-surface-2 hover:text-ink",
          compact ? "size-9 justify-center" : "h-9 px-2.5",
        )}
      >
        <LogOut className="size-4" aria-hidden />
        {!compact && "Sign out"}
      </button>
    </form>
  );
}
