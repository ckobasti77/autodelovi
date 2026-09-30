// a11y-app: WCAG 2.2 SC 2.4.11 Focus Not Obscured — Tab through a page and record focused elements
// that are fully or partly hidden behind sticky/fixed bars. Usage: node ... <role> <width> <route> [tabs]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { BASE, launch, newContext, shot } from "./kit.mjs";
import { login } from "./a11y-app-lib.mjs";

const [role = "mechanic", w = "390", route = "/majstor/cenovnik", tabsArg = "70"] = process.argv.slice(2);
const DIR = "docs/qa/audit/a11y-app";
const width = Number(w);
const browser = await launch();
const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, tag: `a11y-app-obsc-${role}` });
const sf = `${DIR}/state/${role}.json`;
if (existsSync(sf)) await ctx.addCookies(JSON.parse(readFileSync(sf, "utf8")).cookies);
const p = await ctx.newPage();
await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
if (new URL(p.url()).pathname.startsWith("/prijava") || (await p.evaluate(() => document.body.innerText.length)) === 0) {
  if (!new URL(p.url()).pathname.startsWith("/prijava")) await p.reload();
  await login(p, role);
  writeFileSync(sf, JSON.stringify(await ctx.storageState()));
  await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
}
await p.locator("h1").first().waitFor({ timeout: 120000 });
await p.waitForFunction(() => { const b = document.querySelector("main button, main a"); return !!b && Object.keys(b).some((k) => k.startsWith("__react")); }, null, { timeout: 120000 }).catch(() => {});
await p.waitForTimeout(2500);
await p.locator("h1").first().click();
const hits = [];
let firstShot = null;
for (let i = 0; i < Number(tabsArg); i++) {
  await p.keyboard.press("Tab");
  await p.waitForTimeout(120);
  const r = await p.evaluate(() => {
    const a = document.activeElement;
    if (!a || a === document.body) return null;
    const fr = a.getBoundingClientRect();
    const bars = [...document.querySelectorAll("body *")].filter((e) => { const cs = getComputedStyle(e); return (cs.position === "sticky" || cs.position === "fixed") && e.getClientRects().length && !e.contains(a) && !a.contains(e) && cs.visibility !== "hidden" && Number(cs.opacity) > 0.1; });
    let worst = 0, by = null;
    for (const b of bars) {
      const br = b.getBoundingClientRect();
      const ix = Math.max(0, Math.min(fr.right, br.right) - Math.max(fr.left, br.left));
      const iy = Math.max(0, Math.min(fr.bottom, br.bottom) - Math.max(fr.top, br.top));
      const cov = (ix * iy) / Math.max(1, fr.width * fr.height);
      if (cov > worst) { worst = cov; by = `${b.tagName.toLowerCase()}.${String(b.className).split(" ").slice(0, 3).join(".")} [${Math.round(br.top)}-${Math.round(br.bottom)}]`; }
    }
    const inView = fr.bottom > 0 && fr.top < innerHeight;
    return { name: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40), rect: [Math.round(fr.top), Math.round(fr.bottom)], covered: Math.round(worst * 100), by, inView };
  });
  if (r && (r.covered > 0 || !r.inView)) {
    hits.push({ i, ...r });
    if (!firstShot && r.covered >= 100) firstShot = await shot(p, `a11y-app/obscured-${role}-${width}${route.split("/").join("-")}`, { fullPage: false });
  }
}
const out = { role, width, route, tabs: Number(tabsArg), fullyHidden: hits.filter((h) => h.covered >= 100).length, partly: hits.filter((h) => h.covered > 0 && h.covered < 100).length, hits: hits.slice(0, 15), ev: firstShot };
const f = `${DIR}/obscured.json`;
const all = existsSync(f) ? JSON.parse(readFileSync(f, "utf8")) : {};
all[`${role} ${width} ${route}`] = out;
writeFileSync(f, JSON.stringify(all, null, 2));
console.log(JSON.stringify(out).slice(0, 2500));
await browser.close();
