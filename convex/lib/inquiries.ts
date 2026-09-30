/**
 * Inquiry helpers: status changes with history + outbox, quote → order conversion.
 */
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { formatDocumentNumber } from "../../lib/domain/identifiers";
import { canTransitionInquiry, type InquiryStatus } from "../../lib/domain/inquiryStateMachine";
import { buildSearchText } from "../../lib/domain/search";
import { belgradeYear } from "../../lib/domain/time";
import { nextCounter } from "./counters";
import { fail } from "./errors";
import { emitEvent } from "./events";
import { getSettings } from "./settings";
import { bumpStatsDaily } from "./stats";
import { hashToken, randomToken } from "./tokens";
import type { Actor } from "./validators";

export const INQUIRY_STATUS_LABEL_SR: Record<InquiryStatus, string> = {
  nov: "Primljen",
  u_obradi: "U obradi",
  ponuda_poslata: "Ponuda poslata",
  prihvacena: "Prihvaćena",
  odbijena: "Zatvoren",
  istekla: "Ponuda istekla",
};

export async function setInquiryStatus(
  ctx: MutationCtx,
  inquiry: Doc<"inquiries">,
  to: InquiryStatus,
  opts: {
    actor: Actor;
    message?: string;
    visibleToCustomer?: boolean;
    staff: boolean;
    extra?: Partial<Doc<"inquiries">>;
  },
): Promise<void> {
  if (inquiry.status !== to && !canTransitionInquiry(inquiry.status, to)) {
    fail("INVALID", "Taj prelaz statusa upita nije dozvoljen.", { from: inquiry.status, to });
  }
  const now = Date.now();
  await ctx.db.patch("inquiries", inquiry._id, {
    status: to,
    updatedAt: now,
    ...(opts.staff ? { lastStaffActionAt: now, reminderLevel: 0 } : {}),
    ...(opts.staff && !inquiry.firstResponseAt ? { firstResponseAt: now } : {}),
    ...opts.extra,
  });
  if (inquiry.status !== to) {
    await ctx.db.insert("inquiryEvents", {
      inquiryId: inquiry._id,
      type: "status_changed",
      fromStatus: inquiry.status,
      toStatus: to,
      message: opts.message ?? INQUIRY_STATUS_LABEL_SR[to],
      visibleToCustomer: opts.visibleToCustomer ?? true,
      actor: opts.actor,
      at: now,
    });
    await emitEvent(ctx, {
      type: "inquiry.status_changed",
      aggregateType: "inquiry",
      aggregateId: inquiry._id,
      payload: {
        kind: "inquiry",
        inquiryId: inquiry._id,
        number: inquiry.number,
        from: inquiry.status,
        to,
      },
      dedupeKey: `inquiry.status_changed:${inquiry._id}:${to}:${now}`,
      actor: opts.actor,
    });
  }
}

export async function logInquiryEvent(
  ctx: MutationCtx,
  inquiryId: Id<"inquiries">,
  type: Doc<"inquiryEvents">["type"],
  actor: Actor,
  message: string,
  visibleToCustomer: boolean,
): Promise<void> {
  await ctx.db.insert("inquiryEvents", {
    inquiryId,
    type,
    message,
    visibleToCustomer,
    actor,
    at: Date.now(),
  });
}

export function quoteTotal(lines: readonly { quantity: number; unitPricePara: number }[]): number {
  return lines.reduce((sum, l) => sum + l.quantity * l.unitPricePara, 0);
}

export type NewInquiry = Omit<
  Doc<"inquiries">,
  | "_id"
  | "_creationTime"
  | "number"
  | "year"
  | "seq"
  | "publicTokenHash"
  | "status"
  | "reminderLevel"
  | "searchText"
  | "isDemo"
  | "updatedAt"
> & { actor: Actor };

/**
 * Inserts a validated inquiry (`nov`) with its number, capability token, `created` history
 * row, `inquiry.created` outbox event and daily stats — shared by the public form and the
 * mechanic quick-order „nepronađeni brojevi“ shortcut. Callers validate and attach photos.
 */
export async function insertInquiry(
  ctx: MutationCtx,
  input: NewInquiry,
): Promise<{ inquiryId: Id<"inquiries">; number: string; token: string }> {
  const { actor, ...fields } = input;
  const now = Date.now();
  const settings = await getSettings(ctx);
  const year = belgradeYear(now);
  const seq = await nextCounter(ctx, `inquiry:${year}`);
  const number = formatDocumentNumber(settings.brand.inquiryPrefix, year, seq);
  const token = randomToken();
  const inquiryId = await ctx.db.insert("inquiries", {
    ...fields,
    number,
    year,
    seq,
    publicTokenHash: await hashToken(token),
    status: "nov",
    reminderLevel: 0,
    searchText: buildSearchText([
      number,
      fields.contact.name,
      fields.contact.email,
      fields.contact.phone,
      fields.vin,
      fields.message.slice(0, 300),
      ...fields.requestedCodes.slice(0, 10),
    ]),
    isDemo: false,
    updatedAt: now,
  });
  await ctx.db.insert("inquiryEvents", {
    inquiryId,
    type: "created",
    toStatus: "nov",
    message: "Upit je primljen.",
    visibleToCustomer: true,
    actor,
    at: now,
  });
  await emitEvent(ctx, {
    type: "inquiry.created",
    aggregateType: "inquiry",
    aggregateId: inquiryId,
    payload: { kind: "inquiry", inquiryId, number },
    dedupeKey: `inquiry.created:${inquiryId}`,
    actor,
  });
  await bumpStatsDaily(ctx, now, { inquiriesCount: 1 });
  return { inquiryId, number, token };
}
