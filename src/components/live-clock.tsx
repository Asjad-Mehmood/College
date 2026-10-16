"use client";

import { useEffect, useState } from "react";

/** Current time in the college timezone, ticking every second. */
export function LiveClock({ timeZone }: { timeZone: string }) {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const tick = () => setNow(new Date());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);
  const time = now
    ? new Intl.DateTimeFormat("en-US", { timeZone, hour: "2-digit", minute: "2-digit", second: "2-digit" }).format(now)
    : "--:--:--";
  return (
    <div className="rounded-xl border border-line bg-surface px-4 py-2 text-right shadow-card">
      <p className="text-[11px] font-medium tracking-wide text-muted uppercase">Gate time</p>
      <p className="tabular font-mono text-xl font-semibold" suppressHydrationWarning>{time}</p>
    </div>
  );
}
