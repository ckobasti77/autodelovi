/**
 * Minimal, safe Markdown → React for staff-edited content (legal pages, FAQ answers): headings
 * (## / ###), paragraphs, `-` and `1.` lists, pipe tables, **bold** and [links](/path). No raw
 * HTML is ever interpreted. Headings left without content (e.g. an empty seller block) are
 * dropped.
 */
import { Fragment, type ReactNode } from "react";

import { RouteLink } from "@/components/ui/RouteLink";
import { StackedTable } from "@/components/content/StackedTable";
import { isSafeRelativePath } from "@/lib/domain/redirect";

type Block =
  | { kind: "heading"; level: 2 | 3; text: string }
  | { kind: "paragraph"; text: string }
  | { kind: "list"; ordered: boolean; items: string[] }
  | { kind: "table"; head: string[]; rows: string[][] };

export function parseMarkdown(md: string): Block[] {
  const blocks: Block[] = [];
  const lines = md.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  while (i < lines.length) {
    const line = lines[i].trimEnd();
    if (!line.trim()) {
      i++;
      continue;
    }
    const heading = /^(#{1,3})\s+(.*)$/.exec(line);
    if (heading) {
      blocks.push({ kind: "heading", level: heading[1].length >= 3 ? 3 : 2, text: heading[2] });
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line) || /^\s*\d+\.\s+/.test(line)) {
      const ordered = /^\s*\d+\.\s+/.test(line);
      const items: string[] = [];
      while (i < lines.length && (ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/).test(lines[i])) {
        items.push(lines[i].replace(ordered ? /^\s*\d+\.\s+/ : /^\s*[-*]\s+/, "").trim());
        i++;
      }
      blocks.push({ kind: "list", ordered, items });
      continue;
    }
    if (line.trim().startsWith("|")) {
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim().startsWith("|")) {
        const cells = lines[i]
          .trim()
          .replace(/^\||\|$/g, "")
          .split("|")
          .map((c) => c.trim());
        if (!cells.every((c) => /^:?-{2,}:?$/.test(c))) rows.push(cells);
        i++;
      }
      if (rows.length > 0) blocks.push({ kind: "table", head: rows[0], rows: rows.slice(1) });
      continue;
    }
    const para: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3})\s+/.test(lines[i]) &&
      !/^\s*([-*]|\d+\.)\s+/.test(lines[i]) &&
      !lines[i].trim().startsWith("|")
    ) {
      para.push(lines[i].trim());
      i++;
    }
    blocks.push({ kind: "paragraph", text: para.join(" ") });
  }
  // Drop headings with no content before the next heading of the same or a higher level.
  return blocks.filter((b, idx) => {
    if (b.kind !== "heading") return true;
    const next = blocks[idx + 1];
    return next !== undefined && !(next.kind === "heading" && next.level <= b.level);
  });
}

const INLINE = /(\*\*[^*]+\*\*|\[[^\]]+\]\([^)\s]+\))/g;

function safeHref(href: string): string | null {
  if (href.startsWith("/")) return isSafeRelativePath(href) ? href : null;
  if (/^https:\/\//.test(href) || /^mailto:/.test(href) || /^tel:/.test(href)) return href;
  return null;
}

export function renderInline(text: string): ReactNode {
  const parts = text.split(INLINE);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-ink-1">
          {part.slice(2, -2)}
        </strong>
      );
    }
    const link = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(part);
    if (link) {
      const href = safeHref(link[2]);
      if (!href) return <Fragment key={i}>{link[1]}</Fragment>;
      const cls =
        "text-ink-1 underline decoration-line-strong underline-offset-4 transition-control hover:decoration-accent";
      return href.startsWith("/") ? (
        <RouteLink key={i} href={href} className={cls}>
          {link[1]}
        </RouteLink>
      ) : (
        <a key={i} href={href} className={cls}>
          {link[1]}
        </a>
      );
    }
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Reading typography for content pages (`--container-reading`). */
export function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source);
  return (
    <div className={className}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading":
            return b.level === 2 ? (
              <h2 key={i} className="mt-12 mb-4 type-h2 text-ink-1 first:mt-0">
                {renderInline(b.text)}
              </h2>
            ) : (
              <h3 key={i} className="mt-8 mb-3 type-h3 text-ink-1">
                {renderInline(b.text)}
              </h3>
            );
          case "paragraph":
            return (
              <p key={i} className="my-4 type-body text-ink-2">
                {renderInline(b.text)}
              </p>
            );
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag
                key={i}
                className={`my-4 flex flex-col gap-2 pl-5 type-body text-ink-2 ${b.ordered ? "list-decimal" : "list-[square]"} marker:text-ink-3`}
              >
                {b.items.map((item, j) => (
                  <li key={j} className="pl-1">
                    {renderInline(item)}
                  </li>
                ))}
              </Tag>
            );
          }
          case "table":
            return (
              <StackedTable
                key={i}
                className="my-6"
                head={b.head.map((cell) => renderInline(cell))}
                rows={b.rows.map((row, r) => ({
                  key: String(r),
                  cells: row.map((cell) => renderInline(cell)),
                }))}
              />
            );
        }
      })}
    </div>
  );
}

/** Plain text for JSON-LD / meta descriptions (markup stripped). */
export function markdownToText(md: string): string {
  return md
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Meta description of a content page (COPY-10): whole sentences of the first paragraphs, never
 * headings, lists or tables, within `max` characters. Only a first sentence that is longer
 * than the limit on its own is cut (at a word).
 */
export function markdownDescription(md: string, max: number): string {
  const sentences = parseMarkdown(md)
    .filter((b): b is Extract<Block, { kind: "paragraph" }> => b.kind === "paragraph")
    .flatMap((b) => markdownToText(b.text).match(/[^.!?]+[.!?]+(?=\s|$)|[^.!?]+$/g) ?? [])
    .map((t) => t.trim())
    .filter(Boolean);
  let out = "";
  for (const sentence of sentences) {
    const next = out ? `${out} ${sentence}` : sentence;
    if (next.length > max) break;
    out = next;
  }
  if (out) return out;
  const first = sentences[0] ?? "";
  if (first.length <= max) return first;
  const cut = first.slice(0, max - 1);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), 1)).replace(/[\s,;:—–-]+$/, "")}…`;
}
