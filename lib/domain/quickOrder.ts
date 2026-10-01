/**
 * Quick-order parser (docs/ARCHITECTURE.md §E „Quick-order parser“). Turns what a mechanic
 * pastes or uploads — `1K0615301AA 2`, `5Q0 698 151 x4`, `2x 1K0-698-151`, a CSV row
 * `1K0615301AA;Disk prednji;2` — into items with a normalised code and a quantity.
 *
 * When a line is only spaced groups (`03L 115 562`), the trailing integer may be a quantity
 * or the last group of the code; the parser returns both readings as candidates and the
 * server picks the one that matches a catalogue code. Pure — shared by Next and Convex.
 *
 * A quantity the shop cannot take (`0`, more than 999) is not glued onto the code: the item
 * keeps the code, carries a clamped quantity and `requestedQuantity` with what was typed, so
 * the screen can show the part as found with a quantity error (FLOW-22, D249).
 */
import { isPlausibleOem, normalizeOem } from "./codes";

export const QUICK_ORDER_MAX_ITEMS = 200;
export const QUICK_ORDER_MAX_QTY = 999;
/** Upper bound for pasted text (≈ 200 lines of 60 characters, with room for CSV columns). */
export const QUICK_ORDER_MAX_CHARS = 40_000;

export type QuickOrderCandidate = {
  /** The code as typed (trimmed), shown back to the mechanic. */
  code: string;
  /** Normalised form used for matching (`1K0615301AA`). */
  normalized: string;
  /** Always 1–999 (clamped when the typed quantity was out of range). */
  quantity: number;
  /** The typed quantity when it was out of range (`0`, `1000`); absent when valid. */
  requestedQuantity?: number;
};

export type QuickOrderItem = {
  /** Stable key within one parse (`12` or `12.2` when a line holds several codes). */
  key: string;
  /** 1-based line number in the input. */
  lineNo: number;
  /** The source line, trimmed and capped for display. */
  raw: string;
  /** Readings in preference order (1–2); the first one is shown when nothing matches. */
  candidates: QuickOrderCandidate[];
};

export type QuickOrderParse = {
  items: QuickOrderItem[];
  /** Lines with digits that did not yield a plausible code (likely typos). */
  rejected: { lineNo: number; raw: string }[];
  /** Lines of plain text (CSV headers, descriptions) that were skipped silently. */
  ignored: number;
  /** More than `QUICK_ORDER_MAX_ITEMS` items were found; the rest was dropped. */
  truncated: boolean;
};

const CELL_SEPARATORS = /[;\t|,]+/;

/** `-`, `•`, `*` bullets and `1.` / `1)` numbering at the start of a line. */
const LIST_PREFIX = /^(?:[-–—•·▪►*>]+\s*|\d{1,3}\.\s+|\d{1,3}\)\s*)/;

const QTY_WORD = String.raw`(?:x|×|kom\.?)`;

/** `2x 1K0…`, `2 x 1K0…`, `2 kom 1K0…`, `(2) 1K0…`, `2×1K0…`. */
const LEADING_EXPLICIT = new RegExp(
  String.raw`^(?:\(\s*(\d{1,3})\s*${QTY_WORD}?\s*\)|(\d{1,3})\s*${QTY_WORD}(?=\s|\d|[A-Z])|(\d{1,3})\s*×)\s*(.+)$`,
  "i",
);

/** `… x2`, `… × 3`, `…×3`, `… 2x`, `… 2 kom.`, `… kom 2`, `… kom: 2`, `… (2)`, `… (2 kom)`. */
const TRAILING_EXPLICIT = new RegExp(
  String.raw`^(.+?)(?:\s+(?:x|×)\s*(\d{1,3})|\s*×\s*(\d{1,3})|\s+(\d{1,3})\s*${QTY_WORD}|\s+kom\.?:?\s*(\d{1,3})|\s*\(\s*(\d{1,3})\s*${QTY_WORD}?\s*\))\s*$`,
  "i",
);

/** A cell holding only a quantity: `2`, `2x`, `x2`, `2 kom`, `kom 2`. */
const QTY_ONLY = new RegExp(
  String.raw`^(?:(\d{1,3})\s*${QTY_WORD}?|(?:x|×|kom\.?:?)\s*(\d{1,3}))$`,
  "i",
);

const HAS_DIGIT = /\d/;
const HAS_ALPHANUMERIC = /[\p{L}\p{N}]/u;
const EDGE_NOISE = /^[\s:=\-–—]+|[\s:=\-–—]+$/g;

/** Codes of at least this length may be separated by plain spaces on one line. */
const MIN_SPACE_SEPARATED_CODE = 7;

