/**
 * Post-login redirect targets (`?next=`): only same-origin relative paths survive. A plain
 * `startsWith("/")` check is not enough — browsers read `/\evil.com` and `/\t/evil.com` as
 * protocol-relative URLs, so backslashes and control characters are rejected and the result
 * is re-resolved against a fixed origin.
 */
const PROBE_ORIGIN = "http://sklop.invalid";

export function safeNextPath(value: string | string[] | undefined, fallback: string): string {
  const next = Array.isArray(value) ? value[0] : value;
  if (!next || next.length > 512) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (/[\\\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const url = new URL(next, PROBE_ORIGIN);
    if (url.origin !== PROBE_ORIGIN) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

/** Same rule for links in owner-written content: a relative path, or `null`. */
export function isSafeRelativePath(href: string): boolean {
  return safeNextPath(href, "") === href;
}
