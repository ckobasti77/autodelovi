/**
 * One analytics entry point (ARCHITECTURE §G9, SEO-ADS §J7). Every component calls `track()`;
 * the consent manager registers the gtag / Meta Pixel adapters only after the visitor granted
 * the matching cookies (`components/consent/AnalyticsManager.tsx`). Every event is also kept
 * in an in-memory log on `window.__skTrack` (e2e tests read it); an adapter registered later
 * receives the events of the current page it has not seen yet, so a conversion that happened
 * before the consent click still counts once.
 */

export type AnalyticsItem = {
  sku: string;
  name: string;
  manufacturer: string;
  system: string;
  category: string;
  pricePara: number;
  quantity: number;
};

export type ContactChannel = "phone" | "viber" | "whatsapp" | "email";

export type TrackEvent =
  | { name: "view_item"; item: AnalyticsItem }
  | { name: "view_item_list"; listId: string; listName: string; items: AnalyticsItem[] }
  | { name: "search"; term: string; results: number }
  | { name: "add_to_cart"; item: AnalyticsItem }
  | { name: "begin_checkout"; items: AnalyticsItem[]; valuePara: number }
  | {
      name: "purchase";
      orderNumber: string;
      valuePara: number;
      shippingPara: number;
      taxPara: number;
      items: AnalyticsItem[];
      /** Pre-hashed Enhanced Conversions data (`googleUserData`); sent only with ads consent. */
      userData?: Record<string, unknown>;
    }
  | {
      name: "generate_lead";
      leadType: "inquiry" | "mechanic_registration" | "quote_accept";
      leadId: string;
      valuePara?: number;
      userData?: Record<string, unknown>;
    }
  | { name: "contact_click"; channel: ContactChannel; location: string };

export type TrackOptions = { eventId?: string };

export type AnalyticsAdapter = (event: TrackEvent, opts: TrackOptions) => void;

type TrackLogEntry = {
  event: TrackEvent;
  eventId?: string;
  at: number;
  /** Page the event happened on (replay is limited to the current page). */
  path: string;
  /** Adapters that already received it. */
  delivered: string[];
};

declare global {
  interface Window {
    __skTrack?: TrackLogEntry[];
  }
}

const adapters = new Map<string, AnalyticsAdapter>();
const LOG_MAX = 100;

function deliver(name: string, adapter: AnalyticsAdapter, entry: TrackLogEntry): void {
  if (entry.delivered.includes(name)) return;
  entry.delivered.push(name);
  try {
    adapter(entry.event, entry.eventId ? { eventId: entry.eventId } : {});
  } catch {
    // An analytics failure must never break the shop.
  }
}

/**
 * Registers a named adapter (consent manager). Events of the current page that this adapter
 * has not received yet are replayed once, in order.
 */
export function registerAnalyticsAdapter(name: string, adapter: AnalyticsAdapter): () => void {
  adapters.set(name, adapter);
  if (typeof window !== "undefined") {
    const path = window.location.pathname;
    for (const entry of window.__skTrack ?? []) {
      if (entry.path === path) deliver(name, adapter, entry);
    }
  }
  return () => {
    if (adapters.get(name) === adapter) adapters.delete(name);
  };
}

export function track(event: TrackEvent, opts: TrackOptions = {}): void {
  if (typeof window === "undefined") return;
  const log = (window.__skTrack ??= []);
  const entry: TrackLogEntry = {
    event,
    ...(opts.eventId ? { eventId: opts.eventId } : {}),
    at: Date.now(),
    path: window.location.pathname,
    delivered: [],
  };
  log.push(entry);
  if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
  for (const [name, adapter] of adapters) deliver(name, adapter, entry);
}

/** Card/product projection → analytics item. */
export function analyticsItem(input: {
  sku: string;
  name: string;
  manufacturerName: string;
  systemSlug: string;
  categorySlug?: string;
  pricePara: number | null;
  quantity?: number;
}): AnalyticsItem {
  return {
    sku: input.sku,
    name: input.name,
    manufacturer: input.manufacturerName,
    system: input.systemSlug,
    category: input.categorySlug ?? "",
    pricePara: input.pricePara ?? 0,
    quantity: input.quantity ?? 1,
  };
}
