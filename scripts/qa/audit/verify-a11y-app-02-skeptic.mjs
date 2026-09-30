/**
 * Independent verification of a11y-app-02 (skeptic lens): do the auth forms leak credentials into
 * the URL via a native GET submit (a) with JavaScript disabled, (b) with JS enabled but before
 * hydration (client chunks delayed, as on a slow phone)?
 * Evidence: docs/qa/audit/verify/a11y-app/a11y-app-02-skeptic.*
 */
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

import { BASE, launch, newContext, shot } from "./kit.mjs";

const OUT = "verify/a11y-app";
mkdirSync(path.resolve("docs/qa/audit", OUT), { recursive: true });
const stamp = Date.now();
const results = [];

async function inspectForm(page) {
  return page.evaluate(() => {
    const f = document.querySelector("main form") ?? document.querySelector("form:not([role=search])");
    if (!f) return null;
    return {
      method: f.getAttribute("method"),
      action: f.getAttribute("action"),
      named: [...f.elements].filter((e) => e.name).map((e) => `${e.name}:${e.type}`),
      submitDisabled: f.querySelector("button[type=submit]")?.disabled ?? null,
    };
  });
}

async function run({ label, route, js, delayChunksMs = 0, fill, submit = "click" }) {
  const browser = await launch();
  const ctx = await newContext(browser, { width: 390, height: 844, tag: `verify-a11y02-${label}` });
  if (!js) {
    await ctx.close();
  }
  const context = js
    ? ctx
    : await browser.newContext({ javaScriptEnabled: false, viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, locale: "sr-Latn-RS" });
  if (!js) {
    const { hostname } = new URL(BASE);
    const value = encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: `audit-v-${label}` }));
    await context.addCookies([{ name: "sk_consent", value, domain: hostname, path: "/", sameSite: "Lax" }]);
  }
  const page = await context.newPage();
  let chunkRequests = 0;
  if (delayChunksMs) {
    await page.route(/\/_next\/static\/chunks\/.*\.js/, async (r) => {
      chunkRequests++;
      await new Promise((res) => setTimeout(res, delayChunksMs));
      await r.continue().catch(() => {});
    });
  }
  const navs = [];
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) navs.push(`${r.method()} ${r.url()}`);
  });
  const t0 = Date.now();
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  const form = await inspectForm(page);
  const hydratedBefore = await page.evaluate(() => {
    const el = document.querySelector("main form input");
    return el ? Object.keys(el).some((k) => k.startsWith("__reactFiber")) : null;
  });
  await fill(page);
  await shot(page, `${OUT}/a11y-app-02-skeptic-${label}-filled`);
  const navPromise = page
    .waitForRequest((r) => r.isNavigationRequest() && r.frame() === page.mainFrame(), { timeout: 8000 })
    .catch(() => null);
  if (submit === "enter") await page.locator("input[type=password]").first().press("Enter");
  else await page.locator("main form button[type=submit]").first().click({ noWaitAfter: true });
  const nav = await navPromise;
  await page.waitForLoadState("domcontentloaded").catch(() => {});
  await page.waitForTimeout(800);
  const finalUrl = page.url();
  const referrerPolicy = nav ? (await nav.response().catch(() => null))?.headers()["referrer-policy"] ?? null : null;
  await shot(page, `${OUT}/a11y-app-02-skeptic-${label}-after`);
  const r = {
    label,
    route,
    js,
    delayChunksMs,
    submitAfterMs: Date.now() - t0,
    hydratedAtSubmit: hydratedBefore,
    chunkRequests,
    form,
    submitNavigation: nav ? `${nav.method()} ${nav.url()}` : null,
    finalUrl,
    passwordInUrl: /password=/.test(finalUrl),
    referrerPolicyOnResult: referrerPolicy,
    navs,
  };
  results.push(r);
  console.log(JSON.stringify(r, null, 1));
  await browser.close();
}

const email = `audit-verify-a11y02-${stamp}@primer.rs`;
const pw = "TajnaLozinka-777";

const fillSignIn = async (p) => {
  await p.locator("input[name=email]").fill(email);
  await p.locator("input[name=password]").fill(pw);
};
const fillSignUp = async (p) => {
  await p.locator("input[name=name]").fill("Verifikacija Skeptik");
  await p.locator("input[name=email]").fill(email);
  await p.locator("input[name=password]").fill(pw);
};
const fillMech = async (p) => {
  await p.locator("input[type=email]").first().fill(email);
  await p.locator("input[type=password]").first().fill(pw);
};

await run({ label: "nojs-prijava", route: "/prijava", js: false, fill: fillSignIn });
await run({ label: "nojs-registracija", route: "/registracija", js: false, fill: fillSignUp });
await run({ label: "nojs-za-majstore-registracija", route: "/za-majstore/registracija", js: false, fill: fillMech });
// JS on, client chunks held back 12 s: user presses Enter in the password field before hydration.
await run({ label: "prehydration-prijava", route: "/prijava?next=%2Fnalog", js: true, delayChunksMs: 12000, fill: fillSignIn, submit: "enter" });
await run({ label: "prehydration-registracija", route: "/registracija", js: true, delayChunksMs: 12000, fill: fillSignUp, submit: "enter" });
// Control: normal hydrated page must not navigate with the password.
await run({ label: "hydrated-prijava-control", route: "/prijava", js: true, fill: async (p) => { await p.waitForLoadState("networkidle"); await fillSignIn(p); } });

writeFileSync(path.resolve("docs/qa/audit", OUT, "a11y-app-02-skeptic.json"), JSON.stringify({ at: new Date().toISOString(), base: BASE, results }, null, 2));
