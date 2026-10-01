/**
 * Step 22 re-verification of XB-01 (forms-auth package): text typed into server-rendered fields
 * before hydration survives hydration and reaches the component state. Same method as
 * scripts/qa/audit/verify-xbrowser-01.mjs (only JS chunks delayed by V_DELAY ms, CSS passes,
 * type as soon as the field is painted, wait for React to own the node) plus: a forced re-render
 * and a submit for the hero search, counters / VIN decode / validation for /upit, the sign-up,
 * reset, mechanic registration, back-in-stock and /pretraga fields, React props vs DOM value for
 * controlled inputs, and a "hydration lands mid-typing" variant.
 *   V_ENGINES=chromium,webkit,firefox V_ROUTES=home,upit,... V_SUBMIT=1 \
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/forms-auth-verify-xb01.mjs
 */
import { writeFileSync } from "node:fs";

import { BASE, launch, newContext, shot, watch } from "../audit/kit.mjs";

const DELAY = Number(process.env.V_DELAY ?? 6000);
const WIDTH = Number(process.env.V_WIDTH ?? 390);
const ENGINES = (process.env.V_ENGINES ?? "chromium,webkit,firefox").split(",");
const ROUTES = (process.env.V_ROUTES ?? "home,upit,registracija,reset,majstor,bis,pretraga,mid-home,mid-upit").split(",");
const SUBMIT = process.env.V_SUBMIT === "1";
const OOS = process.env.OOS_SLUG ?? "kocione-plocice-prednje-demo-0012";
const TAG = process.env.V_TAG ?? `${ENGINES.join("_")}-${WIDTH}`;

const hydratedFn = (s) => {
  const e = document.querySelector(s);
  return !!e && Object.keys(e).some((k) => k.startsWith("__reactProps"));
};
/** DOM value and, for controlled inputs, the value React renders (state). */
const readField = (sel) => {
  const e = document.querySelector(sel);
  if (!e) return null;
  const pk = Object.keys(e).find((k) => k.startsWith("__reactProps"));
  const props = pk ? e[pk] : null;
  return { dom: e.value, reactValue: props && "value" in props ? props.value : "(uncontrolled)" };
};

async function delayJs(page) {
  let n = 0;
  await page.route("**/_next/static/chunks/**", async (rt) => {
    if (!/\.js(\?|$)/.test(rt.request().url())) return rt.continue();
    n++;
    await new Promise((res) => setTimeout(res, DELAY));
    await rt.continue().catch(() => {});
  });
  return () => n;
}

