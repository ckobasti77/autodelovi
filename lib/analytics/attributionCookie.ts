/**
 * Attribution cookies (SEO-ADS §J8) — pure helpers shared by the browser module and the
 * server writers. `sk_attr_s` is the session cookie the browser writes on every landing with
 * campaign signals (no consent needed: first party, never shared); `sk_attr` is the 90-day
 * copy the server sets once the visitor granted analytics or ads cookies. First touch is
 * kept, last touch follows new campaign visits.
 */
import type { Touch } from "@/lib/analytics/attributionTypes";
import { decodeCookieJson } from "@/lib/analytics/consent";

export const ATTR_SESSION_COOKIE = "sk_attr_s";
export const ATTR_COOKIE = "sk_attr";
export const ATTR_MAX_AGE_S = 90 * 24 * 60 * 60;

export type StoredAttribution = { first?: Touch; last?: Touch };

const MAX_VALUE = 300;

export const TOUCH_KEYS = [
  "source",
  "medium",
  "campaign",
  "term",
  "content",
  "gclid",
  "gbraid",
  "wbraid",
  "fbclid",
  "msclkid",
  "referrer",
  "landingPath",
] as const satisfies readonly (keyof Touch)[];

export const cleanValue = (value: unknown): string | undefined =>
  typeof value === "string" && value
    ? value.replace(/[\u0000-\u001f]/g, "").slice(0, MAX_VALUE) || undefined
    : undefined;

export function sanitizeTouch(t: unknown): Touch | undefined {
  if (!t || typeof t !== "object") return undefined;
  const raw = t as Record<string, unknown>;
  const out: Touch = {
    at: typeof raw.at === "number" && Number.isFinite(raw.at) ? raw.at : Date.now(),
  };
  let any = false;
  for (const key of TOUCH_KEYS) {
    const value = cleanValue(raw[key]);
    if (value) {
      (out as Record<string, unknown>)[key] = value;
      any = true;
    }
  }
  return any ? out : undefined;
}

export function parseStoredAttribution(raw: string | null | undefined): StoredAttribution {
  if (!raw) return {};
  try {
    const parsed = decodeCookieJson(raw);
    if (!parsed || typeof parsed !== "object") return {};
    const p = parsed as Record<string, unknown>;
    const first = sanitizeTouch(p.first);
    const last = sanitizeTouch(p.last);
    return { ...(first ? { first } : {}), ...(last ? { last } : {}) };
  } catch {
    return {};
  }
}

/** URI-encoded JSON (browser `document.cookie`); null when too large for a cookie. */
export function serializeStoredAttribution(value: StoredAttribution): string | null {
  const encoded = encodeURIComponent(JSON.stringify(value));
  return encoded.length > 3_500 ? null : encoded;
}

/**
 * Merges the long-lived record with the session one: the oldest first touch wins, the
 * newest last touch wins.
 */
export function mergeAttribution(
  persisted: StoredAttribution,
  session: StoredAttribution,
): StoredAttribution {
  const first =
    persisted.first && session.first
      ? persisted.first.at <= session.first.at
        ? persisted.first
        : session.first
      : (persisted.first ?? session.first);
  const last =
    persisted.last && session.last
      ? persisted.last.at >= session.last.at
        ? persisted.last
        : session.last
      : (session.last ?? persisted.last);
  return { ...(first ? { first } : {}), ...(last ? { last } : {}) };
}
