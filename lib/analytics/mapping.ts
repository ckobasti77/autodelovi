/**
 * Event map (SEO-ADS §J7): our `track()` events → GA4 ecommerce events, Google Ads
 * conversions and Meta Pixel events. Pure; the adapters (`lib/analytics/adapters.ts`) only
 * forward the results to `gtag` / `fbq`. Money is sent in RSD as decimals.
 */
import type { AnalyticsItem, TrackEvent } from "@/lib/analytics/track";

export const CURRENCY = "RSD";

const rsd = (para: number) => Math.round(para) / 100;

export function ga4Item(item: AnalyticsItem, index?: number): Record<string, unknown> {
  return {
    item_id: item.sku,
    item_name: item.name,
    item_brand: item.manufacturer,
    ...(item.system ? { item_category: item.system } : {}),
    ...(item.category ? { item_category2: item.category } : {}),
    price: rsd(item.pricePara),
    quantity: item.quantity,
    ...(index !== undefined ? { index } : {}),
  };
}

const itemsValue = (items: AnalyticsItem[]) =>
  rsd(items.reduce((sum, i) => sum + i.pricePara * i.quantity, 0));

/** GA4 event name + parameters (null when the event has no GA4 counterpart). */
export function toGa4(event: TrackEvent): [string, Record<string, unknown>] | null {
  switch (event.name) {
    case "view_item":
      return [
        "view_item",
        { currency: CURRENCY, value: itemsValue([event.item]), items: [ga4Item(event.item)] },
      ];
    case "view_item_list":
      return [
        "view_item_list",
        {
          item_list_id: event.listId,
          item_list_name: event.listName,
          items: event.items.slice(0, 50).map((i, n) => ga4Item(i, n)),
        },
      ];
    case "search":
      return ["search", { search_term: event.term, results: event.results }];
    case "add_to_cart":
      return [
        "add_to_cart",
        { currency: CURRENCY, value: itemsValue([event.item]), items: [ga4Item(event.item)] },
      ];
    case "begin_checkout":
      return [
        "begin_checkout",
        {
          currency: CURRENCY,
          value: rsd(event.valuePara),
          items: event.items.map((i) => ga4Item(i)),
        },
      ];
    case "purchase":
      return [
        "purchase",
        {
          transaction_id: event.orderNumber,
          currency: CURRENCY,
          value: rsd(event.valuePara),
          tax: rsd(event.taxPara),
          shipping: rsd(event.shippingPara),
          items: event.items.map((i) => ga4Item(i)),
        },
      ];
    case "generate_lead":
      return [
        "generate_lead",
        {
          lead_source: event.leadType,
          ...(event.valuePara !== undefined
            ? { currency: CURRENCY, value: rsd(event.valuePara) }
            : {}),
        },
      ];
    case "contact_click":
      return ["contact_click", { channel: event.channel, location: event.location }];
  }
}

export type AdsLabels = {
  purchase: string | null;
  lead: string | null;
  mechanicSignup: string | null;
};

/** Google Ads conversion (`gtag('event', 'conversion', …)`) for an event, or null. */
export function toAdsConversion(
  event: TrackEvent,
  adsId: string,
  labels: AdsLabels,
): Record<string, unknown> | null {
  const sendTo = (label: string | null) => (label ? `${adsId}/${label}` : null);
  switch (event.name) {
    case "purchase": {
      const to = sendTo(labels.purchase);
      return to
        ? {
            send_to: to,
            value: rsd(event.valuePara),
            currency: CURRENCY,
            transaction_id: event.orderNumber,
          }
        : null;
    }
    case "generate_lead": {
      const to = sendTo(
        event.leadType === "mechanic_registration"
          ? labels.mechanicSignup
          : event.leadType === "inquiry"
            ? labels.lead
            : null,
      );
      return to ? { send_to: to, transaction_id: event.leadId } : null;
    }
    default:
      return null;
  }
}

/** Meta Pixel standard event + parameters (null when the event is not sent to Meta). */
export function toMeta(event: TrackEvent): [string, Record<string, unknown>] | null {
  const contents = (items: AnalyticsItem[]) =>
    items.map((i) => ({ id: i.sku, quantity: i.quantity, item_price: rsd(i.pricePara) }));
  switch (event.name) {
    case "view_item":
      return [
        "ViewContent",
        {
          content_ids: [event.item.sku],
          content_type: "product",
          content_name: event.item.name,
          contents: contents([event.item]),
          currency: CURRENCY,
          value: itemsValue([event.item]),
        },
      ];
    case "search":
      return ["Search", { search_string: event.term }];
    case "add_to_cart":
      return [
        "AddToCart",
        {
          content_ids: [event.item.sku],
          content_type: "product",
          contents: contents([event.item]),
          currency: CURRENCY,
          value: itemsValue([event.item]),
        },
      ];
    case "begin_checkout":
      return [
        "InitiateCheckout",
        {
          content_ids: event.items.map((i) => i.sku),
          content_type: "product",
          contents: contents(event.items),
          num_items: event.items.reduce((n, i) => n + i.quantity, 0),
          currency: CURRENCY,
          value: rsd(event.valuePara),
        },
      ];
    case "purchase":
      return [
        "Purchase",
        {
          content_ids: event.items.map((i) => i.sku),
          content_type: "product",
          contents: contents(event.items),
          num_items: event.items.reduce((n, i) => n + i.quantity, 0),
          currency: CURRENCY,
          value: rsd(event.valuePara),
          order_id: event.orderNumber,
        },
      ];
    case "generate_lead":
      if (event.leadType === "mechanic_registration") {
        return [
          "CompleteRegistration",
          { content_name: "Registracija majstora", status: "pending" },
        ];
      }
      if (event.leadType === "inquiry") return ["Lead", { content_name: "Upit za deo" }];
      return null;
    case "contact_click":
      return ["Contact", { channel: event.channel }];
    default:
      return null;
  }
}

/** Meta dedup id for an event (the same id goes to the Conversions API). */
export function metaEventId(event: TrackEvent, eventId?: string): string | undefined {
  if (eventId) return eventId;
  if (event.name === "purchase") return event.orderNumber;
  if (event.name === "generate_lead") {
    return event.leadType === "mechanic_registration" ? `mech-${event.leadId}` : event.leadId;
  }
  return undefined;
}