function toQuantity(raw: string | undefined): number | null {
  if (raw === undefined) return null;
  const n = Number.parseInt(raw, 10);
  return Number.isInteger(n) && n >= 1 && n <= QUICK_ORDER_MAX_QTY ? n : null;
}

/** 0 → 1, 1000 → 999: the nearest quantity the shop accepts. */
export function clampQuickOrderQuantity(n: number): number {
  return Math.min(QUICK_ORDER_MAX_QTY, Math.max(1, Math.floor(n)));
}

/** The first numeric group of an explicit-quantity match, valid or not. */
function firstNumber(match: RegExpMatchArray, from: number, to = match.length): number | null {
  for (let i = from; i < to; i++) {
    if (match[i] !== undefined) return Number.parseInt(match[i]!, 10);
  }
  return null;
}

/** A reading whose quantity was typed out of range: clamped, with the typed value kept. */
function outOfRange(code: string, requested: number): QuickOrderCandidate | null {
  const c = candidate(code, clampQuickOrderQuantity(requested));
  return c ? { ...c, requestedQuantity: requested } : null;
}

/** `to` is exclusive: the leading form keeps the rest of the line in its last group. */
function firstQuantity(match: RegExpMatchArray, from: number, to = match.length): number | null {
  for (let i = from; i < to; i++) {
    const q = toQuantity(match[i]);
    if (q !== null) return q;
  }
  return null;
}

/** Drops list prefixes and a leading label without digits („OEM:“, „Br. dela:“). */
function cleanLabel(text: string): string {
  let out = text.trim().replace(LIST_PREFIX, "");
  const colon = out.lastIndexOf(":");
  if (colon >= 0 && !HAS_DIGIT.test(out.slice(0, colon))) out = out.slice(colon + 1);
  return out.replace(EDGE_NOISE, "").trim();
}

function candidate(code: string, quantity: number): QuickOrderCandidate | null {
  const trimmed = code.replace(EDGE_NOISE, "").trim();
  const normalized = normalizeOem(trimmed);
  if (!isPlausibleOem(normalized)) return null;
  return { code: trimmed.slice(0, 60), normalized, quantity };
}

function compact(list: (QuickOrderCandidate | null)[]): QuickOrderCandidate[] {
  const out: QuickOrderCandidate[] = [];
  for (const c of list) {
    if (c && !out.some((o) => o.normalized === c.normalized && o.quantity === c.quantity))
      out.push(c);
  }
  return out;
}

/**
 * Readings of one segment (a whole line without separators, or one CSV cell). Returns a
 * list of items (a segment may hold several full codes separated by spaces), each with its
 * candidate readings.
 */
function parseSegment(segment: string): QuickOrderCandidate[][] {
  const text = cleanLabel(segment);
  if (!text) return [];

  const leading = text.match(LEADING_EXPLICIT);
  if (leading) {
    const qty = firstQuantity(leading, 1, 4);
    const rest = leading[4] ?? "";
    const typed = firstNumber(leading, 1, 4);
    const c = compact([
      qty !== null ? candidate(rest, qty) : typed !== null ? outOfRange(rest, typed) : null,
    ]);
    if (c.length) return [c];
  }
  const trailing = text.match(TRAILING_EXPLICIT);
  if (trailing) {
    const qty = firstQuantity(trailing, 2);
    const typed = firstNumber(trailing, 2);
    const code = trailing[1] ?? "";
    const c = compact([
      qty !== null ? candidate(code, qty) : typed !== null ? outOfRange(code, typed) : null,
    ]);
    if (c.length) return [c];
  }

  const tokens = text.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    // Several full codes on one line: `1K0615301AA 5Q0698151`.
    const allFull = tokens.every((t) => {
      const n = normalizeOem(t);
      return n.length >= MIN_SPACE_SEPARATED_CODE && isPlausibleOem(n);
    });
    if (allFull) return tokens.map((t) => compact([candidate(t, 1)])).filter((c) => c.length);

    const last = tokens[tokens.length - 1]!;
    const lastQty = /^\d{1,3}$/.test(last) ? toQuantity(last) : null;
    if (lastQty !== null) {
      const rest = tokens.slice(0, -1).join(" ");
      const primary = candidate(rest, lastQty);
      const whole = candidate(text, 1);
      // `03L 115 562`, `N 910 845 01`: a three-digit or zero-led tail after spaced groups is
      // more likely the last group of the code than a quantity.
      const codeFirst = (tokens.length > 2 && last.length === 3) || last.startsWith("0");
      const c = compact(codeFirst ? [whole, primary] : [primary, whole]);
      if (c.length) return [c];
    } else if (/^\d{1,5}$/.test(last)) {
      // `5Q0615505R 0`, `5Q0615505R 1000`: either the last group of a code or a quantity out
      // of range. The whole code is tried first; otherwise the code with a quantity error.
      const c = compact([
        candidate(text, 1),
        outOfRange(tokens.slice(0, -1).join(" "), Number.parseInt(last, 10)),
      ]);
      if (c.length) return [c];
    }
    const first = tokens[0]!;
    const firstQty = /^\d{1,2}$/.test(first) ? toQuantity(first) : null;
    if (firstQty !== null) {
      const rest = tokens.slice(1).join(" ");
      const primary = candidate(rest, firstQty);
      const whole = candidate(text, 1);
      const c = compact(tokens.length === 2 ? [primary, whole] : [whole, primary]);
      if (c.length) return [c];
    }
  }
  const c = compact([candidate(text, 1)]);
  return c.length ? [c] : [];
}

