/**
 * Deployment environment variables (set with `npx convex env set "NAME=VALUE"`).
 * The only module that reads `process.env` in Convex functions.
 */

/**
 * Salt for hashing IP + user agent into rate-limit keys (never stored raw). Without
 * IP_HASH_SALT a salt derived from LINK_TOKEN_SECRET is used, so a deployment with the link
 * secret never falls back to the public dev constant.
 */
export function ipHashSalt(): string {
  const salt = process.env.IP_HASH_SALT?.trim();
  if (salt) return salt;
  const link = process.env.LINK_TOKEN_SECRET?.trim();
  return link ? `ip-hash|${link}` : "sklop-dev-salt";
}

export function seedAdminCredentials(): { email: string; password: string } | null {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export type EmailMode = "log" | "test" | "live";

/** `EMAIL_MODE` from the deployment (default `log`); settings may override (lib/emailConfig). */
export function emailModeFromEnv(): EmailMode | null {
  const mode = process.env.EMAIL_MODE?.trim();
  return mode === "log" || mode === "test" || mode === "live" ? mode : null;
}

/** Resend API key and webhook secret presence (values never leave this module). */
export function resendConfigured(): { apiKey: boolean; webhookSecret: boolean } {
  return {
    apiKey: Boolean(process.env.RESEND_API_KEY?.trim()),
    webhookSecret: Boolean(process.env.RESEND_WEBHOOK_SECRET?.trim()),
  };
}

/** Verified sender, e.g. `prodaja@domen.rs` or `SKLOP <prodaja@domen.rs>`; empty until live. */
export function emailFrom(): string {
  return process.env.EMAIL_FROM?.trim() ?? "";
}

const DEV_LINK_SECRET = "sklop-dev-link-secret-change-me";

/**
 * Secret for status-link tokens (lib/linkTokens). Missing ⇒ a dev value, flagged in admin —
 * but only on a local site URL: anywhere else the dev value would let anyone compute the
 * status link (contact data, address) of every order, so it fails closed instead.
 */
export function linkTokenSecret(): string {
  const secret = process.env.LINK_TOKEN_SECRET?.trim();
  if (secret) return secret;
  if (!isLocalSite()) {
    throw new Error("LINK_TOKEN_SECRET is not set on this deployment (docs/GO-LIVE-ENV.md).");
  }
  return DEV_LINK_SECRET;
}

function isLocalSite(): boolean {
  try {
    const host = new URL(siteUrl()).hostname;
    return host === "localhost" || host === "127.0.0.1" || host.endsWith(".localhost");
  } catch {
    return false;
  }
}

export function linkTokenSecretIsSet(): boolean {
  return Boolean(process.env.LINK_TOKEN_SECRET?.trim());
}

/** Public site origin used in links (status pages, e-mails). */
export function siteUrl(): string {
  return (process.env.NEXT_SITE_URL ?? process.env.SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}

/** Meta Conversions API access token (`npx convex env set META_CAPI_TOKEN …`); empty ⇒ CAPI off. */
export function metaCapiToken(): string {
  return process.env.META_CAPI_TOKEN?.trim() ?? "";
}

/** Shared secret for `POST <site>/api/revalidate` (the Next cache purge channel). */
export function revalidateSecret(): string {
  return process.env.REVALIDATE_SECRET?.trim() ?? "";
}
