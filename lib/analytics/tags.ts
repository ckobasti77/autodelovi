/**
 * Browser tag loaders (SEO-ADS §J6–§J7): `gtag.js` (GA4 + Google Ads) and Meta `fbevents.js`.
 * Nothing here runs before the consent manager decides: `declareConsentDefaults()` only
 * creates the local `dataLayer`/`gtag` queue (no request); the scripts are injected by
 * `loadGoogleTag()` / `loadMetaPixel()` after a category is granted and an id is configured.
 */
import { CONSENT_DEFAULT, consentModeState, type ConsentChoice } from "@/lib/analytics/consent";
import {
  toAdsConversion,
  toGa4,
  toMeta,
  metaEventId,
  type AdsLabels,
} from "@/lib/analytics/mapping";
import { isTokenPath, redactedPageUrl } from "@/lib/analytics/redact";
import type { AnalyticsAdapter } from "@/lib/analytics/track";

export type TagIds = {
  ga4Id: string | null;
  gadsId: string | null;
  gadsLabels: AdsLabels;
  metaPixelId: string | null;
};

type Gtag = (...args: unknown[]) => void;
type Fbq = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void;
  queue?: unknown[];
  loaded?: boolean;
  version?: string;
  push?: Fbq;
  /** Stops fbevents.js from sending its own PageView on history changes. */
  disablePushState?: boolean;
};

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: Gtag;
    fbq?: Fbq;
    _fbq?: Fbq;
  }
}

export const GTAG_SRC = "https://www.googletagmanager.com/gtag/js";
export const FBQ_SRC = "https://connect.facebook.net/en_US/fbevents.js";

function injectScript(src: string, id: string): void {
  if (document.getElementById(id)) return;
  const script = document.createElement("script");
  script.id = id;
  script.async = true;
  script.src = src;
  document.head.appendChild(script);
}

/** The gtag queue + Consent Mode defaults (idempotent, no network). */
export function declareConsentDefaults(): Gtag {
  if (!window.gtag) {
    window.dataLayer = window.dataLayer ?? [];
    window.gtag = function gtag() {
      // gtag.js reads the Arguments object, not an array — keep `arguments`.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("consent", "default", { ...CONSENT_DEFAULT });
    window.gtag("set", "ads_data_redaction", true);
    window.gtag("set", "url_passthrough", false);
  }
  return window.gtag;
}

export function updateConsentMode(choice: ConsentChoice): void {
  declareConsentDefaults()("consent", "update", consentModeState(choice));
}

let googleConfigured = { ga4: false, ads: false };

/** Page fields with capability tokens replaced (lib/analytics/redact). */
function googlePageFields(): Record<string, string> {
  const referrer = document.referrer;
  return {
    page_location: redactedPageUrl(location.href),
    ...(referrer ? { page_referrer: redactedPageUrl(referrer) } : {}),
  };
}


/** Loads gtag.js once and configures GA4 / Ads for the granted categories. */
export function loadGoogleTag(ids: TagIds, choice: ConsentChoice): boolean {
  const ga4 = choice.analytics && ids.ga4Id ? ids.ga4Id : null;
  const ads = choice.ads && ids.gadsId ? ids.gadsId : null;
  if (!ga4 && !ads) return false;
  const gtag = declareConsentDefaults();
  if (!googleConfigured.ga4 && !googleConfigured.ads) gtag("js", new Date());
  injectScript(`${GTAG_SRC}?id=${encodeURIComponent((ga4 ?? ads)!)}`, "sk-gtag");
  if (ga4 && !googleConfigured.ga4) {
    gtag("config", ga4, googlePageFields());
    googleConfigured.ga4 = true;
  }
  if (ads && !googleConfigured.ads) {
    gtag("config", ads, { allow_enhanced_conversions: true, ...googlePageFields() });
    googleConfigured.ads = true;
  }
  return true;
}

let pixelInitialised: string | null = null;

/** Meta Pixel base code (standard snippet, no inline script) — ads consent only. */
export function loadMetaPixel(pixelId: string): void {
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue!.push(args);
    } as Fbq;
    fbq.push = fbq;
    fbq.loaded = true;
    fbq.version = "2.0";
    fbq.queue = [];
    // Page views are sent by AnalyticsManager (never on token pages), not by the library.
    fbq.disablePushState = true;
    window.fbq = fbq;
    window._fbq = fbq;
  }
  injectScript(FBQ_SRC, "sk-fbq");
  window.fbq("consent", "grant");
  if (pixelInitialised !== pixelId) {
    // No automatic button-click / metadata events: they would carry the page URL.
    window.fbq("set", "autoConfig", false, pixelId);
    window.fbq("init", pixelId);
    pixelInitialised = pixelId;
  }
}

/** The Pixel sends the full page URL, which cannot be overridden — silent on token pages. */
export function metaPageView(): void {
  if (isTokenPath(location.pathname)) return;
  window.fbq?.("track", "PageView");
}

export function revokeMeta(): void {
  window.fbq?.("consent", "revoke");
}

/** GA4 (analytics consent) + Google Ads conversions (ads consent). */
export function googleAdapter(ids: TagIds, choice: ConsentChoice): AnalyticsAdapter {
  return (event) => {
    const gtag = window.gtag;
    if (!gtag) return;
    const mapped = toGa4(event);
    if (mapped && choice.analytics && ids.ga4Id)
      gtag("event", mapped[0], { ...mapped[1], send_to: ids.ga4Id });
    if (choice.ads && ids.gadsId) {
      const conversion = toAdsConversion(event, ids.gadsId, ids.gadsLabels);
      if (conversion) {
        // Enhanced Conversions: hashed e-mail/phone/name, only with ads consent (§J6).
        if ((event.name === "purchase" || event.name === "generate_lead") && event.userData) {
          gtag("set", "user_data", event.userData);
        }
        gtag("event", "conversion", conversion);
      }
    }
  };
}

export function metaAdapter(): AnalyticsAdapter {
  return (event, opts) => {
    const mapped = toMeta(event);
    if (!mapped || !window.fbq || isTokenPath(location.pathname)) return;
    const eventID = metaEventId(event, opts.eventId);
    window.fbq("track", mapped[0], mapped[1], ...(eventID ? [{ eventID }] : []));
  };
}

/** Deletes the Google/Meta cookies on this host and its parent domains. */
export function clearTrackingCookies(patterns: RegExp[]): void {
  const names = document.cookie
    .split("; ")
    .map((c) => c.split("=")[0] ?? "")
    .filter((name) => patterns.some((p) => p.test(name)));
  const parts = location.hostname.split(".");
  const domains = [""];
  for (let i = 0; i < parts.length - 1; i++) domains.push(`; domain=.${parts.slice(i).join(".")}`);
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; path=/${domain}`;
    }
  }
}

/** Test hook: forget what was configured (a new consent after revoke reconfigures). */
export function resetTagState(): void {
  googleConfigured = { ga4: false, ads: false };
  pixelInitialised = null;
}
