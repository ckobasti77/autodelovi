/**
 * PII normalization + SHA-256 for ad platforms (SEO-ADS §J6–§J7). Shared by the browser
 * (Google Enhanced Conversions) and Convex (Meta Conversions API); WebCrypto only, no Node
 * APIs, alias-free imports. Raw values never leave the device/server unhashed.
 */

export async function sha256Hex(value: string): Promise<string> {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Trimmed, lowercase; Gmail addresses without dots in the local part (Google's rule). */
export function normalizeEmailForAds(email: string, google = false): string {
  const clean = email.trim().toLowerCase();
  if (!google) return clean;
  const [local, domain] = clean.split("@");
  if (!local || !domain) return clean;
  return domain === "gmail.com" || domain === "googlemail.com"
    ? `${local.replace(/\./g, "")}@${domain}`
    : clean;
}

/**
 * Serbian phone → digits with the country code (`381641234567`); null when it cannot be a
 * phone. Google wants E.164 with `+`, Meta digits only — see the two helpers below.
 */
export function phoneDigits(phone: string): string | null {
  let digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `381${digits.slice(1)}`;
  digits = digits.replace(/\D/g, "");
  return digits.length >= 9 && digits.length <= 15 ? digits : null;
}

export const phoneE164 = (phone: string) => {
  const d = phoneDigits(phone);
  return d ? `+${d}` : null;
};

/** Names: trimmed, lowercase, punctuation removed; Serbian letters kept (UTF-8). */
export function normalizeName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[\s.,'’"-]+/g, "");
}

/** City: lowercase without spaces or punctuation („Novi Sad“ → „novisad“). */
export function normalizeCity(city: string): string {
  return city
    .trim()
    .toLowerCase()
    .replace(/[\s.,'’"-]+/g, "");
}

export type RawUserData = {
  email?: string | null;
  phone?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  city?: string | null;
};

/** Google Enhanced Conversions `user_data` with pre-hashed fields (`sha256_*`). */
export async function googleUserData(u: RawUserData): Promise<Record<string, unknown> | null> {
  const out: Record<string, unknown> = {};
  if (u.email?.includes("@"))
    out.sha256_email_address = await sha256Hex(normalizeEmailForAds(u.email, true));
  const phone = u.phone ? phoneE164(u.phone) : null;
  if (phone) out.sha256_phone_number = await sha256Hex(phone);
  const address: Record<string, string> = {};
  if (u.firstName?.trim()) address.sha256_first_name = await sha256Hex(normalizeName(u.firstName));
  if (u.lastName?.trim()) address.sha256_last_name = await sha256Hex(normalizeName(u.lastName));
  if (Object.keys(address).length) {
    if (u.city?.trim()) address.city = u.city.trim().toLowerCase();
    address.country = "RS";
    out.address = address;
  }
  return Object.keys(out).length ? out : null;
}
