// Step 22 fix-up · VIS-03 header re-check with the verifier's method (shell-perf-reverify.mjs, header
// section): phone + Viber anchors injected with the exact class strings of Header.tsx.
// Usage (Git Bash): AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/shell-perf-fixup-header.mjs
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

const OUT = "docs/qa/fix/shell-perf/fixup";
mkdirSync(OUT, { recursive: true });
const want = new Set(process.argv.slice(2));
const run = (name) => want.size === 0 || want.has(name);
const accounts = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const result = {};
const save = () =>
  writeFileSync(
    `${OUT}/header.json`,
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
        await shot(page, `../fix/shell-perf/fixup/header-guest-sim-${width}`, {
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
          await shot(mpage, `../fix/shell-perf/fixup/header-mechanic-sim-${width}`, {
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
    await shot(mpage, "../fix/shell-perf/fixup/menu-mechanic-360");
    out.mechanicErrors = [...mlog.console, ...mlog.pageErrors];
    await mctx.close();
    result.header = out;
    save();
  }
} finally {
  await browser.close();
}
save();
console.log(JSON.stringify(summary(result), null, 1));

function summary(r) {
  const h = r.header;
  const row = (x) =>
    `${x.route ?? ""}${x.width}: real ${x.real.docScrollW}/${x.real.vw} menu ${x.real.menu} | sim ${x.simPhoneViber.docScrollW}/${x.simPhoneViber.vw} menu ${x.simPhoneViber.menu} inView ${x.simPhoneViber.menuFullyInView} ${x.simPhoneViber.sim.join(", ")}`;
  return {
    guest: h.guest.map(row),
    mechanic: h.mechanic.map(row),
    tab360: h.guestTabOrder360,
    menu: h.mechanicMenuLinks,
    errors: [...h.guestErrors, ...h.mechanicErrors],
  };
}
