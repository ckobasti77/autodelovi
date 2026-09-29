/**
 * Domain events outbox (docs/NOTIFICATIONS.md §I1). `emitEvent` inserts the event in the
 * same transaction as the business write and schedules the dispatcher. A repeated
 * `dedupeKey` returns the existing event (idempotent emitters).
 */
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { Actor, AggregateType, EventPayload, EventType } from "./validators";

export type EmitEventInput = {
  type: EventType;
  aggregateType: AggregateType;
  aggregateId: string;
  payload: EventPayload;
  dedupeKey: string;
  actor?: Actor;
  capiContext?: { ip: string; userAgent: string; eventSourceUrl: string };
};

export async function emitEvent(
  ctx: MutationCtx,
  input: EmitEventInput,
): Promise<Id<"domainEvents">> {
  const existing = await ctx.db
    .query("domainEvents")
    .withIndex("by_dedupeKey", (q) => q.eq("dedupeKey", input.dedupeKey))
    .first();
  if (existing) return existing._id;
  const now = Date.now();
  const eventId = await ctx.db.insert("domainEvents", {
    type: input.type,
    aggregateType: input.aggregateType,
    aggregateId: input.aggregateId,
    payload: input.payload,
    status: "pending",
    attempts: 0,
    nextAttemptAt: now,
    dedupeKey: input.dedupeKey,
    ...(input.actor ? { actor: input.actor } : {}),
    ...(input.capiContext ? { capiContext: input.capiContext } : {}),
  });
  await ctx.scheduler.runAfter(0, internal.events.dispatch, { eventId });
  return eventId;
}
