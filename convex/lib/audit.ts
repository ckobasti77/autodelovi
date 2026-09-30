/**
 * Audit log (docs/DATA-MODEL.md §C11): every staff/owner write calls `audit()` in the same
 * transaction. Values are stringified and capped at 500 characters.
 */
import type { MutationCtx } from "../_generated/server";
import type { Actor } from "./validators";

export type DiffEntry = { field: string; before?: string; after?: string };

const MAX_VALUE = 500;
const MAX_DIFF = 50;

function serialize(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  return typeof value === "string" ? value : JSON.stringify(value);
}

function cap(text: string | undefined): string | undefined {
  if (text === undefined) return undefined;
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 1)}…` : text;
}

/**
 * Field-level diff of the listed keys (only fields whose value changed). Values are compared
 * in full and only the stored strings are capped, so a change after the first 500 characters
 * (a long legal text, a settings section) still counts as a change.
 */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields?: readonly string[],
): DiffEntry[] {
  const keys = fields ?? Object.keys(after);
  const out: DiffEntry[] = [];
  for (const field of keys) {
    const full = { a: serialize(before[field]), b: serialize(after[field]) };
    const a = cap(full.a);
    const b = cap(full.b);
    if (full.a !== full.b)
      out.push({
        field,
        ...(a !== undefined ? { before: a } : {}),
        ...(b !== undefined ? { after: b } : {}),
      });
    if (out.length >= MAX_DIFF) break;
  }
  return out;
}

export async function audit(
  ctx: MutationCtx,
  entry: {
    actor: Actor;
    action: string;
    entityType: string;
    entityId: string;
    summary: string;
    diff?: DiffEntry[];
  },
): Promise<void> {
  await ctx.db.insert("auditLog", {
    actor: entry.actor,
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId,
    summary: entry.summary.slice(0, 500),
    ...(entry.diff && entry.diff.length > 0 ? { diff: entry.diff.slice(0, MAX_DIFF) } : {}),
    at: Date.now(),
  });
}
