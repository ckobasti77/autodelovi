/**
 * `{{key}}` / `{{key|fallback}}` placeholders in content Markdown (convex/seedData/content.ts).
 * A required placeholder whose value is empty removes its whole sentence (COPY-03, COPY-04, D233):
 * „Porudžbine potvrđene do {{dostava.rokSlanja}} šaljemo istog dana.“ disappears while the
 * owner has not set the cut-off, the rest of the paragraph stays. A line left with nothing but a
 * list marker is removed, so an unfilled PIB never shows as „PIB: “. No visible placeholder
 * text ever reaches the page.
 */
const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|([^}]*))?\}\}/g;

/** List item, ordered item, heading or quote marker at the start of a line. */
const LINE_PREFIX = /^\s*(?:[-*+]\s+|\d+\.\s+|#{1,6}\s+|>\s*)?/;

/** Sentence end: . ! ? … followed by whitespace and the start of a new sentence. */
const SENTENCE_BREAK = /(?<=[.!?…])\s+(?=[„"(*[A-ZČĆŽŠĐ0-9])/u;

function fillSentence(sentence: string, values: Record<string, string>): string | null {
  let drop = false;
  const filled = sentence.replace(TOKEN, (_, key: string, fallback: string | undefined) => {
    const value = values[key]?.trim();
    if (value) return value;
    if (fallback !== undefined) return fallback.trim();
    drop = true;
    return "";
  });
  return drop ? null : filled;
}

export function fillPlaceholders(md: string, values: Record<string, string>): string {
  const out: string[] = [];
  for (const line of md.split("\n")) {
    if (!line.includes("{{")) {
      out.push(line);
      continue;
    }
    const prefix = LINE_PREFIX.exec(line)?.[0] ?? "";
    const kept = line
      .slice(prefix.length)
      .split(SENTENCE_BREAK)
      .map((sentence) => fillSentence(sentence, values))
      .filter((sentence): sentence is string => sentence !== null && sentence.trim() !== "");
    if (kept.length > 0) out.push(prefix + kept.join(" "));
  }
  return out.join("\n");
}
