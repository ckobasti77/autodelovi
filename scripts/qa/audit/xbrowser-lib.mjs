/**
 * Cross-browser track helpers (step 21 audit, track "xbrowser").
 * - xctx(): like kit.newContext but gives every engine a unique user agent (engine UA + suffix)
 *   so public-write rate limits are per context, and installs a CSP-violation recorder.
 * - cspLog(page): the violations recorded by the init script.
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { AUDIT_DIR, BASE, launch } from "./kit.mjs";

const defaultUa = {};
let n = 0;

export async function engineUa(browser, engine) {
  if (defaultUa[engine]) return defaultUa[engine];
  const c = await browser.newContext();
  const p = await c.newPage();
  const ua = await p.evaluate(() => navigator.userAgent);
  await c.close();
  defaultUa[engine] = ua;
  return ua;
}

export async function xctx(browser, engine, opts = {}) {
  const {
    width = 1440,
    height = 900,
    mobile = width < 1024,
    consent = true,
    reducedMotion = "no-preference",
    tag = "xb",
  } = opts;
  const base = await engineUa(browser, engine);
  const ua = `${base} SklopAudit-xb-${engine}-${tag}/${Date.now()}-${n++}`;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor: 1,
    ...(engine === "firefox" ? {} : { isMobile: mobile, hasTouch: mobile }),
    reducedMotion,
    locale: "sr-Latn-RS",
    timezoneId: "Europe/Belgrade",
    userAgent: ua,
  });
  if (consent) {
    const { hostname } = new URL(BASE);
    const value = encodeURIComponent(
      JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: `audit-xb-${tag}-0001` }),
    );
    await context.addCookies([
      { name: "sk_consent", value, domain: hostname, path: "/", httpOnly: false, secure: false, sameSite: "Lax" },
    ]);
  }
  await context.addInitScript(() => {
    window.__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => {
      window.__csp.push(`${e.violatedDirective} ${e.blockedURI} ${e.sourceFile ?? ""}:${e.lineNumber ?? ""}`);
    });
  });
  return context;
}

export async function cspLog(page) {
  try {
    return await page.evaluate(() => window.__csp ?? []);
  } catch {
    return ["<eval failed>"];
  }
}

export function saveJson(rel, data) {
  const file = path.join(AUDIT_DIR, "xbrowser", rel);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(data, null, 2));
  return file;
}

export const ENGINES = (process.env.XB_ENGINES ?? "chromium,firefox,webkit").split(",");
export const VIEWS = [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "390", width: 390, height: 844 },
];

export { launch };
