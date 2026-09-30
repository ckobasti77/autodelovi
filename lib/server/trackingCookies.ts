import "server-only";

/**
 * Server-set tracking cookies (SEO-ADS §J6, §J8): the consent record and the 90-day
 * attribution copy. Written from the consent Server Action and `POST /api/atribucija`
 * (server-set cookies are not shortened by browser tracking prevention).
 */
import type { cookies } from "next/headers";

import {
  ATTR_COOKIE,
  ATTR_MAX_AGE_S,
  ATTR_SESSION_COOKIE,
  mergeAttribution,
  parseStoredAttribution,
  serializeStoredAttribution,
} from "@/lib/analytics/attributionCookie";
import {
  CONSENT_COOKIE,
  CONSENT_MAX_AGE_S,
  CONSENT_VERSION,
  parseConsent,
  serializeConsent,
  type ConsentChoice,
  type ConsentRecord,
} from "@/lib/analytics/consent";

type CookieStore = Awaited<ReturnType<typeof cookies>>;

const secure = () =>
  process.env.NODE_ENV === "production" &&
  !/^http:\/\/localhost/.test(process.env.NEXT_PUBLIC_SITE_URL ?? "");

const base = () => ({ path: "/", sameSite: "lax" as const, secure: secure(), httpOnly: false });

export function writeConsent(store: CookieStore, choice: ConsentChoice): ConsentRecord {
  const previous = parseConsent(store.get(CONSENT_COOKIE)?.value);
  const record: ConsentRecord = {
    v: CONSENT_VERSION,
    analytics: choice.analytics,
    ads: choice.ads,
    at: Date.now(),
    id: previous?.id ?? crypto.randomUUID(),
  };
  store.set(CONSENT_COOKIE, serializeConsent(record), { ...base(), maxAge: CONSENT_MAX_AGE_S });
  if (choice.analytics || choice.ads) persistAttribution(store);
  else store.delete(ATTR_COOKIE);
  return record;
}

/** Copies the session attribution into the 90-day cookie when consent allows it. */
export function persistAttribution(store: CookieStore): boolean {
  const consent = parseConsent(store.get(CONSENT_COOKIE)?.value);
  if (!consent || (!consent.analytics && !consent.ads)) return false;
  const merged = mergeAttribution(
    parseStoredAttribution(store.get(ATTR_COOKIE)?.value),
    parseStoredAttribution(store.get(ATTR_SESSION_COOKIE)?.value),
  );
  if (!merged.first && !merged.last) return false;
  // Size check on the encoded form; Next URI-encodes the raw JSON when it sets the cookie.
  if (!serializeStoredAttribution(merged)) return false;
  store.set(ATTR_COOKIE, JSON.stringify(merged), { ...base(), maxAge: ATTR_MAX_AGE_S });
  return true;
}
