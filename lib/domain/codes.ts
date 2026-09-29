/**
 * OEM / part-number handling. Catalogue codes are stored and matched in normalised form:
 * uppercase, no spaces, dots, dashes, slashes or underscores (`1K0 615 301 AA` → `1K0615301AA`).
 * Pure — shared by Next and Convex.
 */

/** Whitespace (incl. NBSP, zero-width), dots, hyphen + Unicode dashes, slashes, underscores. */
const OEM_NOISE = /[\s\u200b-\u200d\u2060\ufeff.\-\u2010-\u2015\u2212/\\_]/g;

export function normalizeOem(input: string): string {
  return input.toUpperCase().replace(OEM_NOISE, "").trim();
}

/** Alias used by the search docs (docs/ARCHITECTURE.md §search). */
export const normalizeCode = normalizeOem;

/** 5–25 characters of A–Z / 0–9 with at least one digit. Expects `normalizeOem` output. */
export function isPlausibleOem(normalized: string): boolean {
  return /^[A-Z0-9]{5,25}$/.test(normalized) && /\d/.test(normalized);
}

/** Codes of at least this length may be separated by plain spaces on one line. */
const MIN_SPACE_SEPARATED_CODE = 7;

const SEGMENT_SEPARATORS = /[\r\n,;\t|]+/;

/** `-`, `•`, `*` bullets and `1.` / `1)` numbering at the start of a line. */
const LIST_PREFIX = /^(?:[-\u2013\u2014\u2022\u00b7\u25aa\u25ba*>]+\s*|\d{1,3}\.\s+|\d{1,3}\)\s*)/;

/** `2x `, `2 x `, `2× `, `2 kom `, `(2) ` before the code. */
const LEADING_QUANTITY =
  /^(?:\d{1,3}\s*(?:x|\u00d7|kom\.?)\s+|\d{1,3}\s*\u00d7\s*|\(\s*\d{1,3}\s*(?:x|\u00d7|kom\.?)?\s*\)\s*)/i;

/** ` x2`, ` × 3`, ` 2x`, ` 2 kom.`, ` kom 2`, ` kom: 2`, ` (2)`, ` (2 kom)` after the code. */
const TRAILING_QUANTITY =
  /(?:\s+(?:x|\u00d7)\s*\d{1,3}|\s*\u00d7\s*\d{1,3}|\s+\d{1,3}\s*(?:x|\u00d7|kom\.?)|\s+kom\.?:?\s*\d{1,3}|\s*\(\s*\d{1,3}\s*(?:x|\u00d7|kom\.?)?\s*\))\s*$/i;

const EDGE_NOISE = /^[\s:=\-\u2013\u2014]+|[\s:=\-\u2013\u2014]+$/g;

const HAS_ALPHANUMERIC = /[\p{L}\p{N}]/u;

export type ParsedOemCode = { raw: string; normalized: string };

export type ParsedOemList = {
  /** Plausible codes, de-duplicated by normalised form, in first-seen order. */
  codes: ParsedOemCode[];
  /** Non-empty segments that did not yield a plausible code (original text, trimmed). */
  rejected: string[];
};

/** Strips list prefixes, a leading label („OEM:“, „Br. dela:“) and quantity annotations. */
function cleanSegment(segment: string): string {
  let text = segment.trim().replace(LIST_PREFIX, "");
  const colon = text.lastIndexOf(":");
  if (colon >= 0 && !/\d/.test(text.slice(0, colon))) text = text.slice(colon + 1);
  text = text.trim().replace(LEADING_QUANTITY, "").replace(TRAILING_QUANTITY, "");
  return text.replace(EDGE_NOISE, "");
}

/**
 * Candidate codes within one cleaned segment. Whitespace separates codes only when every
 * token is itself a plausible full code (≥ 7 chars): `1K0615301AA 5Q0615301F` → two codes,
 * while `1K0 615 301 AA`, `03L 115 562` or `N 910 845 01` stay one spaced code.
 */
function splitCandidates(text: string): string[] {
  const tokens = text.split(/\s+/).filter(Boolean);
  const allFullCodes =
    tokens.length >= 2 &&
    tokens.every((token) => {
      const normalized = normalizeOem(token);
      return normalized.length >= MIN_SPACE_SEPARATED_CODE && isPlausibleOem(normalized);
    });
  return allFullCodes ? tokens : [text];
}

/**
 * Parses a list of codes pasted by a mechanic (Excel column, e-mail, WhatsApp, Viber).
 * Segments are split on newlines, commas, semicolons, tabs and pipes; quantities
 * (`x2`, `2x`, `× 3`, `2 kom`, `kom 2`, `(2)`) and bullets/numbering are ignored.
 */
export function parsePastedOemListDetailed(text: string): ParsedOemList {
  const codes: ParsedOemCode[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();

  for (const segment of text.split(SEGMENT_SEPARATORS)) {
    const original = segment.trim();
    // Pure punctuation („-“, „*“) is layout, not a failed code.
    if (!HAS_ALPHANUMERIC.test(original)) continue;
    const cleaned = cleanSegment(original);

    let accepted = false;
    for (const candidate of splitCandidates(cleaned)) {
      const normalized = normalizeOem(candidate);
      if (!isPlausibleOem(normalized)) continue;
      accepted = true;
      if (seen.has(normalized)) continue;
      seen.add(normalized);
      codes.push({ raw: candidate.trim(), normalized });
    }
    if (!accepted) rejected.push(original);
  }

  return { codes, rejected };
}

/** Normalised, plausible, de-duplicated codes in first-seen order. */
export function parsePastedOemList(text: string): string[] {
  return parsePastedOemListDetailed(text).codes.map((code) => code.normalized);
}

/** True when the text holds at least two codes (switch the search box to list mode). */
export function looksLikeOemList(text: string): boolean {
  return parsePastedOemList(text).length >= 2;
}
