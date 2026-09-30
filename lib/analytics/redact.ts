/**
 * Capability URLs (order/inquiry status, unsubscribe, staff invite) carry a secret token in the
 * path. Analytics must never receive it (docs/SECURITY-AUDIT.md): GA4 gets the path with the
 * token replaced, and the Meta Pixel — whose page URL cannot be overridden — stays silent on
 * these pages (Meta conversions for them go through the server-side Conversions API).
 */
const TOKEN_ROUTES: readonly RegExp[] = [
  /^(\/porudzbina\/hvala\/)[A-Za-z0-9_-]{22,64}(?=\/|$)/,
  /^(\/porudzbina\/)[A-Za-z0-9_-]{22,64}(?=\/|$)/,
  /^(\/upit\/hvala\/)[A-Za-z0-9_-]{22,64}(?=\/|$)/,
  /^(\/upit\/)[A-Za-z0-9_-]{22,64}(?=\/|$)/,
  /^(\/obavestenja\/odjava\/)[^/]+/,
  /^(\/admin\/pozivnica\/)[^/]+/,
];

export const TOKEN_PLACEHOLDER = "[token]";

export function isTokenPath(pathname: string): boolean {
  return TOKEN_ROUTES.some((re) => re.test(pathname));
}

/** The path with a capability token replaced by `[token]`; other paths unchanged. */
export function redactTokenPath(pathname: string): string {
  for (const re of TOKEN_ROUTES) {
    if (re.test(pathname)) return pathname.replace(re, `$1${TOKEN_PLACEHOLDER}`);
  }
  return pathname;
}

/** Absolute URL for analytics: origin + redacted path + query (no fragment). */
export function redactedPageUrl(href: string): string {
  try {
    const url = new URL(href);
    return `${url.origin}${redactTokenPath(url.pathname)}${url.search}`;
  } catch {
    return href;
  }
}
