"use client";

import { useEffect, useRef, useState } from "react";

/* Single-series charts. One series → one colour (the accent), no legend box:
   the card title names what is plotted. Marks: 2px line with a ~10% area
   wash, ≤24px bars with 4px rounded data-ends, hairline solid gridlines. */

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** Whole-number axis: a 1/2/5 step giving at most 5 intervals. */
function niceScale(max: number) {
  const pow = 10 ** Math.max(0, Math.floor(Math.log10(Math.max(max, 1))));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => Math.ceil(max / s) <= 5) ?? pow * 10;
  const top = Math.max(step, Math.ceil(max / step) * step);
  return { max: top, ticks: Array.from({ length: top / step + 1 }, (_, i) => i * step) };
}

export type TrendPoint = { date: string; label: string; count: number };

export function TrendChart({ data, height = 220 }: { data: TrendPoint[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const pad = { top: 16, right: 16, bottom: 28, left: 32 };
  const w = Math.max(0, width - pad.left - pad.right);
  const h = height - pad.top - pad.bottom;
  const scale = niceScale(Math.max(...data.map((d) => d.count), 1));
  const max = scale.max;
  const x = (i: number) => pad.left + (data.length <= 1 ? w / 2 : (i / (data.length - 1)) * w);
  const y = (v: number) => pad.top + h - (v / max) * h;

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(d.count).toFixed(1)}`).join(" ");
  const area = `${line} L${x(data.length - 1).toFixed(1)},${y(0)} L${x(0).toFixed(1)},${y(0)} Z`;
  const last = data.length - 1;
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(2, Math.floor(w / 70))));

  function onMove(e: React.PointerEvent<SVGRectElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const rel = (e.clientX - rect.left) / rect.width;
    setHover(Math.max(0, Math.min(last, Math.round(rel * last))));
  }

  const active = hover ?? null;
  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {width > 0 && (
        <svg width={width} height={height} role="img" aria-label="Daily late arrivals over the last 30 days" className="block">
          {scale.ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={pad.left + w} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth={1} />
              <text x={pad.left - 8} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px] tabular">
                {t}
              </text>
            </g>
          ))}
          {data.map((d, i) =>
            (i % labelEvery === 0 && last - i >= labelEvery / 2) || i === last ? (
              <text key={d.date} x={x(i)} y={height - 8} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} className="fill-muted text-[11px]">
                {d.label}
              </text>
            ) : null,
          )}
          <path d={area} fill="var(--accent)" opacity={0.1} />
          <path d={line} fill="none" stroke="var(--accent)" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
          {/* End marker + direct label on the latest value */}
          <circle cx={x(last)} cy={y(data[last].count)} r={4.5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
          {active !== null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={pad.top} y2={pad.top + h} stroke="var(--line-strong)" strokeWidth={1} />
              <circle cx={x(active)} cy={y(data[active].count)} r={5} fill="var(--accent)" stroke="var(--surface)" strokeWidth={2} />
            </g>
          )}
          <rect
            x={pad.left}
            y={pad.top}
            width={w}
            height={h}
            fill="transparent"
            onPointerMove={onMove}
            onPointerDown={onMove}
            onPointerLeave={() => setHover(null)}
          />
        </svg>
      )}
      {active !== null && width > 0 && (
        <div
          className="pointer-events-none absolute z-10 rounded-lg border border-line bg-surface px-3 py-2 text-[12px] shadow-pop"
          style={{
            left: Math.min(Math.max(x(active) - 70, 0), width - 140),
            top: Math.max(0, y(data[active].count) - 64),
            width: 140,
          }}
        >
          <p className="text-muted">{data[active].label}</p>
          <p className="flex items-center gap-1.5 font-semibold text-ink">
            <span className="inline-block h-0.5 w-3 rounded bg-accent" aria-hidden />
            {data[active].count} late
          </p>
        </div>
      )}
    </div>
  );
}

export type BarDatum = { label: string; value: number; sub?: string };

export function BarList({ data, unit = "late" }: { data: BarDatum[]; unit?: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <ul className="flex flex-col gap-3" role="list">
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        return (
          <li
            key={d.label}
            className="relative grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 sm:grid-cols-[minmax(0,12rem)_1fr]"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="truncate text-[13px] text-ink-2" title={d.label}>
              {d.label}
            </span>
            <span className="flex items-center gap-2">
              <span className="relative h-5 flex-1">
                <span
                  className="absolute inset-y-0 left-0 rounded-r-[4px] bg-accent transition-[width]"
                  style={{ width: `${Math.max(pct, d.value > 0 ? 1.5 : 0)}%`, opacity: hover === null || hover === i ? 1 : 0.55 }}
                />
              </span>
              <span className="w-8 shrink-0 text-right text-[13px] font-semibold text-ink tabular">{d.value}</span>
            </span>
            {hover === i && d.sub && (
              <span className="pointer-events-none absolute -top-9 left-1/2 z-10 rounded-lg border border-line bg-surface px-2.5 py-1.5 text-[12px] whitespace-nowrap text-ink shadow-pop">
                <span className="font-semibold">{d.value} {unit}</span> · {d.sub}
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
