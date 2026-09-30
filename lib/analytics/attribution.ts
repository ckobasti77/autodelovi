/**
 * Attribution capture (SEO-ADS §J8, step 12 part). On landing we read campaign parameters and
 * the external referrer into a first-party **session** cookie `sk_attr_s` (first + last touch,
 * no personal data, never sent to third parties). Orders, inquiries and registrations send it
 * to Convex. Step 19 adds the 90-day `sk_attr` cookie after the consent choice (D114).
 */
import type { Attribution, Touch } from "@/lib/analytics/attributionTypes";

export type { Attribution, Touch } from "@/lib/analytics/attributionTypes";

export const ATTR_COOKIE = "sk_attr_s";
const MAX_VALUE = 300;
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

const clean = (value: string | null | undefined) =>
  value ? value.replace(/[\u0000-\u001f]/g, "").slice(0, MAX_VALUE) : undefined;

/** Touch from a URL + referrer; null when the visit carries no campaign signal. */
export function touchFromUrl(url: URL, referrer: string, now: number): Touch | null {
  const touch: Touch = { at: now };
  let signal = false;
  for (const [param, key] of PARAMS) {
    const value = clean(url.searchParams.get(param));
    if (value) {
      (touch as Record<string, unknown>)[key] = value;
      signal = true;
    }
  }
  if (referrer) {
    try {
      const ref = new URL(referrer);
      if (ref.host && ref.host !== url.host) {
        touch.referrer = clean(`${ref.origin}${ref.pathname}`);
        signal = true;
      }
    } catch {
      // Malformed referrer — ignore.
    }
  }
  if (!signal) return null;
  touch.landingPath = clean(url.pathname);
  return touch;
}

type Stored = { first?: Touch; last?: Touch };

function readCookie(): Stored {
  if (typeof document === "undefined") return {};
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${ATTR_COOKIE}=`))
    ?.slice(ATTR_COOKIE.length + 1);
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(decodeURIComponent(raw));
    return parsed && typeof parsed === "object" ? (parsed as Stored) : {};
  } catch {
    return {};
  }
}

function writeCookie(value: Stored): void {
  const encoded = encodeURIComponent(JSON.stringify(value));
  if (encoded.length > 3_500) return;
  const secure = location.protocol === "https:" ? "; Secure" : "";
  // Session cookie: no Max-Age/Expires (D114).
  document.cookie = `${ATTR_COOKIE}=${encoded}; Path=/; SameSite=Lax${secure}`;
}

/** Called once per page load by AttributionCapture. */
export function captureAttribution(): void {
  if (typeof window === "undefined") return;
  const touch = touchFromUrl(new URL(window.location.href), document.referrer, Date.now());
  if (!touch) return;
  const stored = readCookie();
  writeCookie({ first: stored.first ?? touch, last: touch });
}

function readFbCookie(name: "_fbp" | "_fbc"): string | undefined {
  const raw = document.cookie
    .split("; ")
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(name.length + 1);
  return clean(raw);
}

/** Attribution payload for Convex writes (undefined when nothing was captured). */
export function readAttribution(): Attribution | undefined {
  if (typeof document === "undefined") return undefined;
  const stored = readCookie();
  const fbp = readFbCookie("_fbp");
  const fbc = readFbCookie("_fbc");
  if (!stored.first && !stored.last && !fbp && !fbc) return undefined;
  return {
    ...(stored.first ? { first: sanitize(stored.first) } : {}),
    ...(stored.last ? { last: sanitize(stored.last) } : {}),
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
    // Consent Mode arrives in step 19; until then nothing is shared with ad platforms.
    consentAnalytics: false,
    consentAds: false,
  };
}

function sanitize(t: Touch): Touch {
  const out: Touch = { at: typeof t.at === "number" && Number.isFinite(t.at) ? t.at : Date.now() };
  for (const [, key] of PARAMS) {
    const value = clean(typeof t[key] === "string" ? (t[key] as string) : undefined);
    if (value) (out as Record<string, unknown>)[key] = value;
  }
  const referrer = clean(t.referrer);
  const landingPath = clean(t.landingPath);
  if (referrer) out.referrer = referrer;
  if (landingPath) out.landingPath = landingPath;
  return out;
}
