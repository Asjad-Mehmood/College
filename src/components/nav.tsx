"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  Bus,
  ClipboardList,
  DoorOpen,
  FilePlus2,
  LayoutDashboard,
  MapPinPlus,
  ShieldHalf,
  Trophy,
  LogOut,
  Menu,
  Settings,
  ShieldAlert,
  Users,
  X,
} from "lucide-react";
import type { Role } from "@/generated/prisma/enums";
import { cx } from "@/components/ui";

const ADMIN_VIEW: Role[] = ["ADMIN", "PRINCIPAL"];

// Sidebar sections. New modules (trips, …) get their own group.
// `mobile` marks the few items that also sit in the phone's bottom bar.
const GROUPS: { title: string | null; items: Item[] }[] = [
  {
    title: null,
    items: [
      { href: "/dashboard", label: "Dashboard", short: "Home", icon: LayoutDashboard, roles: ADMIN_VIEW, mobile: true },
      { href: "/students", label: "Students", short: "Students", icon: Users, roles: ADMIN_VIEW, mobile: true },
    ],
  },
  {
    title: "Late arrivals",
    items: [
      { href: "/gate", label: "Gate check-in", short: "Gate", icon: DoorOpen, roles: ["ADMIN", "GATE"], mobile: true },
      { href: "/records", label: "Late records", short: "Lates", icon: ClipboardList, roles: ADMIN_VIEW, mobile: true },
    ],
  },
  {
    title: "Violations",
    items: [
      { href: "/violations/new", label: "Record violation", short: "Record", icon: FilePlus2, roles: ["ADMIN"] },
      { href: "/violations", label: "Violation register", short: "Violations", icon: ShieldAlert, roles: ADMIN_VIEW, mobile: true },
    ],
  },
  {
    title: "Trips",
    items: [
      { href: "/trips/new", label: "Plan a trip", short: "Plan", icon: MapPinPlus, roles: ["ADMIN"] },
      { href: "/trips", label: "All trips", short: "Trips", icon: Bus, roles: ADMIN_VIEW },
    ],
  },
  {
    title: "Sports",
    items: [
      { href: "/sports/trials", label: "Trials", short: "Trials", icon: ShieldHalf, roles: ADMIN_VIEW },
      { href: "/sports", label: "Events & teams", short: "Sports", icon: Trophy, roles: ADMIN_VIEW },
    ],
  },
  {
    title: "Administration",
    items: [{ href: "/settings", label: "Settings", short: "Settings", icon: Settings, roles: ["ADMIN"] }],
  },
];

type Item = {
  href: string;
  label: string;
  short: string;
  icon: typeof Users;
  roles: Role[];
  mobile?: boolean;
};

function itemsFor(role: Role): Item[] {
  return GROUPS.flatMap((g) => g.items).filter((i) => i.roles.includes(role));
}

/** The most specific item matching the current path is the active one. */
function useActiveHref(role: Role) {
  const pathname = usePathname();
  return itemsFor(role)
    .filter((i) => pathname === i.href || pathname.startsWith(`${i.href}/`))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;
}

export function SideNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const activeHref = useActiveHref(role);
  return (
    <nav className="flex flex-col gap-5">
      {GROUPS.map((group) => {
        const items = group.items.filter((i) => i.roles.includes(role));
        if (items.length === 0) return null;
        return (
          <div key={group.title ?? "main"} className="flex flex-col gap-0.5">
            {group.title && (
              <p className="px-3 pb-1.5 text-[11px] font-semibold tracking-wider text-muted uppercase">{group.title}</p>
            )}
            {items.map(({ href, label, icon: Icon }) => {
              const active = href === activeHref;
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onNavigate}
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

/** Phone header menu with the full, grouped navigation. */
export function MobileMenu({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  if (itemsFor(role).length < 2) return null;
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
        aria-expanded={open}
        className="flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2"
      >
        <Menu className="size-5" aria-hidden />
      </button>
      {/* Portalled to <body>: the blurred header would otherwise trap a fixed overlay inside it. */}
      {open &&
        createPortal(
        <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal aria-label="Menu">
          <button type="button" aria-label="Close menu" className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col bg-surface shadow-pop">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <p className="text-sm font-semibold">Menu</p>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="rounded-lg p-1.5 hover:bg-surface-2">
                <X className="size-5" aria-hidden />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <SideNav role={role} onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>,
          document.body,
        )}
    </>
  );
}

export function BottomNav({ role }: { role: Role }) {
  const activeHref = useActiveHref(role);
  const items = itemsFor(role).filter((i) => i.mobile);
  if (items.length < 2) return null;
  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
      <div className="mx-auto flex max-w-lg">
        {items.map(({ href, short, icon: Icon }) => {
          const active = href === activeHref;
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
