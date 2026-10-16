import Link from "next/link";
import { CalendarDays, Search } from "lucide-react";
import { cx } from "@/components/ui";

/** "By month" / "Search & filter" switch shared by the records pages. */
export function ViewTabs({ basePath, view }: { basePath: string; view: "month" | "search" }) {
  const tabs = [
    { key: "month", label: "By month", href: basePath, Icon: CalendarDays },
    { key: "search", label: "Search & filter", href: `${basePath}?view=search`, Icon: Search },
  ] as const;
  return (
    <div className="no-print mb-4 inline-flex rounded-xl border border-line bg-surface p-1 shadow-card" role="tablist">
      {tabs.map(({ key, label, href, Icon }) => (
        <Link
          key={key}
          href={href}
          role="tab"
          aria-selected={view === key}
          className={cx(
            "inline-flex items-center gap-2 rounded-lg px-3.5 py-1.5 text-sm font-medium transition-colors",
            view === key ? "bg-accent-soft text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
          )}
        >
          <Icon className="size-4" aria-hidden />
          {label}
        </Link>
      ))}
    </div>
  );
}

const MONTH_VIEW_KEYS = new Set(["month", "date"]);

/** Search view when asked for, or when the URL carries any filter (old links keep working). */
export function pickView(params: Record<string, string | string[] | undefined>): "month" | "search" {
  if (params.view === "search") return "search";
  return Object.keys(params).some((k) => !MONTH_VIEW_KEYS.has(k) && k !== "view") ? "search" : "month";
}
