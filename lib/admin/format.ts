/**
 * Admin-only formatting (DESIGN-SYSTEM §9.15): compact table dates, document numbers split
 * into prefix and sequence, elapsed working time, percent input. Pure; unit-tested.
 */
import { belgradeParts } from "@/lib/domain/time";
import { dinarsToPara } from "@/lib/format/money";

const pad2 = (n: number) => String(n).padStart(2, "0");

/** `29.09. 11:42`, with the year (`29.09.2025. 11:42`) when it is not the current year. */
export function compactDateTime(ms: number, nowMs: number = Date.now()): string {
  const p = belgradeParts(ms);
  const year = belgradeParts(nowMs).year === p.year ? "" : `${p.year}.`;
  return `${pad2(p.day)}.${pad2(p.month)}.${year} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** `29.09.` (or `29.09.2025.` outside the current year). */
export function compactDate(ms: number, nowMs: number = Date.now()): string {
  const p = belgradeParts(ms);
  const year = belgradeParts(nowMs).year === p.year ? "" : `${p.year}.`;
  return `${pad2(p.day)}.${pad2(p.month)}.${year}`;
}

/** `SK-2026-000187` → `{ prefix: "SK-2026-", seq: "000187" }` (prefix shown in ink-3). */
export function splitDocNumber(number: string): { prefix: string; seq: string } {
  const match = /^(.*-)(\d+)$/.exec(number);
  return match ? { prefix: match[1]!, seq: match[2]! } : { prefix: "", seq: number };
}

/** `2 h 14 min`, `45 min`, `3 d 2 h` — elapsed minutes for SLA timers. */
export function formatElapsed(minutes: number): string {
  const m = Math.max(0, Math.floor(minutes));
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return m % 60 ? `${h} h ${m % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

/** `pre 3 min`, `pre 2 h`, `juče`, else the compact date — for notification meta. */
export function formatAgo(ms: number, nowMs: number = Date.now()): string {
  const minutes = Math.floor((nowMs - ms) / 60_000);
  if (minutes < 1) return "upravo";
  if (minutes < 60) return `pre ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `pre ${hours} h`;
  if (hours < 48) return "juče";
  return compactDate(ms, nowMs);
}

/** „12,5“ / „12.5“ / „-3“ → 12.5; empty → undefined; anything else → NaN. */
export function parsePercent(text: string): number | undefined {
  const t = text.trim().replace("%", "").replace(",", ".").replace("−", "-").trim();
  if (!t) return undefined;
  const n = Number(t);
  return Number.isFinite(n) ? n : Number.NaN;
}

/** Basis points → „12,5 %“. */
export function formatBp(bp: number): string {
  return `${String(Math.round(bp) / 100).replace(".", ",")} %`;
}

/** Money input („12.990,50“) → para; empty → undefined; invalid → NaN. */
export function parseMoneyInput(text: string): number | undefined {
  if (!text.trim()) return undefined;
  try {
    return dinarsToPara(text);
  } catch {
    return Number.NaN;
  }
}

/** Para → editable input text without grouping („12990,5“ → „12990,50“). */
export function moneyInputValue(para: number | null | undefined): string {
  if (para === null || para === undefined) return "";
  const dinars = Math.floor(Math.abs(para) / 100);
  const cents = Math.abs(para) % 100;
  return `${para < 0 ? "-" : ""}${dinars}${cents ? `,${pad2(cents)}` : ""}`;
}

/** Margin of a VAT-inclusive retail price over a net cost, in basis points (null if unknown). */
export function marginBp(
  retailPara: number,
  costNetPara: number | null,
  vatRateBp: number,
): number | null {
  if (costNetPara === null || costNetPara <= 0 || retailPara <= 0) return null;
  const net = (retailPara * 10_000) / (10_000 + vatRateBp);
  return Math.round(((net - costNetPara) / net) * 10_000);
}

/** CSV for Excel (Serbian locale): `;` separators, quoted cells, UTF-8 BOM, CRLF. */
export function toCsv(rows: readonly (readonly (string | number | null | undefined)[])[]): string {
  const cell = (v: string | number | null | undefined) => {
    const text = v === null || v === undefined ? "" : String(v);
    return /[";\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return `﻿${rows.map((r) => r.map(cell).join(";")).join("\r\n")}`;
}

/** Triggers a browser download of a text file. */
export function downloadText(
  fileName: string,
  text: string,
  type = "text/csv;charset=utf-8",
): void {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1_000);
}

/** Engine label: seeded names already carry the power („1.9 TDI 77 kW“); others get it added. */
export function engineLabel(name: string, powerKw: number): string {
  return /\bkW\b/.test(name) ? name : `${name} · ${powerKw} kW`;
}
