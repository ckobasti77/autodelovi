// a11y-app: axe (WCAG 2.2 AA tags, all impacts) + structure checks over auth, account,
// mechanic portal and admin routes. One sign-in per role (storage state reused).
// Usage: node scripts/qa/audit/a11y-app-sweep.mjs [role ...]   roles: anon customer mechanic admin
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { BASE, launch, newContext, watch, scrollThrough, revealCheck, overflowX, shot, axe, loginWith, loginAdmin } from "./kit.mjs";

const DIR = "docs/qa/audit/a11y-app";
mkdirSync(`${DIR}/state`, { recursive: true });
const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const roles = process.argv.slice(2).length ? process.argv.slice(2) : ["anon", "customer", "mechanic", "admin"];

const ROUTES = {
  anon: {
    widths: [390, 1440],
    list: ["/prijava", "/registracija", "/zaboravljena-lozinka", "/nova-lozinka", "/za-majstore/registracija", "/za-majstore/hvala"],
  },
  customer: {
    widths: [390, 1440],
    list: ["/nalog", "/nalog/porudzbine", "/nalog/upiti", "/nalog/vozila", "/nalog/omiljeno", "/nalog/profil"],
  },
  mechanic: {
    widths: [390, 1440],
    list: ["/majstor", "/majstor/brza-porudzbina", "/majstor/porudzbine", "/majstor/omiljeno", "/majstor/vozila", "/majstor/cenovnik", "/majstor/upiti", "/majstor/profil"],
  },
  admin: {
    widths: [1440],
    list: [
      "/admin", "/admin/porudzbine", "/admin/porudzbine/SK-2026-000092", "/admin/upiti", "/admin/upiti/UP-2026-000054", "/admin/upiti/UP-2026-000003",
      "/admin/kupci", "/admin/majstori", "/admin/proizvodi", "/admin/proizvodi/novi", "/admin/uvoz", "/admin/uvoz/istorija",
      "/admin/uvoz/n571yqf64h6nfr4j3894281q6n8fdmmv", "/admin/kategorije", "/admin/vozila", "/admin/proizvodjaci", "/admin/lager",
      "/admin/pretrage", "/admin/izvori", "/admin/mejlovi", "/admin/mejlovi/sabloni", "/admin/izvoz", "/admin/revizija", "/admin/privatnost",
      "/admin/cenovni-razredi", "/admin/korisnici", "/admin/podesavanja", "/admin/obavestenja",
      "/admin/porudzbine/SK-2026-000092/predracun", "/admin/porudzbine/SK-2026-000092/otpremnica",
    ],
    extra1024: ["/admin", "/admin/porudzbine", "/admin/porudzbine/SK-2026-000092", "/admin/upiti", "/admin/upiti/UP-2026-000054"],
  },
};

async function structure(page) {
  return page.evaluate(() => {
    const hs = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].filter((h) => h.offsetParent || h.getClientRects().length);
    const levels = hs.map((h) => Number(h.tagName[1]));
    const skips = [];
    for (let i = 1; i < levels.length; i++) if (levels[i] - levels[i - 1] > 1) skips.push(`${hs[i - 1].tagName}→${hs[i].tagName} "${hs[i].textContent.trim().slice(0, 40)}"`);
    const firstFocusable = document.querySelector("a[href],button,input,select,textarea,[tabindex]:not([tabindex='-1'])");
    return {
      title: document.title,
      lang: document.documentElement.lang,
      h1: hs.filter((h) => h.tagName === "H1").map((h) => h.textContent.trim().slice(0, 60)),
      headingSkips: skips.slice(0, 5),
      mains: document.querySelectorAll("main,[role=main]").length,
      navs: [...document.querySelectorAll("nav,[role=navigation]")].map((n) => n.getAttribute("aria-label") || "(no label)"),
      skipLink: firstFocusable ? `${firstFocusable.tagName} "${firstFocusable.textContent.trim().slice(0, 40)}" → ${firstFocusable.getAttribute("href") || ""}` : null,
      unlabeledButtons: [...document.querySelectorAll("button,[role=button]")].filter((b) => (b.offsetParent) && !(b.getAttribute("aria-label") || b.getAttribute("aria-labelledby") || b.textContent.trim() || b.title)).length,
      clickableNonInteractive: [...document.querySelectorAll("[onclick],tr[tabindex],div[tabindex='0'],span[tabindex='0']")].filter((e) => e.offsetParent).length,
      small: [...document.querySelectorAll("a[href],button,input:not([type=hidden]),select,[role=button],[role=tab],[role=checkbox]")]
        .filter((e) => e.offsetParent)
        .map((e) => ({ e, r: e.getBoundingClientRect() }))
        .filter(({ r }) => r.width > 0 && (r.width < 24 || r.height < 24))
        .slice(0, 8)
        .map(({ e, r }) => `${e.tagName.toLowerCase()} "${(e.getAttribute("aria-label") || e.textContent).trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`),
    };
  });
}

