/**
 * Guards for server-side fetches of URLs that staff paste into an import sheet (image URLs).
 * The Convex runtime cannot resolve DNS ahead of the request, so these are literal checks on
 * the host the WHATWG URL parser produced (it already normalises decimal/hex/short IPv4 forms).
 * Redirect targets must pass the same check hop by hop.
 */

/** Hosts that must never be fetched: loopback, private, link-local, reserved and internal names. */
export function isForbiddenHost(hostname: string): boolean {
  const h = hostname
    .toLowerCase()
    .replace(/^\[|\]$/g, "")
    .replace(/\.+$/, "");
  if (!h) return true;
  if (
    h === "localhost" ||
    h.endsWith(".localhost") ||
    h.endsWith(".local") ||
    h.endsWith(".internal") ||
    h.endsWith(".home.arpa")
  )
    return true;
  if (h.includes(":")) return isForbiddenIpv6(h);
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (!m) return false;
  return isForbiddenIpv4(Number(m[1]), Number(m[2]));
}

function isForbiddenIpv4(a: number, b: number): boolean {
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

/**
 * IPv6 literals: only global unicast (2000::/3) is allowed, minus 6to4 (2002::/16), which
 * embeds an IPv4 address. That rejects ::1, ::, IPv4-mapped/-compatible forms
 * (`::ffff:127.0.0.1`), fc00::/7, fe80::/10, fec0::/10 and NAT64 (64:ff9b::/96).
 */
function isForbiddenIpv6(h: string): boolean {
  if (h.startsWith("::")) return true;
  const first = Number.parseInt(h.split(":")[0] ?? "", 16);
  if (!Number.isFinite(first)) return true;
  return first < 0x2000 || first > 0x3fff || first === 0x2002;
}

/** An http(s) URL whose host may be fetched, or `null`. */
export function fetchableUrl(raw: string, base?: URL): URL | null {
  let url: URL;
  try {
    url = base ? new URL(raw, base) : new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  return isForbiddenHost(url.hostname) ? null : url;
}
