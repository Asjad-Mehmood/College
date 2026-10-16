"use client";

import { useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { cx } from "@/components/ui";

type Theme = "light" | "dark";

function subscribe(cb: () => void) {
  window.addEventListener("theme-change", cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  mq.addEventListener("change", cb);
  return () => {
    window.removeEventListener("theme-change", cb);
    mq.removeEventListener("change", cb);
  };
}

function current(): Theme {
  const set = document.documentElement.dataset.theme;
  if (set === "dark" || set === "light") return set;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Switches between light and dark; the choice is remembered on this device. */
export function ThemeToggle({ className }: { className?: string }) {
  const theme = useSyncExternalStore(subscribe, current, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";
  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        try {
          localStorage.setItem("theme", next);
        } catch {
          // Private mode: the theme just won't be remembered.
        }
        window.dispatchEvent(new Event("theme-change"));
      }}
      title={`Switch to ${next} mode`}
      aria-label={`Switch to ${next} mode`}
      className={cx("flex size-9 items-center justify-center rounded-lg text-ink-2 hover:bg-surface-2 hover:text-ink", className)}
    >
      {theme === "dark" ? <Sun className="size-[18px]" aria-hidden /> : <Moon className="size-[18px]" aria-hidden />}
    </button>
  );
}
