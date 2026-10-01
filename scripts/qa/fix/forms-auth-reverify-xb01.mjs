/**
 * Step 22 independent re-verification of XB-01 after the D251 fix-up (forms-auth package).
 * Same method as scripts/qa/audit/verify-xbrowser-01.mjs (only /_next/static/chunks/*.js delayed,
 * CSS passes, type as soon as the field is painted), plus checks the implementer's script does not
 * make: the react-hook-form state itself (read from the form's fiber, not only the DOM), the
 * useWatch-derived UI (VIN decode, PIB/MB success) after a restore, the hero's React value, a real
 * submit (mutation args captured from the Convex WebSocket), and no-delay regressions (keyboard
 * typing/deleting, client-side navigation, ?q= prefill, uncontrolled styleguide Textarea, admin).
 *
 *   R_ENGINES=chromium,webkit,firefox R_SCEN=home,upit,majstor,mid-upit,mid-vin,mid-majstor,mid-home \
 *   R_RUNS=3 R_WIDTH=390 R_REDUCED=0 R_SUBMIT=0 AUDIT_BASE=http://localhost:3001 \
 *   node scripts/qa/fix/forms-auth-reverify-xb01.mjs
 */
import { writeFileSync } from "node:fs";

import { BASE, launch, loginAdmin, newContext, shot, watch } from "../audit/kit.mjs";

const DELAY = Number(process.env.R_DELAY ?? 6000);
const WIDTH = Number(process.env.R_WIDTH ?? 390);
const RUNS = Number(process.env.R_RUNS ?? 3);
const REDUCED = process.env.R_REDUCED === "1";
const SUBMIT = process.env.R_SUBMIT === "1";
const ENGINES = (process.env.R_ENGINES ?? "chromium,webkit,firefox").split(",");
const SCEN = (process.env.R_SCEN ?? "home,upit,majstor,mid-upit,mid-vin,mid-majstor,mid-home").split(",");
const TAG = process.env.R_TAG ?? `${ENGINES.join("_")}-${WIDTH}${REDUCED ? "-reduce" : ""}`;
const PIB = "101234569";
const MB = "17123459";
const VIN = "WVWZZZ1KZ8W123456";

const hydratedFn = (s) => {
  const e = document.querySelector(s);
  return !!e && Object.keys(e).some((k) => k.startsWith("__reactProps"));
};

/** DOM value, React's value prop (controlled inputs) and the react-hook-form values of the form. */
const probe = (sels) => {
  const rhf = (el) => {
    const fk = el && Object.keys(el).find((k) => k.startsWith("__reactFiber"));
    let f = fk ? el[fk] : null;
    while (f) {
      let h = f.memoizedState;
      let guard = 0;
      while (h && typeof h === "object" && "next" in h && guard++ < 300) {
        const v = h.memoizedState;
        if (v && typeof v === "object" && v.current && v.current.control && v.current.control._formValues) {
          return JSON.parse(JSON.stringify(v.current.control._formValues));
        }
        h = h.next;
      }
      f = f.return;
    }
    return null;
  };
  const out = { fields: {}, rhf: null };
  for (const s of sels) {
    const e = document.querySelector(s);
    const pk = e && Object.keys(e).find((k) => k.startsWith("__reactProps"));
    out.fields[s] = e ? { dom: e.value, reactValue: pk && "value" in e[pk] ? e[pk].value : "(uncontrolled)" } : null;
    if (!out.rhf && e) out.rhf = rhf(e);
  }
  out.text = (id) => document.getElementById(id)?.textContent ?? null;
  out.msgCounter = document.getElementById("iq-message-count")?.textContent ?? null;
  out.vinHelp = document.getElementById("iq-vin-msg")?.textContent ?? null;
  out.brand = document.getElementById("iq-brandSlug")?.value ?? null;
  out.pibMsg = document.getElementById("mr-pib-msg")?.textContent ?? null;
  out.mbMsg = document.getElementById("mr-mb-msg")?.textContent ?? null;
  out.active = document.activeElement?.id || document.activeElement?.tagName || null;
  delete out.text;
  return out;
};

