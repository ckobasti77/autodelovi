// flows-admin: log in as owner, persist the session to the OS temp dir, crawl every admin screen at
// the given widths: console errors, bad responses, axe (1440 only), horizontal overflow, viewport shot.
// Usage: node scripts/qa/audit/flows-admin-crawl.mjs [widths=1440,1024,390]
import { writeFileSync, existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { BASE, launch, newContext, watch, shot, axe, loginAdmin, overflowX } from "./kit.mjs";

export const STATE = path.join(os.tmpdir(), "sklop-flows-admin-state.json");

const ROUTES = [
  "/admin",
  "/admin/porudzbine",
  "/admin/porudzbine?status=sve",
  "/admin/upiti",
  "/admin/proizvodi",
  "/admin/proizvodi/novi",
  "/admin/kategorije",
  "/admin/vozila",
  "/admin/proizvodjaci",
  "/admin/lager",
  "/admin/kupci",
  "/admin/majstori",
  "/admin/cenovni-razredi",
  "/admin/uvoz",
  "/admin/uvoz/istorija",
  "/admin/izvoz",
  "/admin/izvori",
  "/admin/pretrage",
  "/admin/mejlovi",
  "/admin/mejlovi/sabloni",
  "/admin/obavestenja",
  "/admin/podesavanja",
  "/admin/korisnici",
  "/admin/revizija",
  "/admin/privatnost",
];

const widths = (process.argv[2] ?? "1440,1024,390").split(",").map(Number);
const only = process.argv[3] ? process.argv[3].split(",") : null;
const OUTFILE = process.argv[4] ?? "docs/qa/audit/flows-admin/crawl.json";
const browser = await launch();
const out = {};
try {
  let state = existsSync(STATE) ? STATE : undefined;
  if (!state) {
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fa-login" });
    const p = await ctx.newPage();
    await loginAdmin(p);
    await ctx.storageState({ path: STATE });
    await ctx.close();
    state = STATE;
  }
  for (const w of widths) {
    const h = w < 768 ? 844 : w < 1280 ? 768 : 900;
    const ctx = await browser.newContext({
      storageState: STATE,
      viewport: { width: w, height: h },
      isMobile: w < 768,
      hasTouch: w < 768,
      locale: "sr-Latn-RS",
      timezoneId: "Europe/Belgrade",
    });
    const page = await ctx.newPage();
    page.setDefaultTimeout(90_000);
    for (const r of only ?? ROUTES) {
      const log = watch(page);
      try {
      const t0 = Date.now();
      await page.goto(BASE + r, { waitUntil: "domcontentloaded" });
      await page.waitForLoadState("networkidle").catch(() => {});
      await page.waitForTimeout(1200);
      const ms = Date.now() - t0;
      const title = await page.title();
      const h1 = await page.locator("h1").first().textContent().catch(() => null);
      const ov = await overflowX(page);
      const name = `${w}-${r.replace(/^\/admin\/?/, "").replace(/[/?=&]/g, "_") || "pregled"}`;
      const file = await shot(page, `flows-admin/crawl/${name}`);
      const entry = { url: page.url(), ms, title, h1, overflow: ov, shot: file, ...log };
      if (w === 1440) entry.axe = await axe(page).catch((e) => String(e));
      out[`${w} ${r}`] = entry;
      page.removeAllListeners();
      console.log(w, r, ms + "ms", "h1=", h1, "over=", ov.over, "err=", log.console.length + log.pageErrors.length, entry.axe ? `axe=${entry.axe.length}` : "");
      } catch (e) { console.log(w, r, "FAILED", String(e).slice(0, 200)); page.removeAllListeners(); }
    }
    await ctx.close();
  }
} finally {
  writeFileSync(OUTFILE, JSON.stringify(out, null, 2));
  await browser.close();
}
