"use client";

import dynamic from "next/dynamic";

import { useConsent } from "@/lib/analytics/consentStore";
import { useLatched } from "@/lib/hooks/useLatched";

const ConsentBanner = dynamic(
  () => import("@/components/consent/ConsentBanner").then((m) => m.ConsentBanner),
  { ssr: false },
);

/**
 * Stand-in for the consent banner when the visitor has already decided (the server read the
 * cookie): renders nothing and loads the banner only when `openConsentSettings()` reopens it
 * from the footer (PERF-11). First visits get the server-rendered banner instead (D185).
 */
export function ConsentReopen() {
  const open = useConsent((s) => s.open);
  const mounted = useLatched(open);
  return mounted ? <ConsentBanner serverOpen={false} animateIn /> : null;
}
