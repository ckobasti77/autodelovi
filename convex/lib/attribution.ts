/**
 * Server-side clamps for client-supplied attribution and consent (QA BE-03/BE-04, D222).
 * The browser builds both objects, so every entry point (orders.submit, inquiries.submit,
 * inquiries.acceptQuote, mechanics.register) normalizes them here before storing.
 */
import type { Settings } from "./settingsSchema";
import { fail } from "./errors";
import type { Attribution, Consent } from "./validators";

type Touch = NonNullable<Attribution["first"]>;

/** Printable text, trimmed and clamped (control characters dropped). */
function text(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  const clean = value
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim()
    .slice(0, max);
  return clean || undefined;
}

/** Click ids and cookie ids: a safe charset only, clamped. */
function token(value: string | undefined, max: number): string | undefined {
  if (value === undefined) return undefined;
  const clean = value.replace(/[^A-Za-z0-9._-]/g, "").slice(0, max);
  return clean || undefined;
}

function sanitizeTouch(t: Touch | undefined): Touch | undefined {
  if (!t) return undefined;
  const fields = {
    source: text(t.source, 100),
    medium: text(t.medium, 100),
    campaign: text(t.campaign, 200),
    term: text(t.term, 200),
    content: text(t.content, 200),
    gclid: token(t.gclid, 512),
    gbraid: token(t.gbraid, 512),
    wbraid: token(t.wbraid, 512),
    fbclid: token(t.fbclid, 512),
    msclkid: token(t.msclkid, 512),
    referrer: text(t.referrer, 500),
    landingPath: text(t.landingPath, 500),
  };
  const touch: Touch = { at: Number.isFinite(t.at) ? t.at : 0 };
  for (const [key, value] of Object.entries(fields) as [keyof typeof fields, string | undefined][])
    if (value !== undefined) touch[key] = value;
  return touch;
}

/** Clamps every string of a client attribution object; returns undefined when absent. */
export function sanitizeAttribution(a: Attribution | undefined): Attribution | undefined {
  if (!a) return undefined;
  const first = sanitizeTouch(a.first);
  const last = sanitizeTouch(a.last);
  // `fb.1.<ms>.<id>` — the same safe charset as click ids.
  const fbp = token(a.fbp, 255);
  const fbc = token(a.fbc, 600);
  const gaClientId = token(a.gaClientId, 100);
  return {
    ...(first ? { first } : {}),
    ...(last ? { last } : {}),
    ...(fbp ? { fbp } : {}),
    ...(fbc ? { fbc } : {}),
    ...(gaClientId ? { gaClientId } : {}),
    consentAnalytics: a.consentAnalytics,
    consentAds: a.consentAds,
  };
}

/**
 * The consent record the server stores: the legal versions in force and the server's own
 * time. Only the visitor's choices (marketing / analytics / ads) come from the client. A form
 * opened before the owner published new terms gets CONFLICT and reloads.
 */
export function consentInForce(
  settings: Pick<Settings, "legalVersions">,
  client: Consent,
  now: number,
): Consent {
  const { terms, privacy } = settings.legalVersions;
  if (client.termsVersion !== terms || client.privacyVersion !== privacy) {
    fail("CONFLICT", "Uslovi su izmenjeni — osvežite stranicu.", { field: "consent" });
  }
  return {
    termsVersion: terms,
    privacyVersion: privacy,
    acceptedAt: now,
    marketingEmail: client.marketingEmail,
    analytics: client.analytics,
    ads: client.ads,
  };
}
