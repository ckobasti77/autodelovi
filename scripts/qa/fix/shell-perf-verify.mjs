// Step 22 · shell-perf verification (VIS-03, PERF-01/05/06/11, A11Y-05/06, SEO-05/11/13, PERF-19, VIS-35).
// Usage (Git Bash): AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/shell-perf-verify.mjs [section…]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, scrollThrough, revealCheck, shot, loginWith } from "../audit/kit.mjs";

const OUT = "docs/qa/fix/shell-perf";
mkdirSync(OUT, { recursive: true });
const want = new Set(process.argv.slice(2));
const run = (name) => want.size === 0 || want.has(name);
const result = {};
const accounts = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));

// Exact classes Header.tsx gives the phone/Viber icon links (settings are empty on the dev deployment).
const headerSrc = readFileSync("components/shell/Header.tsx", "utf8");
const iconLink = headerSrc.match(/const iconLink =\s*"([^"]+)"/)[1];
const contactIconClass = `${iconLink} hidden sm:inline-flex min-[90rem]:hidden`;

async function headerMetrics(page, simulateContacts) {
  return page.evaluate(({ simulateContacts, cls }) => {
    const header = document.querySelector("[data-testid='site-header']");
    if (simulateContacts) {
      const account = header.querySelector("[data-testid='account-button']");
      for (const label of ["Pozovite +381 64 123 4567", "Viber +381 64 123 4567"]) {
        const a = document.createElement("a");
        a.href = "#";
        a.className = cls;
        a.setAttribute("aria-label", label);
        a.setAttribute("data-sim", "");
        a.innerHTML = '<svg width="24" height="24"></svg>';
        account.parentElement.insertBefore(a, account);
      }
    }
    const menu = document.querySelector("[data-testid='mobile-menu-trigger']");
    const visible = [...header.querySelectorAll("a, button")]
      .filter((el) => el.getClientRects().length && getComputedStyle(el).display !== "none")
      .map((el) => el.getAttribute("aria-label") || el.textContent.trim().slice(0, 20));
    const r = menu?.getBoundingClientRect();
    return {
      vw: window.innerWidth,
      docScrollW: document.documentElement.scrollWidth,
      headerScrollW: header.scrollWidth,
      menuLeft: r ? Math.round(r.left) : null,
      menuRight: r ? Math.round(r.right) : null,
      simulatedShown: [...header.querySelectorAll("[data-sim]")].filter((el) => getComputedStyle(el).display !== "none").length,
      visible,
    };
  }, { simulateContacts, cls: contactIconClass });
}

