"use client";

import { useEffect } from "react";

import type { ConsentRecord } from "@/lib/analytics/consent";
import { useConsent } from "@/lib/analytics/consentStore";

/** Seeds the client consent store once from the server-read cookie. */
export function ConsentInit({ record }: { record: ConsentRecord | null }) {
  const init = useConsent((s) => s.init);
  useEffect(() => {
    init(record);
  }, [init, record]);
  return null;
}
