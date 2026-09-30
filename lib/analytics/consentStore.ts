"use client";

/**
 * Client consent state (SEO-ADS §J6): the current record (from the server-read cookie, then
 * from the visitor's choice) and whether the banner / settings panel is open.
 */
import { create } from "zustand";

import type { ConsentRecord } from "@/lib/analytics/consent";

type ConsentState = {
  record: ConsentRecord | null;
  /** Banner visible (first visit, or reopened from the footer). */
  open: boolean;
  /** Granular view (three categories with switches). */
  detailed: boolean;
  initialised: boolean;
  init: (record: ConsentRecord | null) => void;
  setRecord: (record: ConsentRecord) => void;
  openSettings: () => void;
  setDetailed: (detailed: boolean) => void;
};

export const useConsent = create<ConsentState>((set, get) => ({
  record: null,
  open: false,
  detailed: false,
  initialised: false,
  init: (record) => {
    if (get().initialised) return;
    set({ record, open: record === null, detailed: false, initialised: true });
  },
  setRecord: (record) => set({ record, open: false, detailed: false }),
  openSettings: () => set({ open: true, detailed: true }),
  setDetailed: (detailed) => set({ detailed }),
}));

export function openConsentSettings(): void {
  useConsent.getState().openSettings();
}