const browser = await launch();
try {
  if (run("header")) {
    const rows = [];
    for (const width of [320, 360, 390, 480, 1440]) {
      const context = await newContext(browser, { width, height: 800, tag: `hdr${width}` });
      const page = await context.newPage();
      await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
      const m = await headerMetrics(page, true);
      rows.push({ who: "guest+phone+viber", width, ...m });
      if ([320, 360, 390, 1440].includes(width)) {
        await shot(page, `../fix/shell-perf/header-${width}`, { clip: { x: 0, y: 0, width, height: 72 } });
      }
      await context.close();
    }
    const context = await newContext(browser, { width: 360, height: 780, tag: "hdrmech" });
    const page = await context.newPage();
    await loginWith(page, accounts.mechanic.email, accounts.mechanic.password, "/majstor");
    await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
    for (const width of [320, 360, 390, 480]) {
      await page.setViewportSize({ width, height: 780 });
      await page.waitForTimeout(200);
      rows.push({ who: "mechanic+phone+viber", width, ...(await headerMetrics(page, width === 320)) });
    }
    await page.setViewportSize({ width: 360, height: 780 });
    await shot(page, "../fix/shell-perf/header-360-mechanic", { clip: { x: 0, y: 0, width: 360, height: 72 } });
    await context.close();
    result.header = rows;
  }

  if (run("overlays")) {
    const context = await newContext(browser, { width: 390, height: 844, tag: "ovl" });
    const page = await context.newPage();
    const log = watch(page);
    const scripts = [];
    page.on("request", (r) => r.resourceType() === "script" && scripts.push(r.url()));
    await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
    const before = scripts.length;
    await page.getByRole("button", { name: "Pretraga delova" }).first().click();
    const input = page.getByTestId("header-search-input");
    await input.waitFor({ timeout: 15000 });
    const searchFocused = await input.evaluate((el) => el === document.activeElement || el.contains(document.activeElement));
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const afterSearch = await page.evaluate(() => document.activeElement?.getAttribute("aria-label") ?? document.activeElement?.tagName);
    await page.getByTestId("mobile-menu-trigger").click();
    const kontakt = page.getByRole("dialog").getByRole("link", { name: "Svi podaci za kontakt" });
    await kontakt.waitFor({ timeout: 15000 });
    const kontaktHref = await kontakt.getAttribute("href");
    const expanded = await page.getByTestId("mobile-menu-trigger").getAttribute("aria-expanded");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(500);
    const footerKontakt = await page.locator("footer a[href='/kontakt']").count();
    result.overlays = {
      lazyChunksLoadedOnIntent: scripts.length - before,
      searchFocused,
      focusAfterSearchClose: afterSearch,
      menuKontaktHref: kontaktHref,
      menuExpandedWhileOpen: expanded,
      footerKontaktLinks: footerKontakt,
      errors: [...log.console, ...log.pageErrors],
    };
    await context.close();
  }

  if (run("reveal")) {
    const rows = [];
    for (const [path, width, reducedMotion] of [
      ["/", 390, "no-preference"],
      ["/delovi/kocioni-diskovi", 390, "no-preference"],
      ["/delovi/kocioni-diskovi", 1440, "no-preference"],
      ["/delovi/kocioni-diskovi", 390, "reduce"],
    ]) {
      const context = await newContext(browser, { width, height: width < 1024 ? 844 : 900, reducedMotion, tag: "rv" });
      const page = await context.newPage();
      const log = watch(page);
      await page.goto(`${BASE}${path}`, { waitUntil: "load" });
      // Catch a word animation in flight (CSS keyframes, not GSAP).
      const sample = await page
        .waitForFunction(
          () => {
            const w = document.querySelector("[data-reveal-state='running'] .reveal-word");
            return w ? getComputedStyle(w).animationName : null;
          },
          null,
          { timeout: 6000, polling: 30 },
        )
        .then((h) => h.jsonValue())
        .catch(() => null);
      await page.waitForLoadState("networkidle");
      await scrollThrough(page);
      await page.waitForTimeout(1500);
      const check = await revealCheck(page);
      const html = await page.evaluate(() => document.documentElement.className.split(" ").filter((c) => c.startsWith("tr-")));
      const done = await page.locator("[data-reveal-state='done']").count();
      rows.push({ path, width, reducedMotion, wordAnimation: sample, ...check, htmlClasses: html, done, errors: [...log.console, ...log.pageErrors] });
      await context.close();
    }
    // Failsafe fired before the observer mounted: nothing may be hidden or re-animated.
    {
      const context = await newContext(browser, { width: 390, height: 844, tag: "fs" });
      await context.addInitScript(() => {
        new MutationObserver((_, obs) => {
          const html = document.documentElement;
          if (html?.classList.contains("tr-js")) {
            html.classList.add("tr-failsafe");
            obs.disconnect();
          }
        }).observe(document, { attributes: true, attributeFilter: ["class"], subtree: true, childList: true });
      });
      const page = await context.newPage();
      await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
      await page.waitForTimeout(1500);
      const running = await page.locator("[data-reveal-state]").count();
      const failsafeClass = await page.evaluate(() => document.documentElement.classList.contains("tr-failsafe"));
      await scrollThrough(page);
      rows.push({ path: "/delovi/kocioni-diskovi (failsafe)", failsafeClass, markedAfterFailsafe: running, ...(await revealCheck(page)) });
      await context.close();
    }
    // No JavaScript.
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, javaScriptEnabled: false });
      const page = await context.newPage();
      await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
      rows.push({ path: "/delovi/kocioni-diskovi (no JS)", ...(await revealCheck(page)) });
      await context.close();
    }
    result.reveal = rows;
  }

  if (run("consent")) {
    const context = await newContext(browser, { width: 390, height: 844, consent: false, tag: "cb" });
    const page = await context.newPage();
    const log = watch(page);
    const t0 = Date.now();
    let wsAt = null;
    page.on("websocket", (ws) => { if (ws.url().includes("convex")) wsAt ??= Date.now() - t0; });
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
    const loadAt = Date.now() - t0;
    await page.waitForLoadState("networkidle");
    const banner = page.getByTestId("consent-banner");
    const info = await banner.evaluate((el) => {
      const r = el.getBoundingClientRect();
      const [accept, reject] = [...el.querySelectorAll("button[type=submit]")].map((b) => b.getBoundingClientRect().top);
      return {
        height: Math.round(r.height),
        nosnippet: el.hasAttribute("data-nosnippet"),
        decisionsSideBySide: accept === reject,
        scrollPaddingBottom: getComputedStyle(document.documentElement).scrollPaddingBottom,
      };
    });
    await shot(page, "../fix/shell-perf/consent-390");
    // Tab through the page: how many focused controls end up under the banner?
    let covered = 0;
    for (let i = 0; i < 30; i += 1) {
      await page.keyboard.press("Tab");
      covered += await page.evaluate(() => {
        const el = document.activeElement;
        const b = document.querySelector("[data-testid='consent-banner']");
        if (!el || !b || b.contains(el)) return 0;
        const r = el.getBoundingClientRect();
        return r.bottom > b.getBoundingClientRect().top + 1 ? 1 : 0;
      });
    }
    await page.locator("main").first().click({ position: { x: 5, y: 5 } }).catch(() => {});
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);
    const collapsed = await banner.evaluate((el) => ({ collapsed: el.hasAttribute("data-collapsed"), height: Math.round(el.getBoundingClientRect().height) }));
    await shot(page, "../fix/shell-perf/consent-390-collapsed");
    await banner.getByRole("button", { name: "Podešavanja" }).click();
    await page.waitForFunction(() => document.activeElement?.getAttribute("role") === "switch", null, { timeout: 15000 }).catch(() => {});
    const focusAfterSettings = await page.evaluate(() => `${document.activeElement?.getAttribute("role")}:${document.activeElement?.closest("[data-testid]")?.getAttribute("data-testid") ?? ""}:${document.activeElement?.textContent?.trim().slice(0, 20) ?? ""}`);
    await banner.getByRole("button", { name: "Odbij sve" }).click();
    await page.waitForTimeout(800);
    // Returning visitor: the banner module is not loaded until the footer reopens it.
    const page2 = await context.newPage();
    const scripts = [];
    page2.on("request", (r) => r.resourceType() === "script" && scripts.push(r.url()));
    await page2.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
    const bannerInDom = await page2.getByTestId("consent-banner").count();
    const n = scripts.length;
    await page2.getByTestId("consent-reopen").click();
    await page2.getByTestId("consent-banner").waitFor({ timeout: 15000 });
    await page2.waitForTimeout(600);
    const reopen = await page2.evaluate(() => ({
      focus: document.activeElement?.textContent?.trim(),
      switches: document.querySelectorAll("[data-testid='consent-banner'] [role='switch']").length,
    }));
    result.consent = {
      ...info,
      tabStopsCoveredOf30: covered,
      afterEscape: collapsed,
      focusAfterSettings,
      returning: { bannerInDomBeforeReopen: bannerInDom, chunksOnReopen: scripts.length - n, ...reopen },
      convexSocket: { wsOpenedAtMs: wsAt, loadAtMs: loadAt },
      errors: [...log.console, ...log.pageErrors],
    };
    await context.close();
  }

  if (run("headers")) {
    const admin = await fetch(`${BASE}/admin/prijava`, { redirect: "manual" });
    const glb = await fetch(`${BASE}/models/car.manifest.json`, { method: "HEAD" });
    const poster = await fetch(`${BASE}/images/parts/motor.webp`, { method: "HEAD" });
    result.headers = {
      adminXRobots: admin.headers.get("x-robots-tag"),
      modelsCache: glb.headers.get("cache-control"),
      imagesCache: poster.headers.get("cache-control"),
    };
    const context = await newContext(browser, { width: 1024, height: 800, tag: "print" });
    const page = await context.newPage();
    await page.goto(`${BASE}/kontakt`, { waitUntil: "networkidle" });
    await page.emulateMedia({ media: "print" });
    result.print = await page.evaluate(() => ({
      html: getComputedStyle(document.documentElement).backgroundColor,
      body: getComputedStyle(document.body).backgroundColor,
    }));
    await context.close();
  }
} finally {
  await browser.close();
}
const file = `${OUT}/verify-${[...want].join("-") || "all"}.json`;
writeFileSync(file, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 1).slice(0, 6000));
