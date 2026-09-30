/**
 * Meta Conversions API payload (SEO-ADS §J7). Pure builder shared with Convex
 * (`convex/capi.ts` sends it): hashed user data, the same `event_id` as the browser Pixel
 * (order number / inquiry number / `mech-<profileId>`) so Meta deduplicates, RSD values.
 */
import { normalizeCity, normalizeEmailForAds, normalizeName, phoneDigits, sha256Hex } from "./hash";

export const GRAPH_API_VERSION = "v26.0";

export type CapiEventName = "Purchase" | "Lead" | "CompleteRegistration";

export type CapiInput = {
  eventName: CapiEventName;
  eventId: string;
  /** Milliseconds; sent as seconds. */
  eventTimeMs: number;
  eventSourceUrl: string;
  user: {
    email?: string | null;
    phone?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    city?: string | null;
    externalId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    fbp?: string | null;
    fbc?: string | null;
  };
  custom: {
    valuePara?: number;
    contents?: { id: string; quantity: number; itemPricePara: number }[];
    orderId?: string;
    contentName?: string;
    status?: string;
  };
};

export type CapiEvent = {
  event_name: CapiEventName;
  event_time: number;
  event_id: string;
  event_source_url: string;
  action_source: "website";
  user_data: Record<string, string | string[]>;
  custom_data: Record<string, unknown>;
};

const para = (value: number) => Math.round(value) / 100;

export async function buildCapiEvent(input: CapiInput): Promise<CapiEvent> {
  const u = input.user;
  const user: Record<string, string | string[]> = {};
  if (u.email?.includes("@")) user.em = [await sha256Hex(normalizeEmailForAds(u.email))];
  const phone = u.phone ? phoneDigits(u.phone) : null;
  if (phone) user.ph = [await sha256Hex(phone)];
  if (u.firstName?.trim()) user.fn = [await sha256Hex(normalizeName(u.firstName))];
  if (u.lastName?.trim()) user.ln = [await sha256Hex(normalizeName(u.lastName))];
  if (u.city?.trim()) user.ct = [await sha256Hex(normalizeCity(u.city))];
  user.country = [await sha256Hex("rs")];
  if (u.externalId) user.external_id = [await sha256Hex(u.externalId)];
  if (u.ip) user.client_ip_address = u.ip;
  if (u.userAgent) user.client_user_agent = u.userAgent;
  if (u.fbp) user.fbp = u.fbp;
  if (u.fbc) user.fbc = u.fbc;

  const c = input.custom;
  const custom: Record<string, unknown> = {};
  if (c.valuePara !== undefined) {
    custom.currency = "RSD";
    custom.value = para(c.valuePara);
  }
  if (c.contents?.length) {
    custom.content_type = "product";
    custom.content_ids = c.contents.map((x) => x.id);
    custom.contents = c.contents.map((x) => ({
      id: x.id,
      quantity: x.quantity,
      item_price: para(x.itemPricePara),
    }));
    custom.num_items = c.contents.reduce((n, x) => n + x.quantity, 0);
  }
  if (c.orderId) custom.order_id = c.orderId;
  if (c.contentName) custom.content_name = c.contentName;
  if (c.status) custom.status = c.status;

  return {
    event_name: input.eventName,
    event_time: Math.floor(input.eventTimeMs / 1000),
    event_id: input.eventId,
    event_source_url: input.eventSourceUrl,
    action_source: "website",
    user_data: user,
    custom_data: custom,
  };
}

export function capiRequestBody(
  events: CapiEvent[],
  testEventCode?: string | null,
): { data: CapiEvent[]; test_event_code?: string } {
  return {
    data: events,
    ...(testEventCode?.trim() ? { test_event_code: testEventCode.trim() } : {}),
  };
}

export function capiUrl(pixelId: string): string {
  return `https://graph.facebook.com/${GRAPH_API_VERSION}/${encodeURIComponent(pixelId)}/events`;
}

/** `fb.1.<ms>.<fbclid>` from a captured click id when the `_fbc` cookie is missing. */
export function fbcFromClick(fbclid: string | undefined, atMs: number | undefined): string | null {
  return fbclid ? `fb.1.${Math.floor(atMs ?? Date.now())}.${fbclid}` : null;
}
