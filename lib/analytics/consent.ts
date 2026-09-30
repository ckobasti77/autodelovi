/**
 * Consent Mode v2 (SEO-ADS §J6) — shared, pure. The visitor's choice lives in the first-party
 * cookie `sk_consent` (`{ v, analytics, ads, at, id }`, 180 days, set by the `saveConsent`
 * Server Action). Until a category is granted no Google or Meta script is requested at all;
 * the Consent Mode defaults below are declared first either way.
 */

export const CONSENT_COOKIE = "sk_consent";
/** Bump when the cookie policy changes materially — every visitor is asked again. */
export const CONSENT_VERSION = 1;
export const CONSENT_MAX_AGE_S = 180 * 24 * 60 * 60;

export type ConsentChoice = { analytics: boolean; ads: boolean };

export type ConsentRecord = ConsentChoice & {
  v: number;
  /** Decision time (ms). */
  at: number;
  /** Random id that links the cookie to the `consentRecords` log. */
  id: string;
};

type Signal = "granted" | "denied";

export type ConsentModeState = {
  ad_storage: Signal;
  ad_user_data: Signal;
  ad_personalization: Signal;
  analytics_storage: Signal;
};

/** `gtag('consent', 'default', …)` — declared before any tag, on every page. */
export const CONSENT_DEFAULT = {
  ad_storage: "denied",
  ad_user_data: "denied",
  ad_personalization: "denied",
  analytics_storage: "denied",
  functionality_storage: "denied",
  personalization_storage: "denied",
  security_storage: "granted",
  wait_for_update: 500,
} as const;

/** `gtag('consent', 'update', …)` for a choice; ads covers user data + personalization. */
export function consentModeState(choice: ConsentChoice | null): ConsentModeState {
  const ads: Signal = choice?.ads ? "granted" : "denied";
  return {
    ad_storage: ads,
    ad_user_data: ads,
    ad_personalization: ads,
    analytics_storage: choice?.analytics ? "granted" : "denied",
  };
}

/** Raw JSON for `cookies().set` (Next URI-encodes cookie values itself). */
export function serializeConsent(record: ConsentRecord): string {
  return JSON.stringify({
    v: record.v,
    analytics: record.analytics,
    ads: record.ads,
    at: record.at,
    id: record.id,
  });
}

/** Cookie JSON as written by the browser (URI-encoded) or already decoded by the server. */
export function decodeCookieJson(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return JSON.parse(decodeURIComponent(raw));
  }
}

/** Parses the cookie value; null for a missing, malformed or outdated (policy version) record. */
export function parseConsent(raw: string | null | undefined): ConsentRecord | null {
  if (!raw) return null;
  try {
    const value = decodeCookieJson(raw);
    if (!value || typeof value !== "object") return null;
    const v = value as Record<string, unknown>;
    if (v.v !== CONSENT_VERSION) return null;
    if (typeof v.analytics !== "boolean" || typeof v.ads !== "boolean") return null;
    if (typeof v.at !== "number" || !Number.isFinite(v.at)) return null;
    if (typeof v.id !== "string" || !/^[a-z0-9-]{8,64}$/i.test(v.id)) return null;
    return { v: CONSENT_VERSION, analytics: v.analytics, ads: v.ads, at: v.at, id: v.id };
  } catch {
    return null;
  }
}

/** Reads `sk_consent` from `document.cookie` (client) — null on the server. */
export function readConsentCookie(): ConsentRecord | null {
  if (typeof document === "undefined") return null;
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${CONSENT_COOKIE}=`))
    ?.slice(CONSENT_COOKIE.length + 1);
  return parseConsent(raw);
}

/** Cookies the Google and Meta tags set; removed when consent is withdrawn. */
export const TRACKING_COOKIE_PATTERNS = [/^_ga$/, /^_ga_/, /^_gid$/, /^_gcl_/, /^_fbp$/, /^_fbc$/];
