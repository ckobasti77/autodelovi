/**
 * One analytics entry point (ARCHITECTURE §G9, SEO-ADS §J7). Every component calls `track()`;
 * adapters (gtag, Meta Pixel) plug in at step 19 behind consent. Until then the only sink is
 * an in-memory log on `window.__skTrack` that e2e tests read — nothing leaves the browser.
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
    }
  | {
      name: "generate_lead";
      leadType: "inquiry" | "mechanic_registration" | "quote_accept";
      leadId: string;
      valuePara?: number;
    }
  | { name: "contact_click"; channel: ContactChannel; location: string };

export type TrackOptions = { eventId?: string };

export type AnalyticsAdapter = (event: TrackEvent, opts: TrackOptions) => void;

type TrackLogEntry = { event: TrackEvent; eventId?: string; at: number };

declare global {
  interface Window {
    __skTrack?: TrackLogEntry[];
  }
}

const adapters: AnalyticsAdapter[] = [];
const LOG_MAX = 100;

/** Step 19 registers gtag / fbq adapters here (after consent). */
export function registerAnalyticsAdapter(adapter: AnalyticsAdapter): () => void {
  adapters.push(adapter);
  return () => {
    const i = adapters.indexOf(adapter);
    if (i >= 0) adapters.splice(i, 1);
  };
}

export function track(event: TrackEvent, opts: TrackOptions = {}): void {
  if (typeof window === "undefined") return;
  const log = (window.__skTrack ??= []);
  log.push({ event, ...(opts.eventId ? { eventId: opts.eventId } : {}), at: Date.now() });
  if (log.length > LOG_MAX) log.splice(0, log.length - LOG_MAX);
  for (const adapter of adapters) {
    try {
      adapter(event, opts);
    } catch {
      // An analytics failure must never break the shop.
    }
  }
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