async function delayJs(page) {
  await page.route("**/_next/static/chunks/**", async (rt) => {
    if (!/\.js(\?|$)/.test(rt.request().url())) return rt.continue();
    await new Promise((res) => setTimeout(res, DELAY));
    await rt.continue().catch(() => {});
  });
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

function captureMutations(page) {
  const sent = [];
  page.on("websocket", (ws) => {
    ws.on("framesent", ({ payload }) => {
      if (typeof payload !== "string" || !payload.includes('"Mutation"')) return;
      try {
        const m = JSON.parse(payload);
        if (m.type === "Mutation") sent.push({ udfPath: m.udfPath, args: m.args?.[0] });
      } catch {}
    });
  });
  return sent;
}

/** Types [selector, text] pairs before hydration; returns timings and the DOM right after typing. */
async function typeBeforeHydration(page, r, path, fields, hydrationProbe) {
  const t0 = Date.now();
  await page.goto(`${BASE}${path}`, { waitUntil: "commit", timeout: 120_000 });
  await page.locator(fields[0][0]).first().waitFor({ state: "visible", timeout: 60_000 });
  r.visibleAt = Date.now() - t0;
  r.hydratedBeforeTyping = await page.evaluate(hydratedFn, hydrationProbe);
  for (const [sel, text] of fields) {
    await page.locator(sel).first().click();
    await page.keyboard.type(text, { delay: 20 });
  }
  r.typedAt = Date.now() - t0;
  r.hydratedRightAfterTyping = await page.evaluate(hydratedFn, hydrationProbe);
  r.validTiming = r.hydratedBeforeTyping === false && r.hydratedRightAfterTyping === false;
  await page.waitForFunction(hydratedFn, hydrationProbe, { timeout: 120_000, polling: 50 });
  r.hydratedAt = Date.now() - t0;
  await page.waitForTimeout(2500);
  const p = await page.evaluate(probe, fields.map((f) => f[0]));
  r.after = p;
  r.domKept = fields.every(([sel, text]) => p.fields[sel]?.dom === text);
}

const result = {};
for (const engine of ENGINES) {
  const browser = await launch(engine);
  try {
    for (const scen of SCEN) {
      const key = `${engine}-${WIDTH}${REDUCED ? "-reduce" : ""}-${scen}`;
      const r = (result[key] = {});
      const ctx = await newContext(browser, {
        width: WIDTH,
        height: WIDTH < 1024 ? 844 : 900,
        tag: `rv-xb01-${engine}-${scen}`,
        engine,
        reducedMotion: REDUCED ? "reduce" : "no-preference",
      });
      const page = await ctx.newPage();
      page.setDefaultTimeout(60_000);
      const log = watch(page);
      try {
        if (scen === "home") {
          await delayJs(page);
          const sel = "[data-testid=hero-search-input] input";
          await typeBeforeHydration(page, r, "/", [[sel, "5Q0615505R"]], sel);
          r.focusKept = r.after.active !== "BODY";
          await shot(page, `../fix/forms-auth/verify/xb01-reverify-${key}`);
          await Promise.all([
            page.waitForURL(/\/pretraga/, { timeout: 90_000 }).catch(() => null),
            page.locator('form[role="search"]:has([data-testid=hero-search-input]) button[type=submit]').click(),
          ]);
          await page.waitForTimeout(1000);
          r.afterSubmitUrl = decodeURIComponent(page.url().replace(BASE, ""));
        } else if (scen === "upit") {
          const sent = captureMutations(page);
          await delayJs(page);
          await typeBeforeHydration(
            page,
            r,
            "/upit",
            [
              ["#iq-vin", VIN],
              ["#iq-message", "Turbina za Golf 7, dizel."],
              ["#iq-name", "Verifikacija XB01"],
              ["#iq-phone", "065 987 6543"],
            ],
            "#iq-vin",
          );
          const v = r.after.rhf ?? {};
          r.stateKept =
            v.vin === VIN && v.message === "Turbina za Golf 7, dizel." && v.name === "Verifikacija XB01" && v.phone === "065 987 6543";
          await shot(page, `../fix/forms-auth/verify/xb01-reverify-${key}-after-hydration`);
          await page.getByTestId("inquiry-submit").click();
          await page.waitForTimeout(1200);
          r.errorsWithoutConsent = await page.evaluate(() =>
            [...document.querySelectorAll('[role="alert"] li')].map((e) => e.textContent.trim()),
          );
          if (SUBMIT) {
            await page.locator("#iq-consent").click();
            await Promise.all([
              page.waitForURL(/\/upit\/hvala\//, { timeout: 60_000 }).catch(() => null),
              page.getByTestId("inquiry-submit").click(),
            ]);
            await page.waitForTimeout(1500);
            r.afterSubmitUrl = page.url().replace(BASE, "").replace(/hvala\/[^/?#]+/, "hvala/<token>");
            const m = sent.find((x) => /inquiries/.test(x.udfPath ?? "") && /submit/.test(x.udfPath ?? ""));
            r.submittedArgs = m
              ? { udfPath: m.udfPath, vin: m.args?.vin, message: m.args?.message, name: m.args?.contact?.name, phone: m.args?.contact?.phone, vehicle: m.args?.vehicle?.label }
              : null;
            await shot(page, `../fix/forms-auth/verify/xb01-reverify-${key}-after-submit`);
          }
        } else if (scen === "majstor") {
          await delayJs(page);
          await typeBeforeHydration(
            page,
            r,
            "/za-majstore/registracija",
            [
              ["#mr-email", "servis.rv01@primer.rs"],
              ["#mr-password", "TajnaLozinka-555"],
              ["#mr-companyName", "Servis RV01"],
              ["#mr-pib", PIB],
              ["#mr-mb", MB],
              ["#mr-phone", "0641234567"],
            ],
            "#mr-email",
          );
          const v = r.after.rhf ?? {};
          r.stateKept = v.email === "servis.rv01@primer.rs" && v.pib === PIB && v.mb === MB && v.companyName === "Servis RV01" && v.phone === "0641234567" && v.password === "TajnaLozinka-555";
          r.watchersFollow = /PIB je ispravan/.test(r.after.pibMsg ?? "") && /Matični broj je ispravan/.test(r.after.mbMsg ?? "");
          await shot(page, `../fix/forms-auth/verify/xb01-reverify-${key}-after-hydration`, { fullPage: true });
          await page.locator("form:has(#mr-password) button[type=submit]").click();
          await page.waitForTimeout(1200);
          r.summaryAfterSubmit = await page.evaluate(() => [...document.querySelectorAll('[role="alert"] li')].map((li) => li.textContent.trim()));
          if (r.after.rhf) r.after.rhf.password = r.after.rhf.password ? "(set)" : "";
          if (r.after.fields["#mr-password"]) r.after.fields["#mr-password"].dom = "(hidden)";
        } else if (scen.startsWith("mid-")) {
          // Hydration lands while the visitor is still typing.
          const spec = {
            "mid-upit": { path: "/upit", pre: [["#iq-vin", VIN]], sel: "#iq-message", text: "Turbina za Golf 7, dizel, curi ulje." },
            "mid-vin": { path: "/upit", pre: [], sel: "#iq-vin", text: VIN },
            "mid-majstor": { path: "/za-majstore/registracija", pre: [["#mr-companyName", "Servis RV01"]], sel: "#mr-pib", text: PIB, slow: true },
            "mid-home": { path: "/", pre: [], sel: "[data-testid=hero-search-input] input", text: "5Q0615505R", slow: true },
          }[scen];
          r.runs = [];
          for (let run = 0; run < RUNS; run++) {
            const p2 = run === 0 ? page : await ctx.newPage();
            const release = await gateJs(p2);
            await p2.goto(`${BASE}${spec.path}`, { waitUntil: "domcontentloaded", timeout: 120_000 });
            for (const [s, t] of spec.pre) {
              await p2.locator(s).first().click();
              await p2.keyboard.type(t, { delay: 15 });
            }
            await p2.locator(spec.sel).first().click();
            const cut = Math.ceil(spec.text.length / 3);
            await p2.keyboard.type(spec.text.slice(0, cut), { delay: 30 });
            release();
            const flags = [];
            for (const ch of spec.text.slice(cut)) {
              await p2.keyboard.type(ch);
              // Short fields (PIB, hero code) type slower so hydration can land between their keys.
              await p2.waitForTimeout(spec.slow ? 300 + (run % 3) * 150 : 80 + (run % 3) * 45);
              flags.push(await p2.evaluate(hydratedFn, spec.sel));
            }
            await p2.waitForFunction(hydratedFn, spec.sel, { timeout: 120_000, polling: 50 });
            await p2.waitForTimeout(2000);
            const p = await p2.evaluate(probe, [spec.sel, ...spec.pre.map((x) => x[0])]);
            const nameOf = { "#iq-message": "message", "#iq-vin": "vin", "#mr-pib": "pib" };
            const stateVal = nameOf[spec.sel] ? p.rhf?.[nameOf[spec.sel]] : p.fields[spec.sel]?.reactValue;
            const entry = {
              dom: p.fields[spec.sel]?.dom,
              state: stateVal,
              domKept: p.fields[spec.sel]?.dom === spec.text,
              stateKept: stateVal === spec.text,
              preKept: spec.pre.every(([s, t]) => p.fields[s]?.dom === t),
              hydrationDuringTyping: flags.includes(true) && flags.includes(false),
              flags: flags.map((h) => (h ? 1 : 0)).join(""),
            };
            if (scen === "mid-upit") {
              entry.msgCounter = p.msgCounter;
              entry.counterOk = p.msgCounter === `${spec.text.length} / 2.000`;
              entry.vinHelp = p.vinHelp;
            }
            if (scen === "mid-vin") {
              entry.vinHelp = p.vinHelp;
              entry.decoded = /Volkswagen/.test(p.vinHelp ?? "");
              entry.brand = p.brand;
            }
            if (scen === "mid-majstor") {
              entry.pibMsg = p.pibMsg;
              entry.watcherOk = /PIB je ispravan/.test(p.pibMsg ?? "");
            }
            r.runs.push(entry);
            if (run > 0) await p2.close();
          }
          r.summary = {
            runs: r.runs.length,
            domKept: r.runs.filter((x) => x.domKept).length,
            stateKept: r.runs.filter((x) => x.stateKept).length,
            hydrationDuringTyping: r.runs.filter((x) => x.hydrationDuringTyping).length,
          };
        } else if (scen === "counter") {
          // No delay: keyboard typing, deleting, select-all + delete, ?q= prefill, Tab order.
          await page.goto(`${BASE}/upit?q=${encodeURIComponent("turbina golf 7")}`, { waitUntil: "load", timeout: 120_000 });
          await page.waitForFunction(hydratedFn, "#iq-message", { timeout: 120_000, polling: 100 });
          await page.waitForTimeout(800);
          const c = () => page.locator("#iq-message-count").textContent();
          r.prefill = { value: await page.locator("#iq-message").inputValue(), counter: await c() };
          await page.locator("#iq-message").focus();
          await page.keyboard.press("End");
          await page.keyboard.type(", dizel");
          r.typed = await c();
          await page.keyboard.press("Backspace");
          await page.keyboard.press("Backspace");
          r.backspace2 = await c();
          await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
          await page.keyboard.press("Delete");
          r.cleared = { value: await page.locator("#iq-message").inputValue(), counter: await c() };
          await page.keyboard.type("Pumpa");
          r.retyped = await c();
          r.rhfAfter = (await page.evaluate(probe, ["#iq-message"])).rhf?.message;
          await page.keyboard.press("Tab");
          r.tabFrom = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") || document.activeElement?.id || document.activeElement?.tagName);
          await page.locator("#iq-vin").focus();
          await page.keyboard.type(VIN);
          await page.waitForTimeout(300);
          r.vinHelpAfterTyping = await page.locator("#iq-vin-msg").textContent();
          r.describedBy = await page.locator("#iq-message").getAttribute("aria-describedby");
          await shot(page, `../fix/forms-auth/verify/xb01-reverify-${key}`);
        } else if (scen === "clientnav") {
          // Client-side navigation to /upit: nothing to capture, fields start empty, counter works.
          await page.goto(`${BASE}/kontakt`, { waitUntil: "load", timeout: 120_000 });
          await page.waitForFunction(() => !!document.querySelector("a[href^='/upit']") && Object.keys(document.querySelector("a[href^='/upit']")).some((k) => k.startsWith("__reactProps")), null, { timeout: 120_000, polling: 100 });
          await page.waitForTimeout(500);
          await page.evaluate(() => (window.__marker = 1));
          const href = await page.evaluate(() => document.querySelector("a[href^='/upit']").getAttribute("href"));
          await page.evaluate(() => document.querySelector("a[href^='/upit']").click());
          await page.waitForURL(/\/upit/, { timeout: 60_000 });
          await page.locator("#iq-message").waitFor({ state: "visible" });
          await page.waitForTimeout(800);
          r.href = href;
          r.softNav = await page.evaluate(() => window.__marker === 1);
          r.initial = await page.evaluate(probe, ["#iq-message", "#iq-vin"]);
          await page.locator("#iq-message").fill("");
          await page.locator("#iq-message").click();
          await page.keyboard.type("Kocioni diskovi");
          r.typedCounter = await page.locator("#iq-message-count").textContent();
          r.rhfAfter = (await page.evaluate(probe, ["#iq-message"])).rhf?.message;
        } else if (scen === "styleguide") {
          await page.goto(`${BASE}/styleguide`, { waitUntil: "load", timeout: 120_000 });
          const ta = page.locator("textarea[maxlength='1000']").first();
          await ta.scrollIntoViewIfNeeded();
          await page.waitForFunction(() => {
            const e = document.querySelector("textarea[maxlength='1000']");
            return !!e && Object.keys(e).some((k) => k.startsWith("__reactProps"));
          }, null, { timeout: 120_000, polling: 100 });
          const counterId = await ta.getAttribute("aria-describedby");
          const cid = (counterId ?? "").split(" ").find((x) => x.endsWith("-count"));
          const c = () => page.locator(`[id="${cid}"]`).textContent();
          r.initial = await c();
          await ta.click();
          await page.keyboard.type("LED farovi");
          r.typed = await c();
          await page.keyboard.press("Backspace");
          r.backspace = await c();
        } else if (scen === "admin") {
          await loginAdmin(page);
          await page.goto(`${BASE}/admin/upiti`, { waitUntil: "load", timeout: 120_000 });
          const link = page.locator("a[href^='/admin/upiti/']").first();
          await link.waitFor({ state: "visible", timeout: 60_000 });
          await link.click();
          const ta = page.getByLabel("Nova beleška", { exact: true });
          await ta.waitFor({ state: "visible", timeout: 60_000 });
          await page.waitForTimeout(800);
          const cid = (await ta.getAttribute("aria-describedby"))?.split(" ").find((x) => x.endsWith("-count"));
          const c = () => page.locator(`[id="${cid}"]`).textContent();
          r.initial = await c();
          await ta.click();
          await page.keyboard.type("Proveriti dostupnost");
          r.typed = await c();
          await page.keyboard.press("Backspace");
          r.backspace = await c();
          r.value = await ta.inputValue();
          await ta.fill("");
          r.cleared = await c();
        }
      } catch (e) {
        r.error = String(e).split("\n").slice(0, 3).join(" | ").slice(0, 400);
      }
      r.consoleErrors = log.console.filter((m) => !/Failed to load resource/.test(m)).slice(0, 6);
      r.pageErrors = log.pageErrors.slice(0, 6);
      console.log(key, JSON.stringify(r.summary ?? r).slice(0, 1600));
      await ctx.close();
    }
  } finally {
    await browser.close();
  }
}
const file = `docs/qa/fix/forms-auth/verify/xb01-reverify-${TAG}-${SCEN.join("_")}.json`;
writeFileSync(file, JSON.stringify(result, null, 2));
console.log("saved", file);
