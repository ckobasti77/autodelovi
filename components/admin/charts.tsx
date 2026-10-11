"use client";

/**
 * Admin charts (DESIGN-SYSTEM §3.8): one series in ink-2, the current period in accent with
 * an accent-text outline (the fill alone is 2.78:1 on white — the outline, direct labels
 * and the table view carry it), recessive grid, 12 px tabular axis labels, a hover tooltip
 * per bar and a „Prikaži tabelu“ alternative. No pies, no second axis.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";

import { cn } from "@/lib/cn";

function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => setWidth(Math.floor(entries[0]!.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

function niceMax(value: number): number {
  if (value <= 0) return 4;
  const pow = 10 ** Math.floor(Math.log10(value));
  const n = value / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return Math.max(4, step * pow);
}

export type ColumnDatum = {
  key: string;
  /** Short axis label („30.09.“). */
  label: string;
  value: number;
  /** Tooltip lines. */
  detail: string[];
  highlight?: boolean;
};

/** Vertical bars over time (orders per day). */
export function ColumnChart({
  data,
  label,
  valueLabel,
  height = 220,
  table,
}: {
  data: ColumnDatum[];
  label: string;
  valueLabel: (v: number) => string;
  height?: number;
  table: ReactNode;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const padL = 32;
  const padB = 24;
  const padT = 18;
  const max = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const plotW = Math.max(0, width - padL);
  const plotH = height - padB - padT;
  const slot = data.length ? plotW / data.length : 0;
  const barW = Math.max(3, Math.min(28, slot - 2));
  const y = (v: number) => padT + plotH - (v / max) * plotH;
  const ticks = [0, max / 2, max];
  const peak = data.reduce((best, d, i) => (d.value > (data[best]?.value ?? -1) ? i : best), 0);
  const labelEvery = Math.max(1, Math.ceil(data.length / Math.max(1, Math.floor(plotW / 44))));
  const total = data.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex flex-col gap-2">
      <div ref={ref} className="relative w-full" style={{ height }}>
        {width > 0 ? (
          <svg
            width={width}
            height={height}
            role="img"
            aria-label={`${label}: ukupno ${valueLabel(total)} za ${data.length} dana. Tabela je ispod.`}
            onMouseLeave={() => setHover(null)}
          >
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={padL}
                  x2={width}
                  y1={y(t)}
                  y2={y(t)}
                  stroke="var(--color-line-faint)"
                  strokeWidth={1}
                />
                <text
                  x={padL - 6}
                  y={y(t) + 4}
                  textAnchor="end"
                  className="fill-ink-3 text-[0.75rem] tabular-nums"
                >
                  {t % 1 === 0 ? t : t.toFixed(1)}
                </text>
              </g>
            ))}
            {data.map((d, i) => {
              const x = padL + i * slot + (slot - barW) / 2;
              const h = Math.max(d.value > 0 ? 2 : 0, padT + plotH - y(d.value));
              const showValue = d.value > 0 && (d.highlight || i === peak);
              return (
                <g key={d.key} onMouseEnter={() => setHover(i)}>
                  <rect
                    x={padL + i * slot}
                    y={padT}
                    width={slot}
                    height={plotH}
                    fill="transparent"
                  />
                  <path
                    d={`M${x},${padT + plotH} v${-Math.max(0, h - 2)} q0,-2 2,-2 h${barW - 4} q2,0 2,2 v${Math.max(0, h - 2)} z`}
                    fill={
                      d.highlight
                        ? "var(--color-accent)"
                        : hover === i
                          ? "var(--color-ink-1)"
                          : "var(--color-ink-2)"
                    }
                    stroke={d.highlight ? "var(--color-accent-text)" : "none"}
                    strokeWidth={d.highlight ? 1 : 0}
                  />
                  {showValue ? (
                    <text
                      x={x + barW / 2}
                      y={y(d.value) - 5}
                      textAnchor="middle"
                      className="fill-ink-1 text-[0.75rem] font-semibold tabular-nums"
                    >
                      {d.value}
                    </text>
                  ) : null}
                  {(i % labelEvery === 0 && data.length - 1 - i >= labelEvery) ||
                  i === data.length - 1 ? (
                    <text
                      x={i === data.length - 1 ? x + barW : x + barW / 2}
                      y={height - 6}
                      textAnchor={i === data.length - 1 ? "end" : "middle"}
                      className="fill-ink-3 text-[0.75rem] tabular-nums"
                    >
                      {d.label}
                    </text>
                  ) : null}
                </g>
              );
            })}
          </svg>
        ) : null}
        {hover !== null && data[hover] ? (
          <div
            role="presentation"
            className="pointer-events-none absolute z-raised min-w-40 rounded-sm bg-ink-1 px-3 py-2 type-caption text-bg-raised shadow-overlay"
            style={{
              left: Math.min(
                Math.max(0, padL + hover * slot + slot / 2 - 80),
                Math.max(0, width - 170),
              ),
              top: 0,
            }}
          >
            {data[hover].detail.map((line, i) => (
              <p key={i} className={cn("tabular-nums", i === 0 && "font-semibold")}>
                {line}
              </p>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        aria-expanded={showTable}
        aria-controls={tableId}
        onClick={() => setShowTable((v) => !v)}
        className="self-start cursor-pointer rounded-sm type-caption text-accent-text underline-offset-2 hover:underline focus-ring-inset"
      >
        {showTable ? "Sakrij tabelu" : "Prikaži tabelu"}
      </button>
      <div id={tableId} hidden={!showTable}>
        {table}
      </div>
    </div>
  );
}

export type BarDatum = {
  key: string;
  label: string;
  value: number;
  valueText: string;
  meta?: string;
};

/** Horizontal bars with labels and direct values (orders by category). */
export function BarList({ data, label }: { data: BarDatum[]; label: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul aria-label={label} className="flex flex-col gap-2.5">
      {data.map((d) => (
        <li
          key={d.key}
          className="grid grid-cols-[minmax(8rem,14rem)_minmax(0,1fr)_auto] items-center gap-3 type-body-s"
        >
          <span className="truncate text-ink-2">{d.label}</span>
          <span className="h-3 rounded-r-[4px] bg-surface-2" aria-hidden="true">
            <span
              className="block h-full rounded-r-[4px] bg-ink-2"
              style={{ width: `${Math.max(2, (d.value / max) * 100)}%` }}
            />
          </span>
          <span className="whitespace-nowrap text-right tabular-nums text-ink-1">
            {d.valueText}
            {d.meta ? <span className="text-ink-3"> · {d.meta}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}