/** A description cell („Disk prednji“, „Golf 7 TDI“): a run of ≥ 4 lowercase letters. */
function looksLikeDescription(cell: string): boolean {
  return /\p{Ll}{4,}/u.test(cell.replace(/\bkom\b\.?/gi, ""));
}

/** A strong code for secondary cells: ≥ 7 characters with at least two digits. */
function isStrongCode(c: QuickOrderCandidate): boolean {
  return (
    c.normalized.length >= MIN_SPACE_SEPARATED_CODE && (c.normalized.match(/\d/g)?.length ?? 0) >= 2
  );
}

/** Items of one line split into cells (`;`, `,`, tab, `|`) — CSV rows and comma lists. */
function parseCells(cells: string[]): QuickOrderCandidate[][] {
  const items: { candidates: QuickOrderCandidate[]; explicitQty: boolean }[] = [];
  for (const cell of cells) {
    const qtyMatch = cell.match(QTY_ONLY);
    if (qtyMatch) {
      const typedRaw = qtyMatch[1] ?? qtyMatch[2];
      const qty = toQuantity(typedRaw);
      const target = items[items.length - 1];
      if (target && !target.explicitQty && typedRaw !== undefined) {
        const typed = Number.parseInt(typedRaw, 10);
        target.candidates = target.candidates.map((c) =>
          qty !== null
            ? { ...c, quantity: qty }
            : { ...c, quantity: clampQuickOrderQuantity(typed), requestedQuantity: typed },
        );
        target.explicitQty = true;
      }
      continue;
    }
    if (looksLikeDescription(cell)) continue; // description, maker, note …
    for (const readings of parseSegment(cell)) {
      if (items.length > 0 && !isStrongCode(readings[0]!)) continue; // price, year, stock …
      items.push({ candidates: readings, explicitQty: readings.some((r) => r.quantity !== 1) });
    }
  }
  return items.map((i) => i.candidates);
}

function unquote(cell: string): string {
  return cell
    .trim()
    .replace(/^["'„“]+|["'“”]+$/g, "")
    .trim();
}

export function parseQuickOrder(text: string): QuickOrderParse {
  const items: QuickOrderItem[] = [];
  const rejected: QuickOrderParse["rejected"] = [];
  let ignored = 0;
  let truncated = false;

  const lines = text.slice(0, QUICK_ORDER_MAX_CHARS).split(/\r\n|\r|\n/);
  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i]!.trim();
    if (!raw || !HAS_ALPHANUMERIC.test(raw)) continue;
    const lineNo = i + 1;
    const cells = raw.split(CELL_SEPARATORS).map(unquote).filter(Boolean);
    const found = cells.length > 1 ? parseCells(cells) : parseSegment(raw);
    if (found.length === 0) {
      if (HAS_DIGIT.test(raw)) rejected.push({ lineNo, raw: raw.slice(0, 120) });
      else ignored++;
      continue;
    }
    found.forEach((candidates, k) => {
      if (items.length >= QUICK_ORDER_MAX_ITEMS) {
        truncated = true;
        return;
      }
      items.push({
        key: found.length > 1 ? `${lineNo}.${k + 1}` : String(lineNo),
        lineNo,
        raw: raw.slice(0, 120),
        candidates: candidates.slice(0, 2),
      });
    });
  }
  return { items, rejected, ignored, truncated };
}

/** Lines for the textarea from `?kodovi=A,B` (quantity 1 each). */
export function quickOrderTextFromCodes(codes: readonly string[]): string {
  return codes
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, QUICK_ORDER_MAX_ITEMS)
    .join("\n");
}

/** Decodes an uploaded CSV/TXT: UTF-8 (BOM stripped) or, when that fails, Windows-1250. */
export function decodeQuickOrderFile(bytes: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes).replace(/^﻿/, "");
  } catch {
    return new TextDecoder("windows-1250").decode(bytes);
  }
}