async function gateJs(page) {
  let release;
  const gate = new Promise((r) => (release = r));
  await page.route(/\/_next\/static\/chunks\/.*\.js/, async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  return () => release();
}

/** Types `fields` before hydration, waits for hydration of `probe`, returns DOM/state values. */
async function typedBeforeHydration(page, r, path, fields, probe) {
  const t0 = Date.now();
  await page.goto(`${BASE}${path}`, { waitUntil: "commit", timeout: 120_000 });
  await page.locator(fields[0][0]).first().waitFor({ state: "visible", timeout: 60_000 });
  r.visibleAt = Date.now() - t0;
  r.hydratedBeforeTyping = await page.evaluate(hydratedFn, probe);
  for (const [sel, text, mode] of fields) {
    const loc = page.locator(sel).first();
    await loc.click();
    if (mode === "replace") {
      await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
    }
    await page.keyboard.type(text, { delay: 25 });
  }
  r.typedAt = Date.now() - t0;
  r.hydratedRightAfterTyping = await page.evaluate(hydratedFn, probe);
  r.domAfterTyping = await page.evaluate((s) => s.map((x) => document.querySelector(x)?.value), fields.map((f) => f[0]));
  await page.waitForFunction(hydratedFn, probe, { timeout: 120_000, polling: 50 });
  r.hydratedAt = Date.now() - t0;
  await page.waitForTimeout(2500);
  r.after = {};
  for (const [sel] of fields) r.after[sel] = await page.evaluate(readField, sel);
  r.kept = fields.every(([sel], i) => r.after[sel]?.dom === r.domAfterTyping[i]);
  r.validTiming = r.hydratedBeforeTyping === false && r.hydratedRightAfterTyping === false;
}

const result = {};
for (const engine of ENGINES) {
  const browser = await launch(engine);
  try {
    for (const route of ROUTES) {
      const key = `${engine}-${WIDTH}-${route}`;
      const r = (result[key] = { delay: DELAY });
      const ctx = await newContext(browser, { width: WIDTH, height: WIDTH < 1024 ? 844 : 900, tag: `fa-xb01-${engine}-${route}`, engine });
      const page = await ctx.newPage();
      const log = watch(page);
      page.setDefaultTimeout(60_000);
      try {
        if (route === "home") {
          const count = await delayJs(page);
          const sel = "[data-testid=hero-search-input] input";
          await typedBeforeHydration(page, r, "/", [[sel, "5Q0615505R"]], sel);
          r.focused = await page.evaluate((s) => document.activeElement === document.querySelector(s), sel);
          await shot(page, `../fix/forms-auth/verify/xb01-${key}-after-hydration`);
          // Force a re-render of the controlled input (placeholder switches at 48rem).
          await page.setViewportSize({ width: 1024, height: 844 });
          await page.waitForTimeout(1200);
          r.afterRerender = await page.evaluate(readField, sel);
          await page.setViewportSize({ width: WIDTH, height: 844 });
          await page.waitForTimeout(800);
          // Submit: the state must carry the typed code.
          r.beforeSubmit = await page.evaluate(readField, sel);
          // The button, not Enter/Escape: Escape on a closed list clears the field by design.
          await Promise.all([
            page.waitForURL(/\/pretraga/, { timeout: 90_000 }).catch(() => null),
            page.locator('form[role="search"]:has([data-testid=hero-search-input]) button[type=submit]').click(),
          ]);
          await page.waitForTimeout(1500);
          r.afterSubmitUrl = decodeURIComponent(page.url().replace(BASE, ""));
          r.chunkRequestsDelayed = count();
        } else if (route === "upit") {
          await delayJs(page);
          await typedBeforeHydration(
            page,
            r,
            "/upit",
            [
              ["#iq-vin", "WVWZZZ1KZ8W123456"],
              ["#iq-message", "Turbina za Golf 7, dizel."],
            ],
            "#iq-vin",
          );
          r.ui = await page.evaluate(() => {
            const txt = document.body.innerText;
            return {
              vinHelp: document.querySelector("#iq-vin-msg")?.textContent ?? null,
              vinCounter: (txt.match(/\d+ \/ 17 znakova/) ?? [""])[0],
              msgCounter: (txt.match(/\d+(\.\d+)? \/ 2\.000/) ?? [""])[0],
              brand: document.querySelector("#iq-brandSlug")?.value ?? document.querySelector('[id^="iq-brand"]')?.textContent ?? null,
              submitDisabled: document.querySelector('[data-testid="inquiry-submit"]')?.disabled,
            };
          });
          await shot(page, `../fix/forms-auth/verify/xb01-${key}-after-hydration`);
          await page.getByLabel("Ime", { exact: true }).fill("Verifikacija XB01");
          await page.getByLabel("Telefon", { exact: true }).fill("065 987 6543");
          // Validation only (no consent): Opis must not be reported as missing.
          await page.getByTestId("inquiry-submit").click();
          await page.waitForTimeout(1200);
          r.errorsWithoutConsent = await page.evaluate(() =>
            [...document.querySelectorAll('[role="alert"] li, [role="alert"] p')].map((e) => e.textContent.trim()).filter(Boolean),
          );
          if (SUBMIT) {
            await page.getByRole("checkbox", { name: /Slažem se|saglasn/i }).first().click();
            await Promise.all([
              page.waitForURL(/\/upit\/hvala\//, { timeout: 60_000 }).catch(() => null),
              page.getByTestId("inquiry-submit").click(),
            ]);
            await page.waitForTimeout(2000);
            r.afterSubmitUrl = page.url().replace(BASE, "").replace(/hvala\/[^/?#]+/, "hvala/<token>");
            await shot(page, `../fix/forms-auth/verify/xb01-${key}-after-submit`);
          }
        } else if (route === "upit-prefill-control") {
          // Control without any pre-hydration typing: a prefilled message (?q=) and its counter.
          await page.goto(`${BASE}/upit?q=${encodeURIComponent("turbina golf 7")}`, { waitUntil: "load", timeout: 120_000 });
          await page.waitForFunction(hydratedFn, "#iq-message", { timeout: 120_000, polling: 100 });
          await page.waitForTimeout(1500);
          r.prefill = await page.evaluate(() => ({
            messageLength: document.querySelector("#iq-message")?.value.length,
            counter: document.querySelector("#iq-message-count")?.textContent ?? null,
          }));
        } else if (route === "registracija") {
          await delayJs(page);
          await typedBeforeHydration(
            page,
            r,
            "/registracija",
            [
              ["#su-name", "Petar Petrović"],
              ["#su-email", "petar.xb01@primer.rs"],
              ["#su-password", "TajnaLozinka-555"],
            ],
            "#su-name",
          );
          await page.getByTestId("signup-submit").click();
          await page.waitForTimeout(1000);
          r.summaryWithoutTerms = await page.evaluate(() => [...document.querySelectorAll('[role="alert"] li')].map((li) => li.textContent.trim()));
        } else if (route === "reset") {
          await delayJs(page);
          await typedBeforeHydration(page, r, "/zaboravljena-lozinka", [["#rp-email", "petar.xb01@primer.rs"]], "#rp-email");
        } else if (route === "majstor") {
          await delayJs(page);
          await typedBeforeHydration(
            page,
            r,
            "/za-majstore/registracija",
            [
              ["#mr-email", "servis.xb01@primer.rs"],
              ["#mr-password", "TajnaLozinka-555"],
              ["#mr-companyName", "Servis XB01"],
              ["#mr-phone", "0641234567"],
            ],
            "#mr-email",
          );
          await page.locator('form:has(#mr-password) button[type=submit]').click();
          await page.waitForTimeout(1200);
          r.summaryAfterSubmit = await page.evaluate(() => [...document.querySelectorAll('[role="alert"] li')].map((li) => li.textContent.trim()));
        } else if (route === "bis") {
          await delayJs(page);
          await typedBeforeHydration(page, r, `/deo/${OOS}`, [["#bis-email", "kupac.xb01@primer.rs"]], "#bis-email");
          await page.locator('[data-testid="back-in-stock-form"] button[type=submit]').click();
          await page.waitForTimeout(1000);
          r.afterSubmit = await page.evaluate(() => ({
            emailMsg: document.querySelector("#bis-email-msg")?.textContent ?? null,
            focus: document.activeElement?.id || document.activeElement?.tagName,
            consentInvalid: document.querySelector('[data-testid="back-in-stock-form"] [role="checkbox"]')?.getAttribute("aria-invalid"),
          }));
        } else if (route === "pretraga") {
          await delayJs(page);
          const sel = "[data-testid=search-page-input] input";
          await typedBeforeHydration(page, r, "/pretraga?q=disk", [[sel, "plocice golf", "replace"]], sel);
          await page.setViewportSize({ width: 1024, height: 844 });
          await page.waitForTimeout(1200);
          r.afterRerender = await page.evaluate(readField, sel);
        } else if (route === "mid-home" || route === "mid-upit") {
          // Hydration lands while the visitor is still typing (slow typist, three runs).
          r.runs = [];
          const RUNS = Number(process.env.V_RUNS ?? 3);
          for (let run = 0; run < RUNS; run++) {
            const p2 = run === 0 ? page : await ctx.newPage();
            if (engine === "chromium" && process.env.V_CPU) {
              const cdp = await ctx.newCDPSession(p2);
              await cdp.send("Emulation.setCPUThrottlingRate", { rate: Number(process.env.V_CPU) });
            }
            const release = await gateJs(p2);
            const isHome = route === "mid-home";
            const sel = isHome ? "[data-testid=hero-search-input] input" : "#iq-message";
            const text = isHome ? "5Q0615505R" : "Turbina za Golf 7, dizel, curi ulje.";
            await p2.goto(`${BASE}${isHome ? "/" : "/upit"}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
            await p2.locator(sel).first().click();
            const half = Math.ceil(text.length / 3);
            await p2.keyboard.type(text.slice(0, half), { delay: 40 });
            release();
            const hydrated = [];
            for (const ch of text.slice(half)) {
              await p2.keyboard.type(ch);
              await p2.waitForTimeout(90 + (run % 3) * 40);
              hydrated.push(await p2.evaluate(hydratedFn, sel));
            }
            await p2.waitForFunction(hydratedFn, sel, { timeout: 120_000, polling: 50 });
            await p2.waitForTimeout(2000);
            const after = await p2.evaluate(readField, sel);
            r.runs.push({
              expected: text,
              after,
              kept: after?.dom === text,
              hydrationDuringTyping: hydrated.includes(true) && hydrated.includes(false),
              hydratedFlags: hydrated.map((h) => (h ? 1 : 0)).join(""),
            });
            if (run > 0) await p2.close();
          }
        }
      } catch (e) {
        r.error = String(e).split("\n").slice(0, 3).join(" | ").slice(0, 400);
      }
      r.consoleErrors = log.console.filter((m) => !/Failed to load resource/.test(m)).slice(0, 5);
      r.pageErrors = log.pageErrors.slice(0, 5);
      console.log(key, JSON.stringify(r).slice(0, 1400));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}
const file = `docs/qa/fix/forms-auth/verify/xb01-${TAG}-${ROUTES.join("_")}.json`;
writeFileSync(file, JSON.stringify(result, null, 2));
console.log("saved", file);
