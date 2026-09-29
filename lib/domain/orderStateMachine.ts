/**
 * Order status machine (docs/DATA-MODEL.md §C6). Pure — the Convex transition mutation
 * calls `checkOrderTransition` before every patch; the admin UI uses `nextOrderStatuses`
 * to render only legal buttons.
 */

export const ORDER_STATUSES = [
  "nova",
  "potvrdjena",
  "ceka_deo",
  "spremna_za_preuzimanje",
  "poslata",
  "preuzeta",
  "isporucena",
  "zavrsena",
  "otkazana",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type DeliveryMethod = "pickup" | "courier";

const TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  nova: ["potvrdjena", "ceka_deo", "otkazana"],
  ceka_deo: ["potvrdjena", "otkazana"],
  potvrdjena: ["spremna_za_preuzimanje", "poslata", "ceka_deo", "otkazana"],
  spremna_za_preuzimanje: ["preuzeta", "otkazana"],
  poslata: ["isporucena", "otkazana"],
  preuzeta: ["zavrsena"],
  isporucena: ["zavrsena"],
  zavrsena: [],
  otkazana: [],
};

export const TERMINAL_ORDER_STATUSES: readonly OrderStatus[] = ["zavrsena", "otkazana"];

/** Statuses in which the order still needs staff action (dashboard, reminders). */
export const OPEN_ORDER_STATUSES: readonly OrderStatus[] = ORDER_STATUSES.filter(
  (s) => !TERMINAL_ORDER_STATUSES.includes(s),
);

export type OrderTransitionContext = {
  deliveryMethod: DeliveryMethod;
  /** Required when cancelling. */
  reason?: string;
  /** Courier tracking number (recommended when shipping). */
  trackingNumber?: string;
};

export type OrderTransitionError =
  "same_status" | "terminal" | "not_allowed" | "pickup_only" | "courier_only" | "reason_required";

export type OrderTransitionCheck = { ok: true } | { ok: false; error: OrderTransitionError };

export function isOrderStatus(value: string): value is OrderStatus {
  return (ORDER_STATUSES as readonly string[]).includes(value);
}

export function checkOrderTransition(
  from: OrderStatus,
  to: OrderStatus,
  ctx: OrderTransitionContext,
): OrderTransitionCheck {
  if (from === to) return { ok: false, error: "same_status" };
  if (TERMINAL_ORDER_STATUSES.includes(from)) return { ok: false, error: "terminal" };
  if (!TRANSITIONS[from].includes(to)) return { ok: false, error: "not_allowed" };
  if (to === "spremna_za_preuzimanje" && ctx.deliveryMethod !== "pickup") {
    return { ok: false, error: "pickup_only" };
  }
  if (to === "poslata" && ctx.deliveryMethod !== "courier") {
    return { ok: false, error: "courier_only" };
  }
  if (to === "otkazana" && !(ctx.reason && ctx.reason.trim().length >= 3)) {
    return { ok: false, error: "reason_required" };
  }
  return { ok: true };
}

/** Legal next statuses for a given delivery method (reason/tracking checked on submit). */
export function nextOrderStatuses(
  from: OrderStatus,
  deliveryMethod: DeliveryMethod,
): OrderStatus[] {
  return TRANSITIONS[from].filter((to) => {
    if (to === "spremna_za_preuzimanje") return deliveryMethod === "pickup";
    if (to === "poslata") return deliveryMethod === "courier";
    return true;
  });
}

/** Stock leaves the shelf on the first entry into `potvrdjena` (setting `confirmed`). */
export function commitsStockOn(
  to: OrderStatus,
  stockDecrementOn: "confirmed" | "created",
): boolean {
  return stockDecrementOn === "confirmed" && to === "potvrdjena";
}

/** Items (quantities, prices) may be edited only while the order is new. */
export function orderItemsEditable(status: OrderStatus): boolean {
  return status === "nova";
}

/** Timestamp field set when entering a status. */
export const ORDER_STATUS_TIMESTAMP: Partial<Record<OrderStatus, string>> = {
  potvrdjena: "confirmedAt",
  spremna_za_preuzimanje: "readyAt",
  poslata: "shippedAt",
  preuzeta: "pickedUpAt",
  isporucena: "deliveredAt",
  zavrsena: "completedAt",
  otkazana: "cancelledAt",
};

/** Serbian error messages for staff (admin toasts). */
export const ORDER_TRANSITION_ERRORS_SR: Readonly<Record<OrderTransitionError, string>> = {
  same_status: "Porudžbina je već u tom statusu.",
  terminal: "Završena ili otkazana porudžbina se više ne menja.",
  not_allowed: "Taj prelaz statusa nije dozvoljen.",
  pickup_only: "„Spremna za preuzimanje“ važi samo za lično preuzimanje.",
  courier_only: "„Poslata“ važi samo za dostavu kurirom.",
  reason_required: "Upišite razlog otkazivanja.",
};
