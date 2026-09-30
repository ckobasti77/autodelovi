/**
 * Shared helpers for the step 21 QA audit (docs/qa/AUDIT.md). Every audit script imports this so
 * all tracks use the same server, consent state, scroll-through, reveal check, evidence format
 * and logins.
 *
 *   import { BASE, WIDTHS, launch, newContext, watch, scrollThrough, revealCheck, overflowX,
 *            shot, axe, loginAdmin, loginWith, convexRun } from "./kit.mjs";
 *
 * Evidence goes under docs/qa/audit/<track>/ as WebP (quality 70) so the repository stays small.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

import AxeBuilder from "@axe-core/playwright";
import { chromium, firefox, webkit } from "@playwright/test";
import sharp from "sharp";

export const BASE = process.env.AUDIT_BASE ?? "http://localhost:3100";
export const AUDIT_DIR = path.resolve("docs/qa/audit");

/** The eight review widths (step 21 prompt); heights are typical for each class of device. */
export const WIDTHS = [
  { tag: "360", width: 360, height: 780, mobile: true },
  { tag: "390", width: 390, height: 844, mobile: true },
  { tag: "768", width: 768, height: 1024, mobile: true },
  { tag: "1024", width: 1024, height: 768, mobile: false },
  { tag: "1280", width: 1280, height: 800, mobile: false },
  { tag: "1440", width: 1440, height: 900, mobile: false },
  { tag: "1920", width: 1920, height: 1080, mobile: false },
  { tag: "2560", width: 2560, height: 1440, mobile: false },
];

const ENGINES = { chromium, firefox, webkit };

/** Headless browser; Chromium gets SwiftShader WebGL like the e2e config (3D hero works). */
export async function launch(engine = "chromium") {
  const type = ENGINES[engine];
  if (!type) throw new Error(`unknown engine ${engine}`);
  return type.launch(
    engine === "chromium"
      ? { args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] }
      : {},
  );
}

let uaCounter = 0;
/**
 * A fresh context. `consent: true` (default) pre-answers the cookie banner with „Odbij sve“ so it
 * never covers the page; pass `consent: false` to audit the banner itself. Each context gets a
 * unique user-agent suffix so public-write rate limits (orders, inquiries) are per context.
 */
export async function newContext(browser, opts = {}) {
  const {
    width = 1440,
    height = 900,
    mobile = width < 1024,
    consent = true,
    reducedMotion = "no-preference",
    deviceScaleFactor = 1,
    tag = "audit",
    engine = "chromium",
  } = opts;
  const ua = `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 SklopAudit-${tag}/${Date.now()}-${uaCounter++}`;
  const context = await browser.newContext({
    viewport: { width, height },
    deviceScaleFactor,
    // Firefox does not support isMobile.
    ...(engine === "firefox" ? {} : { isMobile: mobile, hasTouch: mobile }),
    reducedMotion,
    locale: "sr-Latn-RS",
    timezoneId: "Europe/Belgrade",
    ...(engine === "chromium" ? { userAgent: ua } : {}),
  });
  if (consent) {
    const { hostname } = new URL(BASE);
    const value = encodeURIComponent(
      JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: `audit-${tag}-0001` }),
    );
    await context.addCookies([
      { name: "sk_consent", value, domain: hostname, path: "/", httpOnly: false, secure: false, sameSite: "Lax" },
    ]);
  }
  return context;
}

