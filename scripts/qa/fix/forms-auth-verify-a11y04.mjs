/**
 * Step 22 re-verification of A11Y-04 (forms-auth package): a native submit (no JavaScript, or
 * before hydration) never puts credentials or contact data into a GET URL. Mirrors
 * scripts/qa/audit/verify-a11y-app-02.mjs (no-JS Chromium 390/1440, Firefox, WebKit, held chunks,
 * hydrated control) and adds: every submit button of the form, implicit submission (Enter),
 * forced click, a native POST with the disabled attribute removed (defence in depth: nothing in
 * the URL, nothing echoed), the <noscript> notice, /upit and back-in-stock.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/forms-auth-verify-a11y04.mjs
 */
import { writeFileSync } from "node:fs";
import { BASE, launch, shot } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/forms-auth/verify/a11y04.json";
const EMAIL = "verify-fa-a11y04@primer.rs";
const PW = "VerifyLozinka-777";
const OOS = process.env.OOS_SLUG ?? "kocione-plocice-prednje-demo-0012";
const results = [];
const SECRET = /password=|newPassword=|email=|phone=|name=|vin=|message=/i;

async function ctxFor(browser, engine, { width = 390, height = 844, js = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    ...(engine === "firefox" ? {} : { isMobile: width < 1024, hasTouch: width < 1024 }),
    javaScriptEnabled: js,
    locale: "sr-Latn-RS",
  });
  const { hostname } = new URL(BASE);
  const value = encodeURIComponent(
    JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "fa-verify-0004" }),
  );
  await ctx.addCookies([{ name: "sk_consent", value, domain: hostname, path: "/", sameSite: "Lax" }]);
  return ctx;
}

function trackNav(page) {
  const nav = [];
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) {
      nav.push(`${r.method()} ${r.url().replace(BASE, "")}`);
    }
  });
  return nav;
}

const formInfo = (page, sel) =>
  page.evaluate((sel) => {
    const f = document.querySelector(sel);
    if (!f) return null;
    const ns = [...f.querySelectorAll("noscript")].map((n) =>
      n.textContent.replace(/<[^>]+>/g, "").trim(),
    );
    return {
      method: f.getAttribute("method"),
      action: f.getAttribute("action"),
      names: [...f.elements].map((e) => e.name).filter(Boolean),
      submitButtons: [
        ...f.querySelectorAll('button:not([type]), button[type="submit"], input[type="submit"]'),
      ].map((b) => ({ text: b.textContent.trim().slice(0, 30), disabled: b.disabled })),
      noscript: ns,
    };
  }, sel);

const ROUTES = [
  {
    route: "/prijava",
    form: "form",
    label: "prijava",
    fill: async (p) => {
      await p.locator('input[name="email"]').first().fill(EMAIL);
      await p.locator('input[name="password"]').first().fill(PW);
    },
    enterIn: 'input[name="password"]',
  },
  {
    route: "/registracija",
    form: "form",
    label: "registracija",
    fill: async (p) => {
      await p.locator("#su-name").fill("Verify Tester");
      await p.locator("#su-email").fill(EMAIL);
      await p.locator("#su-password").fill(PW);
    },
    enterIn: "#su-password",
  },
  {
    route: "/zaboravljena-lozinka",
    form: "form",
    label: "zaboravljena-lozinka",
    fill: async (p) => {
      await p.locator("#rp-email").fill(EMAIL);
    },
    enterIn: "#rp-email",
  },
  {
    route: "/za-majstore/registracija",
    form: "form:has(#mr-password)",
    label: "majstor",
    fill: async (p) => {
      await p.locator("#mr-email").fill(EMAIL);
      await p.locator("#mr-password").fill(PW);
      await p.locator("#mr-companyName").fill("Servis Verify");
    },
    enterIn: "#mr-password",
  },
  {
    route: "/upit",
    form: "form:has(#iq-vin)",
    label: "upit",
    fill: async (p) => {
      await p.locator("#iq-vin").fill("WVWZZZ1KZ8W123456");
      await p.locator("#iq-message").fill("Turbina za Golf 7.");
      await p.locator("#iq-name").fill("Verify Tester");
      await p.locator("#iq-phone").fill("0651234567");
    },
    enterIn: "#iq-name",
  },
  {
    route: `/deo/${OOS}`,
    form: '[data-testid="back-in-stock-form"]',
    label: "back-in-stock",
    fill: async (p) => {
      await p.locator("#bis-email").fill(EMAIL);
    },
    enterIn: "#bis-email",
  },
];

const leakedIn = (url) => SECRET.test(new URL(url).search);

