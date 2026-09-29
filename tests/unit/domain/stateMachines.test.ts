import { describe, expect, test } from "vitest";

import {
  canTransitionInquiry,
  canTransitionMechanic,
  checkQuoteAccept,
  INQUIRY_STATUSES,
  MECHANIC_STATUSES,
  nextInquiryStatuses,
  type InquiryStatus,
} from "@/lib/domain/inquiryStateMachine";
import {
  checkOrderTransition,
  commitsStockOn,
  isOrderStatus,
  nextOrderStatuses,
  OPEN_ORDER_STATUSES,
  ORDER_STATUSES,
  ORDER_TRANSITION_ERRORS_SR,
  orderItemsEditable,
  type OrderStatus,
} from "@/lib/domain/orderStateMachine";

const ALLOWED: Record<OrderStatus, OrderStatus[]> = {
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

describe("order state machine — every pair of states", () => {
  for (const from of ORDER_STATUSES) {
    for (const to of ORDER_STATUSES) {
      test(`${from} → ${to}`, () => {
        const allowed = ALLOWED[from].includes(to);
        // Use the delivery method the target requires, and give a reason, so only the table decides.
        const method = to === "poslata" ? "courier" : "pickup";
        const r = checkOrderTransition(from, to, { deliveryMethod: method, reason: "Razlog" });
        expect(r.ok).toBe(allowed);
        if (!r.ok) {
          const expected =
            from === to
              ? "same_status"
              : ["zavrsena", "otkazana"].includes(from)
                ? "terminal"
                : "not_allowed";
          expect(r.error).toBe(expected);
        }
      });
    }
  }
});

describe("order guards", () => {
  test("pickup-only and courier-only steps", () => {
    expect(
      checkOrderTransition("potvrdjena", "spremna_za_preuzimanje", { deliveryMethod: "courier" }),
    ).toEqual({ ok: false, error: "pickup_only" });
    expect(checkOrderTransition("potvrdjena", "poslata", { deliveryMethod: "pickup" })).toEqual({
      ok: false,
      error: "courier_only",
    });
    expect(nextOrderStatuses("potvrdjena", "pickup")).toEqual([
      "spremna_za_preuzimanje",
      "ceka_deo",
      "otkazana",
    ]);
    expect(nextOrderStatuses("potvrdjena", "courier")).toEqual(["poslata", "ceka_deo", "otkazana"]);
  });
  test("cancelling needs a reason of at least 3 characters", () => {
    expect(checkOrderTransition("nova", "otkazana", { deliveryMethod: "pickup" })).toEqual({
      ok: false,
      error: "reason_required",
    });
    expect(
      checkOrderTransition("nova", "otkazana", { deliveryMethod: "pickup", reason: " a " }),
    ).toEqual({ ok: false, error: "reason_required" });
    expect(
      checkOrderTransition("nova", "otkazana", {
        deliveryMethod: "pickup",
        reason: "Kupac odustao",
      }).ok,
    ).toBe(true);
  });
  test("helpers", () => {
    expect(commitsStockOn("potvrdjena", "confirmed")).toBe(true);
    expect(commitsStockOn("potvrdjena", "created")).toBe(false);
    expect(commitsStockOn("poslata", "confirmed")).toBe(false);
    expect(orderItemsEditable("nova")).toBe(true);
    expect(orderItemsEditable("potvrdjena")).toBe(false);
    expect(isOrderStatus("nova")).toBe(true);
    expect(isOrderStatus("new")).toBe(false);
    expect(OPEN_ORDER_STATUSES).not.toContain("zavrsena");
    expect(Object.keys(ORDER_TRANSITION_ERRORS_SR)).toHaveLength(6);
  });
});

describe("inquiry and quote machine", () => {
  const allowed: Record<InquiryStatus, InquiryStatus[]> = {
    nov: ["u_obradi", "ponuda_poslata", "odbijena"],
    u_obradi: ["ponuda_poslata", "odbijena"],
    ponuda_poslata: ["ponuda_poslata", "prihvacena", "odbijena", "istekla"],
    istekla: ["u_obradi", "ponuda_poslata", "odbijena"],
    prihvacena: [],
    odbijena: [],
  };
  test("every pair of inquiry states", () => {
    for (const from of INQUIRY_STATUSES) {
      for (const to of INQUIRY_STATUSES) {
        expect(canTransitionInquiry(from, to), `${from} → ${to}`).toBe(allowed[from].includes(to));
      }
      expect(nextInquiryStatuses(from)).toEqual(allowed[from]);
    }
  });
  test("quote acceptance", () => {
    const now = 1_000;
    expect(checkQuoteAccept({ status: "sent", validUntil: 1_000 }, now)).toEqual({ ok: true });
    expect(checkQuoteAccept({ status: "sent", validUntil: 999 }, now)).toEqual({
      ok: false,
      error: "expired",
    });
    expect(checkQuoteAccept({ status: "draft", validUntil: 5_000 }, now)).toEqual({
      ok: false,
      error: "not_sent",
    });
    expect(checkQuoteAccept({ status: "accepted", validUntil: 5_000 }, now)).toEqual({
      ok: false,
      error: "already_accepted",
    });
    expect(checkQuoteAccept({ status: "declined", validUntil: 5_000 }, now)).toEqual({
      ok: false,
      error: "declined",
    });
    expect(checkQuoteAccept({ status: "superseded", validUntil: 5_000 }, now)).toEqual({
      ok: false,
      error: "superseded",
    });
    expect(checkQuoteAccept({ status: "expired", validUntil: 5_000 }, now)).toEqual({
      ok: false,
      error: "expired",
    });
  });
  test("mechanic profile transitions", () => {
    const ok: Record<string, string[]> = {
      pending: ["approved", "rejected"],
      approved: ["suspended"],
      suspended: ["approved"],
      rejected: ["pending"],
    };
    for (const from of MECHANIC_STATUSES) {
      for (const to of MECHANIC_STATUSES) {
        expect(canTransitionMechanic(from, to), `${from} → ${to}`).toBe(ok[from].includes(to));
      }
    }
  });
});
