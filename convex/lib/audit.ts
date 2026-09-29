/**
 * Audit log (docs/DATA-MODEL.md §C11): every staff/owner write calls `audit()` in the same
 * transaction. Values are stringified and capped at 500 characters.
 */
import type { MutationCtx } from "../_generated/server";
import type { Actor } from "./validators";

export type DiffEntry = { field: string; before?: string; after?: string };

const MAX_VALUE = 500;
const MAX_DIFF = 50;

function stringify(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  const text = typeof value === "string" ? value : JSON.stringify(value);
  return text.length > MAX_VALUE ? `${text.slice(0, MAX_VALUE - 1)}…` : text;
}

/** Field-level diff of the listed keys (only fields whose value changed). */
export function diffFields(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields?: readonly string[],
): DiffEntry[] {
  const keys = fields ?? Object.keys(after);
  const out: DiffEntry[] = [];
  for (const field of keys) {
    const a = stringify(before[field]);
    const b = stringify(after[field]);
    if (a !== b)
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