async function probeNoJs(browser, engine, r, opts = {}) {
  const { width = 390, height = 844, shotIt = false, forcePost = false } = opts;
  const ctx = await ctxFor(browser, engine, { width, height });
  const page = await ctx.newPage();
  const nav = trackNav(page);
  const out = { label: `${engine}-nojs-${width} ${r.route}` };
  try {
    await page.goto(`${BASE}${r.route}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    out.form = await formInfo(page, r.form);
    await r.fill(page);
    const before = nav.length;
    // Implicit submission (Enter) and a forced click on the (disabled) submit button.
    await page.locator(r.enterIn).press("Enter");
    await page.waitForTimeout(1200);
    const sub = page.locator(`${r.form} button[type=submit]`).last();
    await sub
      .click({ force: true, timeout: 3000 })
      .catch((e) => (out.clickError = String(e).split("\n")[0].slice(0, 120)));
    await page.waitForTimeout(1500);
    out.navAfterSubmitAttempts = nav.slice(before);
    out.finalUrl = page.url().replace(BASE, "");
    out.leaked = leakedIn(page.url());
    if (shotIt) {
      await page.locator(r.form).first().scrollIntoViewIfNeeded().catch(() => {});
      await page.evaluate(() => {
        const b = document.createElement("div");
        b.textContent = "URL: " + location.pathname + location.search;
        b.style.cssText =
          "position:fixed;left:0;right:0;top:0;z-index:99999;background:#ff0;color:#000;font:14px monospace;padding:6px;word-break:break-all";
        document.body.appendChild(b);
      });
      out.evidence = await shot(page, `../fix/forms-auth/verify/a11y04-nojs-${r.label}-${engine}-${width}`);
    }
    if (forcePost) {
      // Defence in depth: if a browser ever submitted natively, it is a POST with nothing in the URL.
      let postResponse = null;
      page.on("response", async (resp) => {
        const req = resp.request();
        if (req.isNavigationRequest() && req.method() === "POST") {
          const body = await resp.text().catch(() => "");
          postResponse = { status: resp.status(), echoesPassword: body.includes(PW), echoesEmail: body.includes(EMAIL) };
        }
      });
      await page.evaluate(
        (sel) =>
          document
            .querySelector(sel)
            ?.querySelectorAll("button[disabled]")
            .forEach((b) => b.removeAttribute("disabled")),
        r.form,
      );
      const b2 = nav.length;
      await Promise.all([
        page.waitForEvent("framenavigated", { timeout: 20000 }).catch(() => null),
        page.locator(`${r.form} button[type=submit]`).last().click({ timeout: 5000 }),
      ]);
      await page.waitForTimeout(2000);
      out.forcedNativeSubmit = {
        nav: nav.slice(b2),
        finalUrl: page.url().replace(BASE, ""),
        leaked: leakedIn(page.url()),
        response: postResponse,
      };
    }
  } catch (e) {
    out.error = String(e).split("\n").slice(0, 2).join(" | ").slice(0, 300);
  }
  results.push(out);
  console.log(JSON.stringify(out).slice(0, 1000));
  await ctx.close();
}

async function probePrehydration(browser, r) {
  const ctx = await ctxFor(browser, "chromium", { js: true });
  let release;
  const gate = new Promise((res) => (release = res));
  await ctx.route(/\/_next\/static\/chunks\/.*\.js/, async (route) => {
    await gate;
    await route.continue().catch(() => {});
  });
  const page = await ctx.newPage();
  const nav = trackNav(page);
  const out = { label: `chromium-js-prehydration-390 ${r.route}` };
  try {
    await page.goto(`${BASE}${r.route}`, { waitUntil: "domcontentloaded", timeout: 180000 });
    out.hydratedAtSubmit = await page.evaluate((sel) => {
      const f = document.querySelector(sel);
      return !!f && Object.keys(f).some((k) => k.startsWith("__react"));
    }, r.form);
    out.form = await formInfo(page, r.form);
    await r.fill(page);
    const before = nav.length;
    await page.locator(r.enterIn).press("Enter");
    await page.waitForTimeout(1000);
    await page
      .locator(`${r.form} button[type=submit]`)
      .last()
      .click({ force: true, timeout: 3000 })
      .catch(() => {});
    await page.waitForTimeout(1000);
    out.navBeforeHydration = nav.slice(before);
    release();
    await page.waitForFunction(
      (sel) => {
        const b = document.querySelector(sel)?.querySelector("button[type=submit]");
        return b && !b.disabled;
      },
      r.form,
      { timeout: 120000 },
    );
    out.enabledAfterHydration = true;
    out.finalUrl = page.url().replace(BASE, "");
    out.leaked = leakedIn(page.url());
    if (r.label === "prijava") {
      // Hydrated: wrong credentials → message, no navigation with the password.
      const b2 = nav.length;
      await page.locator('input[name="password"]').press("Enter");
      await page.waitForTimeout(6000);
      out.afterHydratedSubmit = {
        nav: nav.slice(b2),
        url: page.url().replace(BASE, ""),
        alert: await page.evaluate(() =>
          [...document.querySelectorAll('[role="alert"]')].map((e) => e.textContent.trim()).filter(Boolean),
        ),
        passwordLength: (await page.locator('input[name="password"]').inputValue()).length,
      };
    }
  } catch (e) {
    out.error = String(e).split("\n").slice(0, 2).join(" | ").slice(0, 300);
  }
  results.push(out);
  console.log(JSON.stringify(out).slice(0, 1000));
  await ctx.close();
}

// A. Chromium, JS disabled, 390 (every form) + 1440 /prijava; B. pre-hydration with JS on.
{
  const browser = await launch("chromium");
  try {
    for (const r of ROUTES) {
      await probeNoJs(browser, "chromium", r, {
        shotIt: ["prijava", "upit", "back-in-stock", "majstor"].includes(r.label),
        forcePost: ["prijava", "registracija", "upit"].includes(r.label),
      });
    }
    await probeNoJs(browser, "chromium", ROUTES[0], { width: 1440, height: 900, shotIt: true });
    for (const r of ROUTES.slice(0, 5)) await probePrehydration(browser, r);
  } finally {
    await browser.close();
  }
}

// C. Firefox and WebKit, JS disabled, /prijava and /registracija.
for (const engine of ["firefox", "webkit"]) {
  const browser = await launch(engine);
  try {
    await probeNoJs(browser, engine, ROUTES[0], { shotIt: true });
    await probeNoJs(browser, engine, ROUTES[1]);
  } finally {
    await browser.close();
  }
}

writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log("saved", OUT);
