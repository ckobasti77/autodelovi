import { cookies } from "next/headers";

import { CONSENT_COOKIE, parseConsent } from "@/lib/analytics/consent";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { ConsentBanner } from "@/components/consent/ConsentBanner";
import { ConsentInit } from "@/components/consent/ConsentInit";
import { ConsentReopen } from "@/components/consent/ConsentReopen";
import { AnalyticsManager } from "@/components/consent/AnalyticsManager";

/**
 * Consent + tags for storefront layouts (SEO-ADS §J6): reads `sk_consent` on the server so the
 * banner is part of the first HTML (no shift, no flash) and the client starts from the same
 * state; tag ids come from settings (all empty ⇒ nothing is ever loaded). Once a choice is on
 * record the banner module is not part of the page at all: `ConsentReopen` loads it only when
 * the footer reopens the settings (PERF-11).
 */
export async function ConsentRoot() {
  const [store, settings] = await Promise.all([cookies(), getSettingsPublic()]);
  const record = parseConsent(store.get(CONSENT_COOKIE)?.value);
  return (
    <>
      <ConsentInit record={record} />
      {record === null ? <ConsentBanner serverOpen /> : <ConsentReopen />}
      <AnalyticsManager ids={settings.tracking} />
    </>
  );
}
