/**
 * Traffic source of a lead (SEO-ADS §J8): one classification shared by Convex (reports,
 * filters, offline conversions) and the admin UI. Pure and alias-free. The last touch wins,
 * the first touch is the fallback (a direct return visit keeps the campaign that brought
 * the visitor).
 */

export type TouchLike = {
  source?: string;
  medium?: string;
  campaign?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  fbclid?: string;
  msclkid?: string;
  referrer?: string;
  at?: number;
};

export type AttributionLike = { first?: TouchLike; last?: TouchLike } | null | undefined;

export type Channel =
  | "google_ads"
  | "meta_ads"
  | "microsoft_ads"
  | "organic"
  | "email"
  | "viber"
  | "campaign"
  | "referral"
  | "direct";

export const CHANNELS: readonly Channel[] = [
  "google_ads",
  "meta_ads",
  "microsoft_ads",
  "organic",
  "email",
  "viber",
  "campaign",
  "referral",
  "direct",
];

export const CHANNEL_LABEL: Readonly<Record<Channel, string>> = {
  google_ads: "Google Ads",
  meta_ads: "Meta oglasi",
  microsoft_ads: "Microsoft Ads",
  organic: "Pretraživač (organski)",
  email: "E-pošta",
  viber: "Viber",
  campaign: "Kampanja (UTM)",
  referral: "Drugi sajt",
  direct: "Direktno",
};

export type SourceInfo = {
  channel: Channel;
  source: string;
  medium: string;
  campaign: string;
};

const SEARCH_ENGINES = /(^|\.)(google|bing|yahoo|duckduckgo|yandex|ecosia|brave)\./i;

function hostOf(url: string | undefined): string {
  if (!url) return "";
  try {
    return new URL(url).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function classifyTouch(t: TouchLike | undefined): SourceInfo {
  const campaign = t?.campaign?.trim() ?? "";
  const source = t?.source?.trim().toLowerCase() ?? "";
  const medium = t?.medium?.trim().toLowerCase() ?? "";
  if (!t) return { channel: "direct", source: "(direktno)", medium: "(nema)", campaign: "" };
  if (t.gclid || t.gbraid || t.wbraid) {
    return { channel: "google_ads", source: source || "google", medium: medium || "cpc", campaign };
  }
  if (t.msclkid) {
    return {
      channel: "microsoft_ads",
      source: source || "bing",
      medium: medium || "cpc",
      campaign,
    };
  }
  if (t.fbclid && (!source || /^(meta|facebook|fb|instagram|ig)$/.test(source))) {
    return {
      channel: "meta_ads",
      source: source || "meta",
      medium: medium || "paid_social",
      campaign,
    };
  }
  if (source) {
    const channel: Channel =
      medium === "email" || source === "email"
        ? "email"
        : source === "viber"
          ? "viber"
          : (source === "google" || source === "bing") && /cpc|ppc|paid/.test(medium)
            ? source === "google"
              ? "google_ads"
              : "microsoft_ads"
            : /^(meta|facebook|fb|instagram|ig)$/.test(source) && /paid|cpc|ads/.test(medium)
              ? "meta_ads"
              : "campaign";
    return { channel, source, medium: medium || "(nema)", campaign };
  }
  const host = hostOf(t.referrer);
  if (host) {
    return SEARCH_ENGINES.test(`${host}.`) || SEARCH_ENGINES.test(host)
      ? { channel: "organic", source: host.split(".")[0] ?? host, medium: "organic", campaign: "" }
      : { channel: "referral", source: host, medium: "referral", campaign: "" };
  }
  return { channel: "direct", source: "(direktno)", medium: "(nema)", campaign: "" };
}

/** Source of a lead: the last touch, else the first, else direct. */
export function classifyAttribution(a: AttributionLike): SourceInfo {
  return classifyTouch(a?.last ?? a?.first);
}

/** Google click id of a lead (last touch first) — for the offline conversions upload. */
export function googleClickIds(a: AttributionLike): {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
} {
  const pick = (k: "gclid" | "gbraid" | "wbraid") => {
    const id = a?.last?.[k] ?? a?.first?.[k];
    return id === PRUNED_CLICK_ID ? undefined : id;
  };
  const gclid = pick("gclid");
  const gbraid = pick("gbraid");
  const wbraid = pick("wbraid");
  return {
    ...(gclid ? { gclid } : {}),
    ...(gbraid ? { gbraid } : {}),
    ...(wbraid ? { wbraid } : {}),
  };
}

// Retention (docs/SECURITY.md §L5: click ids pruned after 180 days) -----------------------

/**
 * Stored in place of a click id once its retention window has passed: the channel
 * classification (`gclid` present → Google Ads) keeps working, the identifier is gone.
 */
export const PRUNED_CLICK_ID = "pruned";

const CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid", "fbclid", "msclkid"] as const;

type PrunableAttribution = {
  first?: TouchLike;
  last?: TouchLike;
  fbp?: string;
  fbc?: string;
  gaClientId?: string;
};

function pruneTouch<T extends TouchLike>(touch: T): T {
  const out = { ...touch };
  for (const key of CLICK_ID_KEYS) if (out[key] !== undefined) out[key] = PRUNED_CLICK_ID;
  return out;
}

function touchHasIds(touch: TouchLike | undefined): boolean {
  return CLICK_ID_KEYS.some((k) => touch?.[k] !== undefined && touch[k] !== PRUNED_CLICK_ID);
}

/**
 * Attribution with click ids masked and the browser identifiers (`fbp`, `fbc`, GA client id)
 * removed; `null` when there is nothing left to prune.
 */
export function pruneAttributionIds<A extends PrunableAttribution>(a: A): A | null {
  const dirty =
    touchHasIds(a.first) ||
    touchHasIds(a.last) ||
    a.fbp !== undefined ||
    a.fbc !== undefined ||
    a.gaClientId !== undefined;
  if (!dirty) return null;
  const out: A = { ...a };
  delete out.fbp;
  delete out.fbc;
  delete out.gaClientId;
  if (a.first) out.first = pruneTouch(a.first);
  if (a.last) out.last = pruneTouch(a.last);
  return out;
}
