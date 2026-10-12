import { parseMarkdown, renderInline } from "@/lib/content/markdown";
import { cn } from "@/lib/cn";
import { StackedTable } from "@/components/content/StackedTable";

type Block = ReturnType<typeof parseMarkdown>[number];

/** Reading measure of running copy: 65–72 characters of its own font (`ch` follows the size). */
const MEASURE = "max-w-[68ch]";

/** A table this early in the body is on the first screen: it gets the eager entrance. */
const EAGER_TABLE_WITHIN = 4;

/**
 * Body of a content page as parsed blocks, in two parts: what stands before the first heading
 * (the intro) and the sections. The page can then put a structured block — the delivery table,
 * the contact channels — between them, where it reads as part of the answer instead of
 * pushing the first sentence down.
 */
export function splitContent(source: string): { intro: Block[]; sections: Block[] } {
  const blocks = parseMarkdown(source);
  const first = blocks.findIndex((b) => b.kind === "heading");
  return first === -1
    ? { intro: blocks, sections: [] }
    : { intro: blocks.slice(0, first), sections: blocks.slice(first) };
}

/**
 * Reading typography of the content pages (legal texts, delivery, about). Same grammar as
 * `Markdown` in lib/content — headings, paragraphs, lists, tables, bold and links, never raw
 * HTML — with what a page of prose needs on top: copy held to the reading measure while tables
 * use the column, more space above a heading than below it (48 / 16 and 32 / 12 px), an intro
 * set as a lead on the place pages, and the eager entrance for a table near the top.
 */
export function ContentBody({
  blocks,
  lead = false,
  offset = 0,
  className,
}: {
  blocks: Block[];
  /** Paragraphs as `type-lead` (the intro of a place page). */
  lead?: boolean;
  /** Blocks rendered before these on the page (decides which table is on the first screen). */
  offset?: number;
  className?: string;
}) {
  if (blocks.length === 0) return null;
  return (
    <div className={cn("[&>:first-child]:mt-0 [&>:last-child]:mb-0", className)}>
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "heading":
            return b.level === 2 ? (
              <h2 key={i} className="mt-12 mb-4 type-h2 text-ink-1">
                {renderInline(b.text)}
              </h2>
            ) : (
              <h3 key={i} className="mt-8 mb-3 type-h3 text-ink-1">
                {renderInline(b.text)}
              </h3>
            );
          case "paragraph":
            return (
              <p
                key={i}
                className={cn("my-4 text-ink-2", MEASURE, lead ? "type-lead" : "type-body")}
              >
                {renderInline(b.text)}
              </p>
            );
          case "list": {
            const Tag = b.ordered ? "ol" : "ul";
            return (
              <Tag
                key={i}
                className={cn(
                  "my-4 flex flex-col gap-2 pl-5 type-body text-ink-2 marker:text-ink-3",
                  MEASURE,
                  b.ordered ? "list-decimal" : "list-[square]",
                )}
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
                eager={offset + i < EAGER_TABLE_WITHIN}
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
