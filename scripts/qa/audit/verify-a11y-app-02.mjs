// Independent verification of a11y-app-02: credentials in the URL on native (pre-hydration / no-JS) submit.
import { writeFileSync } from "node:fs";
import { BASE, launch, shot } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/a11y-app/a11y-app-02-reproduce.json";
const EMAIL = "verify-a11y-02@primer.rs";
const PW = "VerifyLozinka-777";
const results = [];

async function ctxFor(browser, engine, { width = 390, height = 844, js = false } = {}) {
  const ctx = await browser.newContext({
    viewport: { width, height },
    ...(engine === "firefox" ? {} : { isMobile: width < 1024, hasTouch: width < 1024 }),
    javaScriptEnabled: js,
    locale: "sr-Latn-RS",
  });
  const { hostname } = new URL(BASE);
  const value = encodeURIComponent(
    JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "audit-verify-0002" }),
  );
  await ctx.addCookies([{ name: "sk_consent", value, domain: hostname, path: "/", sameSite: "Lax" }]);
  return ctx;
}

function trackNav(page) {
  const nav = [];
  page.on("request", (r) => {
    if (r.isNavigationRequest() && r.frame() === page.mainFrame()) nav.push(`${r.method()} ${r.url().replace(BASE, "")}`);
  });
  return nav;
}

async function probe(page, route, fill, label, { shotName } = {}) {
  const nav = trackNav(page);
  await page.goto(`${BASE}${route}`, { waitUntil: "domcontentloaded" });
  const form = await page.evaluate(() =>
    [...document.querySelectorAll("form")]
      .map((f) => ({
        method: f.getAttribute("method"),
        action: f.getAttribute("action"),
        names: [...f.elements].map((e) => e.name).filter(Boolean),
        hasPassword: !!f.querySelector('input[type="password"]'),
      }))
      .filter((f) => f.hasPassword || f.names.includes("email")),
  );
  await fill(page);
  const before = nav.length;
  await Promise.all([
    page.waitForEvent("framenavigated", { timeout: 8000 }).catch(() => null),
    page.locator("form button[type=submit]").filter({ visible: true }).last().click({ timeout: 5000 }),
  ]);
  await page.waitForTimeout(1200);
  const url = page.url().replace(BASE, "");
  const leaked = /password=|newPassword=/.test(url);
  let evidence = null;
  if (shotName) {
    await page.evaluate(() => {
      const b = document.createElement("div");
      b.textContent = "URL: " + location.pathname + location.search;
      b.style.cssText =
        "position:fixed;left:0;right:0;top:0;z-index:99999;background:#ff0;color:#000;font:14px monospace;padding:6px;word-break:break-all";
      document.body.appendChild(b);
    });
    evidence = await shot(page, `verify/a11y-app/${shotName}`);
  }
  const r = { label, route, form, navAfterSubmit: nav.slice(before), finalUrl: url, leaked, evidence };
  results.push(r);
  console.log(JSON.stringify(r));
}

const fillSignIn = async (page) => {
  await page.locator('input[name="email"]').first().fill(EMAIL);
  await page.locator('input[name="password"]').first().fill(PW);
};
const fillSignUp = async (page) => {
  await page.locator('input[name="name"]').first().fill("Verify Tester");
  await page.locator('input[name="email"]').first().fill(EMAIL);
  await page.locator('input[name="password"]').first().fill(PW);
};
const fillMech = async (page) => {
  await page.locator("#mr-password").fill(PW);
  const email = page.locator('form input[type="email"]').first();
  if (await email.count()) await email.fill(EMAIL);
};
const fillReset = async (page) => {
  await page.locator('input[type="email"]').first().fill(EMAIL);
};

