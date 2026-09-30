/**
 * Attribution capture (SEO-ADS §J8). On landing we read campaign parameters and the external
 * referrer into the first-party **session** cookie `sk_attr_s` (first + last touch, no personal
 * data, never sent to third parties). Once the visitor granted analytics or ads cookies the
 * server keeps a 90-day copy `sk_attr` (`POST /api/atribucija`, server-set so browsers do not
 * shorten it). Orders, inquiries and registrations send the merged record + consent flags.
 */
import {
  ATTR_COOKIE,
  ATTR_SESSION_COOKIE,
  cleanValue,
  mergeAttribution,
  parseStoredAttribution,
  serializeStoredAttribution,
  type StoredAttribution,
} from "@/lib/analytics/attributionCookie";
import type { Attribution, Touch } from "@/lib/analytics/attributionTypes";
import { readConsentCookie } from "@/lib/analytics/consent";
import { fbcFromClick } from "@/lib/analytics/capi";

export type { Attribution, Touch } from "@/lib/analytics/attributionTypes";

const PARAMS: ReadonlyArray<[string, keyof Touch]> = [
  ["utm_source", "source"],
  ["utm_medium", "medium"],
  ["utm_campaign", "campaign"],
  ["utm_term", "term"],
  ["utm_content", "content"],
  ["gclid", "gclid"],
  ["gbraid", "gbraid"],
  ["wbraid", "wbraid"],
  ["fbclid", "fbclid"],
  ["msclkid", "msclkid"],
];

/** Touch from a URL + referrer; null when the visit carries no campaign signal. */
export function touchFromUrl(url: URL, referrer: string, now: number): Touch | null {
  const touch: Touch = { at: now };
  let signal = false;
  for (const [param, key] of PARAMS) {
    const value = cleanValue(url.searchParams.get(param));
    if (value) {
      (touch as Record<string, unknown>)[key] = value;
      signal = true;
    }
  }
  if (referrer) {
    try {
      const ref = new URL(referrer);
      if (ref.host && ref.host !== url.host) {
        touch.referrer = cleanValue(`${ref.origin}${ref.pathname}`);
        signal = true;
      }
    } catch {
      // Malformed referrer — ignore.
    }
  }
  if (!signal) return null;
  touch.landingPath = cleanValue(url.pathname);
  return touch;
}

function readCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  return document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function writeSessionCookie(value: StoredAttribution): void {
  const encoded = serializeStoredAttribution(value);
  if (!encoded) return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  // Session cookie: no Max-Age/Expires (D114).
  document.cookie = `${ATTR_SESSION_COOKIE}=${encoded}; Path=/; SameSite=Lax${secure}`;
}

/** Asks the server to copy the session record into the 90-day cookie (consent required). */
export function persistAttribution(): void {
  const consent = readConsentCookie();
  if (!consent || (!consent.analytics && !consent.ads)) return;
  void fetch("/api/atribucija", { method: "POST", keepalive: true }).catch(() => {
    // Best effort — the session cookie still carries the touch.
  });
}

/** Called once per page load by the shop chrome. */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  const touch = touchFromUrl(new URL(window.location.href), document.referrer, Date.now());
  if (!touch) return;
  const stored = parseStoredAttribution(readCookie(ATTR_SESSION_COOKIE));
  writeSessionCookie({ first: stored.first ?? touch, last: touch });
  persistAttribution();
}

/** Attribution payload for Convex writes (undefined when nothing was captured). */
export function readAttribution(): Attribution | undefined {
  if (typeof document === "undefined") return undefined;
  const stored = mergeAttribution(
    parseStoredAttribution(readCookie(ATTR_COOKIE)),
    parseStoredAttribution(readCookie(ATTR_SESSION_COOKIE)),
  );
  const consent = readConsentCookie();
  const fbp = cleanValue(readCookie("_fbp"));
  const clickFbc = fbcFromClick(stored.last?.fbclid ?? stored.first?.fbclid, stored.last?.at);
  const fbc = cleanValue(readCookie("_fbc")) ?? (clickFbc ? cleanValue(clickFbc) : undefined);
  const gaClientId = gaClientIdFromCookie(readCookie("_ga"));
  if (!stored.first && !stored.last && !fbp && !fbc && !gaClientId) {
    return consent ? { consentAnalytics: consent.analytics, consentAds: consent.ads } : undefined;
  }
  return {
    ...(stored.first ? { first: stored.first } : {}),
    ...(stored.last ? { last: stored.last } : {}),
    // Click ids for Meta only travel when ads cookies were granted.
    ...(fbp && consent?.ads ? { fbp } : {}),
    ...(fbc && consent?.ads ? { fbc } : {}),
    ...(gaClientId && consent?.analytics ? { gaClientId } : {}),
    consentAnalytics: consent?.analytics ?? false,
    consentAds: consent?.ads ?? false,
  };
}

/** `GA1.1.123456789.1700000000` → `123456789.1700000000`. */
export function gaClientIdFromCookie(raw: string | undefined): string | undefined {
  const m = raw ? /^GA\d\.\d\.(\d+\.\d+)$/.exec(raw) : null;
  return m ? m[1] : undefined;
}
