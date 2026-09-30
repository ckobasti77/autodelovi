"use client";

import { useEffect } from "react";

import { track } from "@/lib/analytics/track";

/** sessionStorage key for hashed Enhanced Conversions data of a lead (set by the form). */
export const leadUserDataKey = (leadId: string) => `sk_ud_${leadId}`;

/**
 * `generate_lead` once per lead id (sessionStorage guard; event id = document number). The
 * form stores the lead's hashed user data under `sk_ud_<id>` — the status page never carries
 * the visitor's e-mail or phone.
 */
export function LeadTracker({
  leadType,
  leadId,
  valuePara,
}: {
  leadType: "inquiry" | "mechanic_registration" | "quote_accept";
  leadId: string;
  valuePara?: number;
}) {
  useEffect(() => {
    const key = `sk_tracked_${leadId}`;
    let userData: Record<string, unknown> | undefined;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
      const raw = sessionStorage.getItem(leadUserDataKey(leadId));
      if (raw) {
        userData = JSON.parse(raw) as Record<string, unknown>;
        sessionStorage.removeItem(leadUserDataKey(leadId));
      }
    } catch {
      // Without storage a reload may repeat the event; acceptable.
    }
    track(
      {
        name: "generate_lead",
        leadType,
        leadId,
        ...(valuePara !== undefined ? { valuePara } : {}),
        ...(userData ? { userData } : {}),
      },
      { eventId: leadId },
    );
  }, [leadType, leadId, valuePara]);
  return null;
}
