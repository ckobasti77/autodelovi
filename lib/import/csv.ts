/**
 * CSV byte decoding and delimiter detection (docs/IMPORT.md §K1). Serbian accounting
 * programs export either UTF-8 (often with a BOM) or Windows-1250, with `;` as the
 * delimiter; both must keep č ć ž š đ intact. Pure (TextDecoder is available in browsers,
 * workers, Node and Convex).
 */

export type CsvEncoding = "utf-8" | "windows-1250";

export type DecodedCsv = { text: string; encoding: CsvEncoding; bom: boolean };

export function decodeCsvBytes(bytes: Uint8Array, override?: CsvEncoding): DecodedCsv {
  const bom = bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf;
  const body = bom ? bytes.subarray(3) : bytes;
  const decode = (encoding: CsvEncoding, fatal: boolean) =>
    new TextDecoder(encoding, { fatal }).decode(body).normalize("NFC");
  if (override) return { text: decode(override, false), encoding: override, bom };
  if (bom) return { text: decode("utf-8", false), encoding: "utf-8", bom };
  try {
    return { text: decode("utf-8", true), encoding: "utf-8", bom };
  } catch {
    return { text: decode("windows-1250", false), encoding: "windows-1250", bom };
  }
}

const CANDIDATES = [";", ",", "\t"] as const;
export type Delimiter = (typeof CANDIDATES)[number];

/** Counts delimiter occurrences outside double quotes, per line. */
function countOutsideQuotes(line: string, delimiter: string): number {
  let inQuotes = false;
  let count = 0;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') i++;
      else inQuotes = !inQuotes;
    } else if (!inQuotes && ch === delimiter) count++;
  }
  return count;
}

/**
 * The most consistent of `;` `,` tab over the first 20 non-empty lines: the delimiter whose
 * most common per-line count (> 0) covers the most lines; ties prefer `;`, then tab.
 */
export function detectDelimiter(text: string): Delimiter {
  const lines = text
    .split(/\r\n|\n|\r/)
    .filter((l) => l.trim() !== "")
    .slice(0, 20);
  let best: { delimiter: Delimiter; lines: number; count: number } | null = null;
  const order: Delimiter[] = [";", "\t", ","];
  for (const delimiter of order) {
    const counts = lines.map((l) => countOutsideQuotes(l, delimiter)).filter((c) => c > 0);
    if (counts.length === 0) continue;
    const freq = new Map<number, number>();
    for (const c of counts) freq.set(c, (freq.get(c) ?? 0) + 1);
    let modeCount = 0;
    let modeLines = 0;
    for (const [c, n] of freq) {
      if (n > modeLines || (n === modeLines && c > modeCount)) {
        modeLines = n;
        modeCount = c;
      }
    }
    if (!best || modeLines > best.lines || (modeLines === best.lines && modeCount > best.count)) {
      best = { delimiter, lines: modeLines, count: modeCount };
    }
  }
  return best?.delimiter ?? ";";
}

/** Minimal Windows-1250 encoder for the characters Serbian text uses (fixtures, exports). */
const CP1250: Readonly<Record<string, number>> = {
  Š: 0x8a,
  š: 0x9a,
  Ž: 0x8e,
  ž: 0x9e,
  Č: 0xc8,
  č: 0xe8,
  Ć: 0xc6,
  ć: 0xe6,
  Đ: 0xd0,
  đ: 0xf0,
  "„": 0x84,
  "“": 0x93,
  "”": 0x94,
  "–": 0x96,
  "—": 0x97,
  "×": 0xd7,
  "°": 0xb0,
  "€": 0x80,
  " ": 0xa0,
};

export function encodeWindows1250(text: string): Uint8Array {
  const out = new Uint8Array(text.length);
  let n = 0;
  for (const ch of text) {
    const code = ch.charCodeAt(0);
    if (code < 0x80) out[n++] = code;
    else if (CP1250[ch] !== undefined) out[n++] = CP1250[ch]!;
    else throw new Error(`Znak „${ch}“ ne postoji u kodnoj strani Windows-1250.`);
  }
  return out.subarray(0, n);
}
