/**
 * HTTP security headers (docs/SECURITY.md §L3, docs/SECURITY-AUDIT.md). Pure builders shared
 * by `next.config.ts` (static headers on every response) and `proxy.ts` (the per-request
 * nonce CSP on documents). Edge/Node-safe: no Node APIs.
 */

/** Hosts the Google tag (GA4 + Google Ads, incl. Serbian google.rs) and the Meta Pixel use. */
const GOOGLE_IMG = [
  "https://*.google-analytics.com",
  "https://*.googletagmanager.com",
  "https://*.g.doubleclick.net",
  "https://www.google.com",
  "https://www.google.rs",
  "https://www.googleadservices.com",
];
const GOOGLE_CONNECT = [
  "https://*.google-analytics.com",
  "https://*.analytics.google.com",
  "https://*.googletagmanager.com",
  "https://*.g.doubleclick.net",
  "https://www.google.com",
  "https://www.google.rs",
  "https://www.googleadservices.com",
];
const GOOGLE_FRAME = ["https://td.doubleclick.net", "https://www.googletagmanager.com"];
const META_IMG = ["https://www.facebook.com"];
const META_CONNECT = ["https://www.facebook.com", "https://connect.facebook.net"];

export type CspOptions = {
  nonce: string;
  /** `next dev`: React needs `eval` for its debugging stacks. */
  dev: boolean;
  /** Served over https (adds `upgrade-insecure-requests`). */
  https: boolean;
  /** NEXT_PUBLIC_CONVEX_URL, e.g. `https://tame-impala-374.convex.cloud`. */
  convexUrl?: string | undefined;
  /** NEXT_PUBLIC_CONVEX_SITE_URL (HTTP actions). */
  convexSiteUrl?: string | undefined;
  /** NEXT_PUBLIC_SITE_URL — absolute image URLs in e-mail previews point here. */
  siteUrl?: string | undefined;
};

function origin(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return new URL(raw).origin;
  } catch {
    return null;
  }
}

/** Convex client origins (https + wss); a `*.convex.cloud` wildcard when the URL is unknown. */
function convexOrigins(convexUrl: string | undefined, convexSiteUrl: string | undefined) {
  const cloud = origin(convexUrl);
  const site = origin(convexSiteUrl);
  const http = cloud ? [cloud] : ["https://*.convex.cloud"];
  const ws = cloud ? [cloud.replace(/^http/, "ws")] : ["wss://*.convex.cloud"];
  return { http, ws, site: site ? [site] : ["https://*.convex.site"] };
}

/**
 * Nonce-based strict CSP. Scripts: only nonced ones and what they load (`strict-dynamic`
 * covers gtag.js, fbevents.js and the Next chunks); `wasm-unsafe-eval` for the meshopt
 * decoder of the 3D model; workers from blob: (meshopt) and self (Excel import); connect to
 * blob:/data: for the textures embedded in the GLB.
 * Styles allow inline (`style` attributes carry the text-reveal custom properties).
 */
export function buildCsp(opts: CspOptions): string {
  const convex = convexOrigins(opts.convexUrl, opts.convexSiteUrl);
  const site = origin(opts.siteUrl);
  const directives: [string, ...string[]][] = [
    ["default-src", "'self'"],
    [
      "script-src",
      "'self'",
      `'nonce-${opts.nonce}'`,
      "'strict-dynamic'",
      "'wasm-unsafe-eval'",
      ...(opts.dev ? ["'unsafe-eval'"] : []),
    ],
    ["style-src", "'self'", "'unsafe-inline'"],
    [
      "img-src",
      "'self'",
      "data:",
      "blob:",
      ...convex.http,
      ...(site ? [site] : []),
      ...GOOGLE_IMG,
      ...META_IMG,
    ],
    ["font-src", "'self'", "data:"],
    [
      "connect-src",
      "'self'",
      // GLTFLoader fetches the GLB's embedded textures through blob: URLs (ImageBitmapLoader).
      "blob:",
      "data:",
      ...convex.http,
      ...convex.ws,
      ...convex.site,
      ...GOOGLE_CONNECT,
      ...META_CONNECT,
    ],
    ["media-src", "'self'", "blob:"],
    ["frame-src", ...GOOGLE_FRAME, "https://www.facebook.com"],
    ["worker-src", "'self'", "blob:"],
    ["manifest-src", "'self'"],
    ["object-src", "'none'"],
    ["base-uri", "'self'"],
    ["form-action", "'self'"],
    ["frame-ancestors", "'none'"],
  ];
  const policy = directives.map((d) => d.join(" ")).join("; ");
  return opts.https ? `${policy}; upgrade-insecure-requests` : policy;
}

/** 128-bit random nonce, base64 (Web Crypto — works in the proxy runtime). */
export function createNonce(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

export type HeaderEntry = { key: string; value: string };

/** Static headers for every response (next.config.ts `headers()`). */
export function staticSecurityHeaders(production: boolean): HeaderEntry[] {
  return [
    { key: "X-Content-Type-Options", value: "nosniff" },
    { key: "X-Frame-Options", value: "DENY" },
    { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
    {
      key: "Permissions-Policy",
      value:
        "camera=(), microphone=(), geolocation=(), payment=(), usb=(), serial=(), bluetooth=(), hid=(), browsing-topics=()",
    },
    { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
    // Browsers ignore HSTS on plain http, so localhost production checks are unaffected.
    ...(production
      ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
      : []),
  ];
}

/** Capability-token routes: no Referer at all (the token is in the path). */
export const TOKEN_ROUTE_SOURCES = [
  "/porudzbina/:token/:rest*",
  "/upit/:token/:rest*",
  "/obavestenja/odjava/:token",
  "/admin/pozivnica/:token",
] as const;
