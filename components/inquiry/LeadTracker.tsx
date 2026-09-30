"use client";

import { useEffect } from "react";

import { track } from "@/lib/analytics/track";

/** `generate_lead` once per lead id (sessionStorage guard; event id = document number). */
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
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      // Without storage a reload may repeat the event; acceptable.
    }
    track(
      { name: "generate_lead", leadType, leadId, ...(valuePara !== undefined ? { valuePara } : {}) },
      { eventId: leadId },
    );
  }, [leadType, leadId, valuePara]);
  return null;
}