/** Load-tolerant sign-in (the shared server is slow; kit.loginWith waits for networkidle 30 s). */
export async function login(page, email, password, next) {
  await page.goto(`${BASE}/prijava?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByTestId("auth-email").waitFor({ timeout: 120000 });
  // Wait for React hydration: a pre-hydration submit is a native GET that puts the password in the URL.
  await page.waitForFunction(() => {
    const f = document.querySelector("[data-testid=auth-email]")?.closest("form");
    return !!f && Object.keys(f).some((k) => k.startsWith("__reactProps"));
  }, null, { timeout: 180000 });
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith(next), { timeout: 180000 });
}

const browser = await launch();
const results = [];

async function sweepRole(role) {
  const cfg = ROUTES[role];
  let storageState;
  const stateFile = `${DIR}/state/${role}.json`;
  if (role !== "anon" && process.env.REUSE && existsSync(stateFile)) {
    storageState = JSON.parse(readFileSync(stateFile, "utf8"));
  } else if (role !== "anon") {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: `a11y-app-${role}-login` });
    const page = await ctx.newPage();
    if (role === "admin") await login(page, process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, "/admin");
    else if (role === "customer") await login(page, acc.customer.email, acc.customer.password, "/nalog");
    else await login(page, acc.mechanic.email, acc.mechanic.password, "/majstor");
    storageState = await ctx.storageState();
    writeFileSync(`${DIR}/state/${role}.json`, JSON.stringify(storageState));
    await ctx.close();
  }
  const plan = [];
  for (const w of cfg.widths) for (const r of cfg.list) plan.push([w, r]);
  for (const r of cfg.extra1024 ?? []) plan.push([1024, r]);
  const only = process.env.ONLY ? process.env.ONLY.split(",") : null;
  const onlyW = process.env.ONLYW ? process.env.ONLYW.split(",").map(Number) : null;
  for (const [w, route] of plan) {
    if (only && !only.includes(route)) continue;
    if (onlyW && !onlyW.includes(w)) continue;
    const ctx = await browser.newContext({
      ...(storageState ? { storageState } : {}),
      viewport: { width: w, height: w < 1024 ? 844 : w === 1024 ? 768 : 900 },
      isMobile: w < 1024, hasTouch: w < 1024, locale: "sr-Latn-RS", timezoneId: "Europe/Belgrade",
      userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 SklopAudit-a11y-app/${Date.now()}`,
    });
    await ctx.addCookies([{ name: "sk_consent", value: encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "audit-a11y-app-0001" })), domain: "localhost", path: "/" }]);
    const page = await ctx.newPage();
    const log = watch(page);
    const rec = { role, width: w, route };
    try {
      const resp = await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
      await page.locator("h1").first().waitFor({ timeout: 90000 }).catch(() => {});
      await page.waitForLoadState("load", { timeout: 60000 }).catch(() => {});
      rec.status = resp?.status();
      rec.finalUrl = page.url().replace(BASE, "");
      await page.waitForTimeout(2500);
      if (!route.includes("predracun") && !route.includes("otpremnica")) await scrollThrough(page, { stepMs: 90 });
      rec.reveal = await revealCheck(page);
      rec.overflow = await overflowX(page);
      rec.structure = await structure(page);
      rec.axe = await axe(page);
      const slug = `${role}-${w}-${route.replace(/[/?=&]+/g, "_").replace(/^_/, "") || "root"}`.slice(0, 90);
      if (w === 1440 || w === 390 || role === "admin") rec.shot = await shot(page, `a11y-app/sweep/${slug}`);
    } catch (e) {
      rec.error = String(e).slice(0, 300);
    }
    rec.console = log.console.slice(0, 5);
    rec.pageErrors = log.pageErrors.slice(0, 5);
    rec.bad = log.badResponses.filter((b) => !b.includes("favicon")).slice(0, 5);
    results.push(rec);
    const v = (rec.axe ?? []).map((x) => `${x.id}(${x.impact},${x.nodes})`).join(" ");
    console.log(`${role} ${w} ${route} -> ${rec.status} ${rec.finalUrl ?? ""} axe:[${v}] ov:${rec.overflow?.over} stuck:${rec.reveal?.stuck?.length} ${rec.error ?? ""}`);
    await ctx.close();
  }
}

for (const role of roles) await sweepRole(role);
const file = `${DIR}/sweep-${roles.join("-")}${process.env.ONLY ? "-rerun" : ""}.json`;
writeFileSync(file, JSON.stringify(results, null, 2));
console.log("saved", file);
await browser.close();
