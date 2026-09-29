/**
 * Deployment environment variables (set with `npx convex env set "NAME=VALUE"`).
 * The only module that reads `process.env` in Convex functions.
 */

/** Salt for hashing IP + user agent into rate-limit keys (never stored raw). */
export function ipHashSalt(): string {
  return process.env.IP_HASH_SALT ?? "sklop-dev-salt";
}

export function seedAdminCredentials(): { email: string; password: string } | null {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) return null;
  return { email, password };
}

export type EmailMode = "log" | "test" | "live";

export function emailMode(): EmailMode {
  const mode = process.env.EMAIL_MODE;
  return mode === "test" || mode === "live" ? mode : "log";
}

/** Public site origin used in links (status pages, e-mails). */
export function siteUrl(): string {
  return (process.env.NEXT_SITE_URL ?? process.env.SITE_URL ?? "http://localhost:3000").replace(
    /\/$/,
    "",
  );
}
