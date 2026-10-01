// Step 22 · independent re-verification of package "shell-perf" (PERF-01, VIS-03).
// Usage (Git Bash): AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/shell-perf-reverify.mjs [section…]
// Sections: header, overlays, consent, reveal, socket. Output: docs/qa/fix/shell-perf/verify/.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import {
  BASE,
  launch,
  newContext,
  watch,
  scrollThrough,
  revealCheck,
  shot,
  loginWith,
} from "../audit/kit.mjs";

const OUT = "docs/qa/fix/shell-perf/verify";
mkdirSync(OUT, { recursive: true });
const want = new Set(process.argv.slice(2));
const run = (name) => want.size === 0 || want.has(name);
const accounts = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const result = {};
const save = () =>
  writeFileSync(
    `${OUT}/reverify-${[...want].join("-") || "all"}.json`,
    JSON.stringify(result, null, 2),
  );

// ---------------------------------------------------------------------------------------------
// Exact class strings from the current Header.tsx (not copied by hand).
const headerSrc = readFileSync("components/shell/Header.tsx", "utf8");
const iconLink = headerSrc.match(/const iconLink =\s*"([^"]+)"/)[1];
const textLink = headerSrc.match(/const textLink =\s*"([^"]+)"/)[1];
const templates = [
  ...headerSrc.matchAll(/className=\{`(\$\{(?:iconLink|textLink)\}[^`]*)`\}/g),
].map((m) => m[1].replace("${iconLink}", iconLink).replace("${textLink}", textLink));
// Order in Header.tsx: phone text, phone icon, viber text, viber icon, account.
const [phoneText, phoneIcon, viberText, viberIcon, accountCls] = templates;
const SIM = [
  {
    label: "SIM Pozovite (text)",
    cls: phoneText,
    html: '<svg width="20" height="20" aria-hidden="true"></svg>Pozovite',
  },
  {
    label: "SIM Pozovite +381 64 123 4567",
    cls: phoneIcon,
    html: '<svg width="24" height="24" aria-hidden="true"></svg>',
  },
  {
    label: "SIM Viber (text)",
    cls: viberText,
    html: '<svg width="20" height="20" aria-hidden="true"></svg>Viber',
  },
  {
    label: "SIM Viber +381 64 123 4567",
    cls: viberIcon,
    html: '<svg width="24" height="24" aria-hidden="true"></svg>',
  },
];

async function injectContacts(page) {
  await page.evaluate((sim) => {
    if (document.querySelector("[data-sim]")) return;
    const account = document.querySelector("[data-testid='account-button']");
    const prev = account.previousElementSibling;
    const anchor = prev && prev.getAttribute("aria-label") === "Brza porudžbina" ? prev : account;
    for (const s of sim) {
      const a = document.createElement("a");
      a.href = "#";
      a.className = s.cls;
      a.setAttribute("aria-label", s.label);
      a.setAttribute("data-sim", "");
      a.innerHTML = s.html;
      anchor.parentElement.insertBefore(a, anchor);
    }
  }, SIM);
}

async function headerMetrics(page) {
  return page.evaluate(() => {
    const header = document.querySelector("[data-testid='site-header']");
    const row = header.firstElementChild;
    const menu = document.querySelector("[data-testid='mobile-menu-trigger']");
    const r = menu?.getBoundingClientRect();
    const controls = [...header.querySelectorAll("a, button")]
      .filter((el) => el.getClientRects().length && getComputedStyle(el).display !== "none")
      .map((el) => {
        const b = el.getBoundingClientRect();
        return `${(el.getAttribute("aria-label") || el.textContent.trim()).slice(0, 28)}[${Math.round(b.left)}-${Math.round(b.right)}]`;
      });
    const sim = [...header.querySelectorAll("[data-sim]")].map(
      (el) => `${el.getAttribute("aria-label")}:${getComputedStyle(el).display}`,
    );
    const acct = header.querySelector("[data-testid='account-button']");
    return {
      vw: document.documentElement.clientWidth,
      docScrollW: document.documentElement.scrollWidth,
      rowScrollW: row.scrollWidth,
      rowClientW: row.clientWidth,
      menu:
        r && getComputedStyle(menu.parentElement).display !== "none"
          ? `${Math.round(r.left)}-${Math.round(r.right)}`
          : "hidden",
      menuFullyInView: r ? r.left >= 0 && r.right <= document.documentElement.clientWidth : null,
      accountDisplay: acct ? getComputedStyle(acct).display : null,
      sim,
      controls,
    };
  });
}

// Script chunks: which lazily loaded modules were downloaded (Turbopack dev module ids).
const MARKERS = {
  HeaderSearchPanel:
    'components/shell/HeaderSearchPanel.tsx [app-client] (ecmascript)", ((__turbopack_context__)',
  MobileNavPanel:
    'components/shell/MobileNavPanel.tsx [app-client] (ecmascript)", ((__turbopack_context__)',
  ConsentBanner:
    'components/consent/ConsentBanner.tsx [app-client] (ecmascript)", ((__turbopack_context__)',
  ConsentDetails:
    'components/consent/ConsentDetails.tsx [app-client] (ecmascript)", ((__turbopack_context__)',
  SearchBox: 'components/shell/SearchBox.tsx [app-client] (ecmascript)", ((__turbopack_context__)',
  Sheet: 'components/ui/Sheet.tsx [app-client] (ecmascript)", ((__turbopack_context__)',
  Dialog: 'components/ui/Dialog.tsx [app-client] (ecmascript)", ((__turbopack_context__)',
  Switch: 'components/ui/Switch.tsx [app-client] (ecmascript)", ((__turbopack_context__)',
};
function trackChunks(page) {
  const loaded = new Set();
  const pending = [];
  page.on("response", (res) => {
    if (res.request().resourceType() !== "script") return;
    pending.push(
      res
        .text()
        .then((body) => {
          for (const [name, marker] of Object.entries(MARKERS))
            if (body.includes(marker)) loaded.add(name);
        })
        .catch(() => {}),
    );
  });
  return {
    async snapshot() {
      await Promise.all(pending);
      return [...loaded].sort();
    },
  };
}

const active = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    return `${el.tagName.toLowerCase()}:${(el.getAttribute("aria-label") || el.getAttribute("data-testid") || el.textContent || "").trim().slice(0, 40)}`;
  });

const browser = await launch();
try {
  // ===========================================================================================
  if (run("header")) {
    const out = {
      classes: { iconLink, textLink, phoneText, phoneIcon, viberText, viberIcon, accountCls },
      guest: [],
      mechanic: [],
    };
    const ctx = await newContext(browser, { width: 360, height: 780, tag: "rvhdr" });
    const page = await ctx.newPage();
    const log = watch(page);
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
    for (const width of [
      320, 360, 390, 430, 479, 480, 640, 768, 1023, 1024, 1280, 1439, 1440, 1920,
    ]) {
      await page.setViewportSize({ width, height: 800 });
      await page.waitForTimeout(250);
      const real = await headerMetrics(page);
      await injectContacts(page);
      await page.waitForTimeout(100);
      const sim = await headerMetrics(page);
      out.guest.push({ width, real, simPhoneViber: sim });
      if ([320, 360, 390, 480, 1024, 1440].includes(width)) {
        await shot(page, `../fix/shell-perf/verify/header-guest-sim-${width}`, {
          clip: { x: 0, y: 0, width, height: 64 },
        });
      }
      await page.evaluate(() => document.querySelectorAll("[data-sim]").forEach((e) => e.remove()));
    }
    // Keyboard order at 360 (guest, real header).
    await page.setViewportSize({ width: 360, height: 780 });
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
    await page.evaluate(() => document.activeElement?.blur());
    const tabs = [];
    for (let i = 0; i < 6; i += 1) {
      await page.keyboard.press("Tab");
      tabs.push(await active(page));
    }
    out.guestTabOrder360 = tabs;
    out.guestErrors = [...log.console, ...log.pageErrors];
    await ctx.close();

    const mctx = await newContext(browser, { width: 360, height: 780, tag: "rvhdrm" });
    const mpage = await mctx.newPage();
    const mlog = watch(mpage);
    await loginWith(mpage, accounts.mechanic.email, accounts.mechanic.password, "/majstor");
    for (const route of ["/delovi", "/majstor/cenovnik"]) {
      await mpage.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await mpage
        .waitForFunction(
          () =>
            document.querySelector("[data-testid='account-button']")?.hasAttribute("data-mechanic"),
          null,
          { timeout: 20000 },
        )
        .catch(() => {});
      for (const width of [320, 360, 390, 480, 1024]) {
        await mpage.setViewportSize({ width, height: 780 });
        await mpage.waitForTimeout(250);
        const real = await headerMetrics(mpage);
        await injectContacts(mpage);
        await mpage.waitForTimeout(100);
        const sim = await headerMetrics(mpage);
        out.mechanic.push({ route, width, real, simPhoneViber: sim });
        if (route === "/delovi" && [320, 360, 390].includes(width)) {
          await shot(mpage, `../fix/shell-perf/verify/header-mechanic-sim-${width}`, {
            clip: { x: 0, y: 0, width, height: 64 },
          });
        }
        await mpage.evaluate(() =>
          document.querySelectorAll("[data-sim]").forEach((e) => e.remove()),
        );
      }
    }
    // The links hidden below 480 must be in the mobile menu.
    await mpage.setViewportSize({ width: 360, height: 780 });
    await mpage.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
    await mpage
      .waitForFunction(
        () =>
          document.querySelector("[data-testid='account-button']")?.hasAttribute("data-mechanic"),
        null,
        { timeout: 20000 },
      )
      .catch(() => {});
    await mpage.getByTestId("mobile-menu-trigger").tap();
    const sheet = mpage.getByRole("dialog", { name: "Meni" });
    await sheet.waitFor({ timeout: 20000 });
    await mpage.waitForTimeout(800);
    out.mechanicMenuLinks = await sheet.getByRole("link").allTextContents();
    await shot(mpage, "../fix/shell-perf/verify/menu-mechanic-360");
    out.mechanicErrors = [...mlog.console, ...mlog.pageErrors];
    await mctx.close();
    result.header = out;
    save();
  }

  // ===========================================================================================
  if (run("overlays")) {
    const out = {};
    // Phone, guest, /delovi.
    {
      const ctx = await newContext(browser, { width: 390, height: 844, tag: "rvovl" });
      const page = await ctx.newPage();
      const log = watch(page);
      const chunks = trackChunks(page);
      await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2500);
      out.phoneInitialLazyModules = await chunks.snapshot();
      const trigger = page.locator(
        "[data-testid='site-header'] button[aria-label='Pretraga delova']",
      );
      out.searchTriggerAttrs = await trigger.evaluate((el) => ({
        haspopup: el.getAttribute("aria-haspopup"),
        expanded: el.getAttribute("aria-expanded"),
      }));
      const t0 = Date.now();
      await trigger.tap();
      const input = page.getByTestId("header-search-input").locator("input");
      await input.waitFor({ timeout: 20000 });
      out.searchFirstOpenMs = Date.now() - t0;
      await page.waitForTimeout(400);
      out.afterSearchOpenModules = await chunks.snapshot();
      out.searchInputFocused = await input.evaluate((el) => el === document.activeElement);
      out.searchExpandedWhileOpen = await trigger.getAttribute("aria-expanded");
      await input.fill("disk");
      out.searchResults = await page
        .getByRole("option")
        .first()
        .waitFor({ timeout: 20000 })
        .then(async () => (await page.getByRole("option").allTextContents()).slice(0, 3))
        .catch((e) => `no options: ${String(e).slice(0, 80)}`);
      await shot(page, "../fix/shell-perf/verify/search-open-390");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(700);
      out.searchAfterEscape = {
        dialogs: await page.getByRole("dialog").count(),
        focus: await active(page),
        expanded: await trigger.getAttribute("aria-expanded"),
      };
      const t1 = Date.now();
      await trigger.tap();
      await input.waitFor({ timeout: 20000 });
      out.searchSecondOpenMs = Date.now() - t1;
      out.searchSecondOpenFocused = await input.evaluate((el) => el === document.activeElement);
      await page.getByRole("dialog").getByRole("button", { name: "Zatvori" }).tap();
      await page.waitForTimeout(700);
      out.searchAfterCloseButton = {
        dialogs: await page.getByRole("dialog").count(),
        focus: await active(page),
      };

      // Mobile menu.
      const menu = page.getByTestId("mobile-menu-trigger");
      out.menuTriggerAttrs = await menu.evaluate((el) => ({
        haspopup: el.getAttribute("aria-haspopup"),
        expanded: el.getAttribute("aria-expanded"),
        label: el.getAttribute("aria-label"),
      }));
      const t2 = Date.now();
      await menu.tap();
      const sheet = page.getByRole("dialog", { name: "Meni" });
      await sheet.waitFor({ timeout: 20000 });
      out.menuFirstOpenMs = Date.now() - t2;
      await page.waitForTimeout(700);
      out.menuOpen = {
        expanded: await menu.getAttribute("aria-expanded"),
        focusInside: await sheet.evaluate((el) => el.contains(document.activeElement)),
        focus: await active(page),
        links: await sheet.getByRole("link").allTextContents(),
      };
      out.afterMenuOpenModules = await chunks.snapshot();
      await shot(page, "../fix/shell-perf/verify/menu-open-390");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(800);
      out.menuAfterEscape = {
        dialogs: await page.getByRole("dialog").count(),
        focus: await active(page),
        expanded: await menu.getAttribute("aria-expanded"),
      };
      // Reopen and follow a link: navigates and closes.
      await menu.tap();
      await sheet.waitFor({ timeout: 20000 });
      await page.waitForTimeout(500);
      await sheet.getByRole("link", { name: "Svi podaci za kontakt" }).tap();
      await page.waitForURL((u) => u.pathname === "/kontakt", { timeout: 30000 }).catch(() => {});
      await page.waitForTimeout(1000);
      out.menuLinkNav = {
        path: new URL(page.url()).pathname,
        dialogs: await page.getByRole("dialog").count(),
        expanded: await menu.getAttribute("aria-expanded"),
      };
      out.phoneErrors = [...log.console, ...log.pageErrors];
      await ctx.close();
    }
    // "/" shortcut on a fresh page (no warm-up), desktop 1440 field trigger.
    {
      const ctx = await newContext(browser, { width: 1440, height: 900, tag: "rvovld" });
      const page = await ctx.newPage();
      const log = watch(page);
      const chunks = trackChunks(page);
      await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
      await page.waitForTimeout(2000);
      out.desktopInitialLazyModules = await chunks.snapshot();
      await page
        .locator("main")
        .first()
        .click({ position: { x: 2, y: 2 } })
        .catch(() => {});
      await page.keyboard.press("/");
      const input = page.getByTestId("header-search-input").locator("input");
      out.slashOpens = await input
        .waitFor({ timeout: 20000 })
        .then(() => true)
        .catch(() => false);
      await page.waitForTimeout(300);
      out.slashInputFocused = await input
        .evaluate((el) => el === document.activeElement)
        .catch(() => null);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(700);
      out.slashAfterEscapeFocus = await active(page);
      // Keyboard: focus the field-like trigger and open with Enter.
      const field = page.getByTestId("header-search-trigger");
      await field.focus();
      await page.keyboard.press("Enter");
      out.enterOpens = await input
        .waitFor({ timeout: 20000 })
        .then(() => true)
        .catch(() => false);
      await page.waitForTimeout(300);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(700);
      out.enterAfterEscapeFocus = await active(page);
      out.desktopMenuTriggerDisplay = await page
        .getByTestId("mobile-menu-trigger")
        .evaluate((el) => getComputedStyle(el.parentElement).display);
      out.desktopErrors = [...log.console, ...log.pageErrors];
      await ctx.close();
    }
    // Reduced motion, keyboard-only menu at 390.
    {
      const ctx = await newContext(browser, {
        width: 390,
        height: 844,
        tag: "rvovlr",
        reducedMotion: "reduce",
      });
      const page = await ctx.newPage();
      const log = watch(page);
      await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
      const menu = page.getByTestId("mobile-menu-trigger");
      await menu.focus();
      await page.keyboard.press("Enter");
      const sheet = page.getByRole("dialog", { name: "Meni" });
      out.reducedMenuOpens = await sheet
        .waitFor({ timeout: 20000 })
        .then(() => true)
        .catch(() => false);
      await page.waitForTimeout(400);
      out.reducedMenuFocus = await active(page);
      out.reducedMenuOpacity = await sheet.evaluate((el) => getComputedStyle(el).opacity);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(600);
      out.reducedMenuAfterEscape = {
        dialogs: await page.getByRole("dialog").count(),
        focus: await active(page),
      };
      out.reducedErrors = [...log.console, ...log.pageErrors];
      await ctx.close();
    }
    result.overlays = out;
    save();
  }

  // ===========================================================================================
  if (run("consent")) {
    const out = {};
    const html = await (await fetch(`${BASE}/delovi/kocioni-diskovi`)).text();
    out.ssrFirstVisitHasBanner = html.includes('data-testid="consent-banner"');
    const ctx = await newContext(browser, { width: 390, height: 844, consent: false, tag: "rvcb" });
    const page = await ctx.newPage();
    const log = watch(page);
    const chunks = trackChunks(page);
    await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);
    out.firstVisitModules = await chunks.snapshot();
    const banner = page.getByTestId("consent-banner");
    out.bannerVisible = await banner.isVisible();
    await banner.getByRole("button", { name: "Podešavanja" }).tap();
    await page
      .waitForFunction(() => document.activeElement?.getAttribute("role") === "switch", null, {
        timeout: 20000,
      })
      .catch(() => {});
    out.afterSettingsFocus = await active(page);
    out.afterSettingsModules = await chunks.snapshot();
    out.switches = await banner.getByRole("switch").count();
    await banner.getByTestId("consent-analytics").tap();
    await shot(page, "../fix/shell-perf/verify/consent-first-detailed-390");
    await banner.getByRole("button", { name: "Sačuvaj izbor" }).tap();
    await page.waitForTimeout(1200);
    const cookie = (await ctx.cookies()).find((c) => c.name === "sk_consent");
    out.savedCookie = cookie ? decodeURIComponent(cookie.value) : null;
    out.bannerAfterSave = await banner.isVisible().catch(() => false);
    // Returning visitor.
    const page2 = await ctx.newPage();
    const log2 = watch(page2);
    const chunks2 = trackChunks(page2);
    await page2.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
    await page2.waitForTimeout(2000);
    out.returningModules = await chunks2.snapshot();
    out.returningBannerInDom = await page2.getByTestId("consent-banner").count();
    const reopen = page2.getByTestId("consent-reopen");
    await reopen.scrollIntoViewIfNeeded();
    await reopen.tap();
    const b2 = page2.getByTestId("consent-banner");
    await b2.waitFor({ timeout: 20000 });
    await page2.waitForTimeout(1200);
    out.reopen = {
      modules: await chunks2.snapshot(),
      focus: await active(page2),
      switches: await b2.getByRole("switch").count(),
      analyticsChecked: await b2
        .getByTestId("consent-analytics")
        .getAttribute("aria-checked")
        .catch(() => null),
      opacity: await b2.evaluate((el) => getComputedStyle(el.firstElementChild ?? el).opacity),
    };
    await shot(page2, "../fix/shell-perf/verify/consent-reopen-390");
    await b2.getByRole("button", { name: "Odbij sve" }).tap();
    await page2.waitForTimeout(1200);
    const cookie2 = (await ctx.cookies()).find((c) => c.name === "sk_consent");
    out.afterReject = {
      cookie: cookie2 ? decodeURIComponent(cookie2.value) : null,
      bannerVisible: await b2.isVisible().catch(() => false),
      focus: await active(page2),
    };
    // Second reopen in the same page (module stays mounted).
    await reopen.tap();
    out.secondReopenVisible = await b2
      .waitFor({ state: "visible", timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    await page2.keyboard.press("Escape");
    out.errors = [...log.console, ...log.pageErrors, ...log2.console, ...log2.pageErrors];
    await ctx.close();

    // No JavaScript: the server-rendered banner still decides.
    const njs = await browser.newContext({
      viewport: { width: 390, height: 844 },
      javaScriptEnabled: false,
    });
    const np = await njs.newPage();
    await np.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load" });
    const nb = np.getByTestId("consent-banner");
    out.noJs = { bannerVisible: await nb.isVisible() };
    await Promise.all([
      np.waitForLoadState("load"),
      nb.getByRole("button", { name: "Prihvati sve" }).click(),
    ]);
    await np.waitForTimeout(2000);
    const c3 = (await njs.cookies()).find((c) => c.name === "sk_consent");
    out.noJs.cookieAfterAccept = c3 ? decodeURIComponent(c3.value) : null;
    out.noJs.bannerAfter = await np.getByTestId("consent-banner").count();
    await njs.close();
    result.consent = out;
    save();
  }

  // ===========================================================================================
  if (run("reveal")) {
    const rows = [];
    for (const [path, width, reducedMotion] of [
      ["/", 390, "no-preference"],
      ["/", 1440, "no-preference"],
      ["/delovi/kocioni-diskovi", 360, "no-preference"],
      ["/deo/kocioni-disk-prednji-276-24-mm-demo-0004", 390, "no-preference"],
      ["/kontakt", 1440, "no-preference"],
      ["/delovi/kocioni-diskovi", 390, "reduce"],
    ]) {
      const ctx = await newContext(browser, {
        width,
        height: width < 1024 ? 844 : 900,
        reducedMotion,
        tag: "rvrv",
      });
      const page = await ctx.newPage();
      const log = watch(page);
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle" });
      await scrollThrough(page);
      await page.waitForTimeout(1500);
      rows.push({
        path,
        width,
        reducedMotion,
        ...(await revealCheck(page)),
        errors: [...log.console, ...log.pageErrors],
      });
      await ctx.close();
    }
    // Client-side navigation: new copy must still reveal (MutationObserver path).
    {
      const ctx = await newContext(browser, { width: 390, height: 844, tag: "rvrvnav" });
      const page = await ctx.newPage();
      const log = watch(page);
      await page.goto(`${BASE}/delovi`, { waitUntil: "networkidle" });
      await page.locator("main a[href^='/delovi/']").first().click();
      await page.waitForURL((u) => u.pathname.startsWith("/delovi/"), { timeout: 30000 });
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(800);
      await scrollThrough(page);
      await page.waitForTimeout(1500);
      rows.push({
        path: `client-nav → ${new URL(page.url()).pathname}`,
        width: 390,
        ...(await revealCheck(page)),
        errors: [...log.console, ...log.pageErrors],
      });
      await ctx.close();
    }
    result.reveal = rows;
    save();
  }

  // ===========================================================================================
  if (run("socket")) {
    const out = {};
    const probe = async (label, setup, { consent = true, path = "/delovi/kocioni-diskovi" } = {}) => {
      const ctx = await newContext(browser, { width: 390, height: 844, consent, tag: `rvws${label}` });
      // In-page clock: when the real WebSocket is constructed vs the load event.
      await ctx.addInitScript(() => {
        const Native = window.WebSocket;
        window.__wsLog = [];
        window.WebSocket = class extends Native {
          constructor(url, protocols) {
            super(url, protocols);
            window.__wsLog.push({
              url: String(url).slice(0, 60),
              at: Math.round(performance.now()),
              stack: (new Error().stack || "").split("\n").slice(2, 5).join(" | ").slice(0, 300),
            });
          }
        };
        window.__firstInput = null;
        for (const t of ["pointerdown", "keydown", "focusin"])
          window.addEventListener(
            t,
            (e) => {
              window.__firstInput ??= {
                type: t,
                at: Math.round(performance.now()),
                target: e.target?.tagName,
              };
            },
            true,
          );
      });
      const page = await ctx.newPage();
      if (setup) await setup(page);
      const log = watch(page);
      await page.goto(`${BASE}${path}`, { waitUntil: "load" });
      await page.waitForTimeout(6000);
      const timing = await page.evaluate(() => {
        const nav = performance.getEntriesByType("navigation")[0];
        return {
          loadEventEnd: Math.round(nav.loadEventEnd),
          ws: window.__wsLog.filter((w) => /convex/.test(w.url)),
          firstInput: window.__firstInput,
        };
      });
      const firstWs = timing.ws[0]?.at ?? null;
      const row = {
        ...timing,
        wsAfterLoad: firstWs === null ? null : firstWs >= timing.loadEventEnd,
      };
      // Live write right after load: add to cart and see the count.
      const add = page.getByTestId("product-add-to-cart").first();
      if (await add.count()) {
        await add.tap();
        row.cartCount = await page
          .getByTestId("cart-count")
          .first()
          .waitFor({ timeout: 20000 })
          .then(async () => (await page.getByTestId("cart-count").first().textContent())?.trim())
          .catch(() => null);
        row.cartButtonLabel = await page
          .getByTestId("cart-button")
          .first()
          .getAttribute("aria-label")
          .catch(() => null);
        await page.waitForTimeout(2000);
        row.afterTap = await page.evaluate(() => ({
          ws: window.__wsLog.filter((w) => /convex/.test(w.url)).map((w) => w.at),
          firstInput: window.__firstInput,
        }));
      }
      row.errors = [...log.console, ...log.pageErrors];
      await ctx.close();
      return row;
    };
    out.anonymous = await probe("anon");
    out.anonymousFirstVisit = await probe("anonfv", null, { consent: false });
    out.anonymousHome = await probe("anonhome", null, { path: "/" });
    out.mechanic = await probe("mech", (page) =>
      loginWith(page, accounts.mechanic.email, accounts.mechanic.password, "/majstor"),
    );
    result.socket = out;
    save();
  }
} finally {
  await browser.close();
}
save();
console.log(JSON.stringify(result, null, 1).slice(0, 20000));
