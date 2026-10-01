import { cookies } from "next/headers";

import { CONSENT_COOKIE, parseConsent } from "@/lib/analytics/consent";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { ConsentGate } from "@/components/consent/ConsentGate";
import { ConsentInit } from "@/components/consent/ConsentInit";
import { ConsentPanel } from "@/components/consent/ConsentPanel";
import { AnalyticsManager } from "@/components/consent/AnalyticsManager";

/**
 * Consent + tags for storefront layouts (SEO-ADS §J6): reads `sk_consent` on the server so the
 * client starts from the same state; tag ids come from settings (all empty ⇒ nothing is ever
 * loaded).
 *
 * First visit: the banner is server-rendered markup (`ConsentPanel`, a Server Component here) —
 * part of the first HTML (no shift, no flash), working as a form post without JavaScript and
 * with no client component to hydrate. `ConsentGate` warms the interactive banner after
 * hydration and swaps it in on the first interaction (PERF-01, D287). Once a choice is on record nothing of the banner is in
 * the page: the gate loads it only when the footer reopens the settings (PERF-11).
 */
export async function ConsentRoot() {
  const [store, settings] = await Promise.all([cookies(), getSettingsPublic()]);
  const record = parseConsent(store.get(CONSENT_COOKIE)?.value);
  return (
    <>
      <ConsentInit record={record} />
      <ConsentGate firstVisit={record === null}>
        {record === null ? <ConsentPanel titleId="consent-title" descId="consent-desc" /> : null}
      </ConsentGate>
      <AnalyticsManager ids={settings.tracking} />
    </>
  );
}