/** Collects console errors, page errors, failed requests (non-aborted) and CSP violations. */
export function watch(page) {
  const log = { console: [], pageErrors: [], failedRequests: [], badResponses: [] };
  page.on("console", (m) => {
    if (m.type() === "error") log.console.push(m.text().slice(0, 400));
  });
  page.on("pageerror", (e) => log.pageErrors.push(String(e).slice(0, 400)));
  page.on("requestfailed", (r) => {
    const f = r.failure()?.errorText ?? "";
    if (!/ERR_ABORTED|NS_BINDING_ABORTED|cancelled/i.test(f)) log.failedRequests.push(`${f} ${r.url()}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) log.badResponses.push(`${r.status()} ${r.url()}`);
  });
  return log;
}

/** Scrolls to the end in 60 % steps and back so every reveal and content-visibility section runs. */
export async function scrollThrough(page, { stepMs = 140 } = {}) {
  await page.evaluate(async (ms) => {
    const step = window.innerHeight * 0.6;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, ms));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 1000));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 700));
  }, stepMs);
}

/** The text-reveal contract check (.claude/rules/architecture.md): all three must be empty/zero. */
export async function revealCheck(page) {
  return page.evaluate(() => {
    const stuck = [...document.querySelectorAll("*")]
      .filter((e) => e.offsetParent && e.textContent.trim() && getComputedStyle(e).opacity === "0")
      .slice(0, 20)
      .map((e) => `${e.tagName.toLowerCase()}${e.id ? `#${e.id}` : ""}: ${e.textContent.trim().slice(0, 60)}`);
    return {
      stuck,
      pending: document.querySelectorAll('[data-reveal-state="pending"]').length,
      words: document.querySelectorAll(".reveal-word").length,
    };
  });
}

/** Horizontal overflow in px (0 = none) plus the widest offenders. */
export async function overflowX(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const over = document.documentElement.scrollWidth - vw;
    const offenders =
      over > 0
        ? [...document.querySelectorAll("body *")]
            .filter((e) => e.getBoundingClientRect().right > vw + 1)
            .slice(0, 8)
            .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 2).join(".")}`)
        : [];
    return { over, offenders };
  });
}

/**
 * Screenshot saved as WebP under docs/qa/audit/<rel> (rel without extension or with .webp).
 * Full-page captures are clipped to 16 000 px (WebP limit). Returns the repo-relative path.
 */
export async function shot(page, rel, { fullPage = false, quality = 70, clip, locator } = {}) {
  const file = path.join(AUDIT_DIR, rel.endsWith(".webp") ? rel : `${rel}.webp`);
  mkdirSync(path.dirname(file), { recursive: true });
  let buf;
  if (locator) {
    buf = await locator.screenshot({ type: "png" });
  } else if (fullPage) {
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    const w = page.viewportSize()?.width ?? 1440;
    buf =
      h > 16000
        ? await page.screenshot({ type: "png", fullPage: true, clip: { x: 0, y: 0, width: w, height: 16000 } })
        : await page.screenshot({ type: "png", fullPage: true });
  } else {
    buf = await page.screenshot({ type: "png", ...(clip ? { clip } : {}) });
  }
  await sharp(buf).webp({ quality }).toFile(file);
  return path.relative(process.cwd(), file).replaceAll("\\", "/");
}

/** axe WCAG 2.2 AA (same tags as the e2e specs). Returns a compact list of violations. */
export async function axe(page, { include, exclude } = {}) {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);
  if (include) builder = builder.include(include);
  if (exclude) builder = builder.exclude(exclude);
  const res = await builder.analyze();
  return res.violations.map((v) => ({
    id: v.id,
    impact: v.impact,
    help: v.help,
    nodes: v.nodes.length,
    targets: v.nodes.slice(0, 5).map((n) => n.target.join(" ")),
    summary: v.nodes[0]?.failureSummary?.slice(0, 300),
  }));
}

/** Signs in with e-mail + password on /prijava and waits for `next`. */
export async function loginWith(page, email, password, next = "/nalog") {
  await page.goto(`${BASE}/prijava?next=${encodeURIComponent(next)}`, { waitUntil: "networkidle" });
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith(next), { timeout: 60_000 });
}

/** Signs in as the seeded owner (SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD). */
export async function loginAdmin(page) {
  const email = process.env.SEED_ADMIN_EMAIL;
  const password = process.env.SEED_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set");
  await loginWith(page, email, password, "/admin");
}

/** Runs an internal Convex function on the dev deployment (e.g. testing:orderProbe) and parses the JSON result. */
export function convexRun(fn, args = {}) {
  const out = execFileSync(
    process.execPath,
    [path.resolve("node_modules/convex/bin/main.js"), "run", fn, JSON.stringify(args)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
  );
  const start = out.search(/[[{"]|^-?\d|^null|^true|^false/m);
  return start >= 0 ? JSON.parse(out.slice(start)) : out;
}