// A. Chromium, JS disabled, 390
{
  const browser = await launch("chromium");
  for (const [route, fill, name] of [
    ["/prijava", fillSignIn, "a11y-app-02-reproduce-nojs-prijava-390"],
    ["/registracija", fillSignUp, "a11y-app-02-reproduce-nojs-registracija-390"],
    ["/za-majstore/registracija", fillMech, "a11y-app-02-reproduce-nojs-majstor-390"],
    ["/zaboravljena-lozinka", fillReset, null],
  ]) {
    const ctx = await ctxFor(browser, "chromium");
    const page = await ctx.newPage();
    try {
      await probe(page, route, fill, `chromium-nojs-390 ${route}`, { shotName: name });
    } catch (e) {
      results.push({ label: route, error: String(e).slice(0, 300) });
      console.log(route, e);
    }
    await ctx.close();
  }
  // A2. 1440 variant
  {
    const ctx = await ctxFor(browser, "chromium", { width: 1440, height: 900 });
    const page = await ctx.newPage();
    try {
      await probe(page, "/prijava", fillSignIn, "chromium-nojs-1440 /prijava");
    } catch (e) {
      results.push({ label: "1440", error: String(e).slice(0, 300) });
    }
    await ctx.close();
  }
  // B. JS enabled but client chunks held back (slow network before hydration)
  {
    const ctx = await ctxFor(browser, "chromium", { js: true });
    const held = [];
    await ctx.route(/\/_next\/static\/chunks\/.*\.js/, (route) => {
      held.push(route);
    });
    const page = await ctx.newPage();
    const nav = trackNav(page);
    await page.goto(`${BASE}/prijava`, { waitUntil: "commit" });
    await page.locator('input[name="password"]').waitFor({ timeout: 15000 });
    const hydrated = await page.evaluate(() => {
      const f = document.querySelector("form");
      return !!f && Object.keys(f).some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps"));
    });
    await fillSignIn(page);
    const before = nav.length;
    await page.locator('input[name="password"]').press("Enter");
    await page.waitForTimeout(2500);
    const url = page.url().replace(BASE, "");
    const r = {
      label: "chromium-js-prehydration-390 /prijava (Enter)",
      heldChunks: held.length,
      hydratedAtSubmit: hydrated,
      navAfterSubmit: nav.slice(before),
      finalUrl: url,
      leaked: /password=/.test(url),
    };
    results.push(r);
    console.log(JSON.stringify(r));
    for (const h of held) await h.abort().catch(() => {});
    await ctx.close();
  }
  // C. Control: JS enabled and hydrated — submit must not navigate with the password
  {
    const ctx = await ctxFor(browser, "chromium", { js: true });
    const page = await ctx.newPage();
    const nav = trackNav(page);
    await page.goto(`${BASE}/prijava`, { waitUntil: "networkidle" }).catch(() => {});
    await page
      .waitForFunction(
        () => {
          const f = document.querySelector("form");
          return f && Object.keys(f).some((k) => k.startsWith("__reactProps"));
        },
        null,
        { timeout: 20000 },
      )
      .catch(() => {});
    await fillSignIn(page);
    const before = nav.length;
    await page.locator('input[name="password"]').press("Enter");
    await page.waitForTimeout(3000);
    const r = {
      label: "chromium-js-hydrated-390 /prijava (control)",
      navAfterSubmit: nav.slice(before),
      finalUrl: page.url().replace(BASE, ""),
      leaked: /password=/.test(page.url()),
    };
    results.push(r);
    console.log(JSON.stringify(r));
    await ctx.close();
  }
  await browser.close();
}

// D. Firefox and WebKit, JS disabled
for (const engine of ["firefox", "webkit"]) {
  try {
    const browser = await launch(engine);
    const ctx = await ctxFor(browser, engine);
    const page = await ctx.newPage();
    await probe(page, "/prijava", fillSignIn, `${engine}-nojs-390 /prijava`, {
      shotName: engine === "webkit" ? "a11y-app-02-reproduce-nojs-prijava-webkit-390" : null,
    });
    await browser.close();
  } catch (e) {
    results.push({ label: engine, error: String(e).slice(0, 300) });
    console.log(engine, e);
  }
}

writeFileSync(OUT, JSON.stringify(results, null, 2));
console.log("saved", OUT);
