// motion-3d: text-reveal contract sweep (stuck / pending / words) after load + scrollThrough,
// at 1440 and 390, anonymous + customer + mechanic + admin. Also records console errors.
// Usage: node scripts/qa/audit/motion-3d-reveal.mjs [anon|customer|mechanic|admin|all]
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, scrollThrough, revealCheck, loginWith, loginAdmin, shot } from "./kit.mjs";

const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const ORDER = "GVl2SHwvba1nbEDG8VWTGcg0IPXAbHGNXGpzjHnowJw";
const INQ = "3UMmrdzw1RNGw5ToQh06cANjxl8c_-Ajvp7eBwA1ayI";
const ROUTES = {
  anon: [
    "/", "/delovi", "/delovi/kocnice", "/delovi/kocioni-diskovi", "/delovi/kocioni-diskovi/volkswagen",
    "/delovi/kocioni-diskovi/volkswagen/golf", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004",
    "/deo/kocione-plocice-prednje-demo-0012", "/vozila", "/vozila/volkswagen", "/vozila/volkswagen/golf",
    "/vozila/volkswagen/golf/golf-7", "/pretraga?q=5Q0615505R", "/pretraga?q=disk", "/pretraga?q=zzzqqq",
    "/ponuda/kocione-plocice-golf", "/korpa", "/porudzbina", "/upit", "/za-majstore", "/za-majstore/registracija",
    "/za-majstore/hvala", "/kontakt", "/o-nama", "/dostava-i-placanje", "/reklamacije-i-povrat", "/uslovi-koriscenja",
    "/politika-privatnosti", "/kolacici", "/prijava", "/registracija", "/zaboravljena-lozinka", "/nova-lozinka",
    "/ovo-ne-postoji", "/styleguide", `/porudzbina/${ORDER}`, `/porudzbina/${ORDER}/predracun`,
    `/porudzbina/hvala/${ORDER}`, `/upit/${INQ}`, `/upit/hvala/${INQ}`, "/obavestenja/odjava/invalid-token",
  ],
  customer: ["/nalog", "/nalog/porudzbine", "/nalog/upiti", "/nalog/vozila", "/nalog/omiljeno", "/nalog/profil"],
  mechanic: [
    "/majstor", "/majstor/brza-porudzbina", "/majstor/porudzbine", "/majstor/omiljeno", "/majstor/vozila",
    "/majstor/cenovnik", "/majstor/upiti", "/majstor/profil", "/deo/kocioni-disk-prednji-276-24-mm-demo-0004",
  ],
  admin: [
    "/admin", "/admin/porudzbine", "/admin/porudzbine/SK-2026-000092", "/admin/upiti", "/admin/upiti/UP-2026-000054",
    "/admin/proizvodi", "/admin/majstori", "/admin/kupci", "/admin/uvoz", "/admin/podesavanja?tab=firma",
    "/admin/sadrzaj", "/admin/obavestenja", "/admin/revizija", "/admin/lager",
  ],
};
const which = process.argv[2] ?? "all";
if (process.env.ROUTES_OVERRIDE) ROUTES[which] = process.env.ROUTES_OVERRIDE.split(",");
async function login(page, email, password, next) {
  await page.goto(`${BASE}/prijava?next=${encodeURIComponent(next)}`, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(2500);
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith(next), { timeout: 90_000 });
}
const roles = which === "all" ? Object.keys(ROUTES) : [which];
const widths = [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "390", width: 390, height: 844 },
];
mkdirSync("docs/qa/audit/motion-3d", { recursive: true });
const browser = await launch();
const out = [];
for (const role of roles) {
  for (const w of widths) {
    const ctx = await newContext(browser, { width: w.width, height: w.height, tag: `m3d-rev-${role}-${w.tag}` });
    const page = await ctx.newPage();
    const log = watch(page);
    if (role === "customer") await login(page, acc.customer.email, acc.customer.password, "/nalog");
    if (role === "mechanic") await login(page, acc.mechanic.email, acc.mechanic.password, "/majstor");
    if (role === "admin") await loginAdmin(page);
    const from = w.tag === "1440" ? Number(process.env.FROM1440 ?? 0) : Number(process.env.FROM390 ?? 0);
    const onlyW = process.env.ONLYW;
    if (onlyW && onlyW !== w.tag) { await ctx.close(); continue; }
    for (const route of ROUTES[role].slice(from)) {
      const before = { c: log.console.length, p: log.pageErrors.length };
      let status = 0;
      try {
        const res = await page.goto(`${BASE}${route}`, { waitUntil: "load", timeout: 90_000 });
        status = res?.status() ?? 0;
      } catch (e) {
        status = -1;
      }
      await page.waitForTimeout(1500);
      try { await scrollThrough(page); } catch (e) { await page.waitForTimeout(2000); try { await scrollThrough(page); } catch {} }
      await page.waitForTimeout(400);
      const r = await revealCheck(page);
      // Extra: hidden-but-reveal-eligible copy that never got a state (never observed).
      const extra = await page.evaluate(() => {
        const vis = [...document.querySelectorAll("[data-reveal-state]")].reduce((m, e) => {
          const s = e.getAttribute("data-reveal-state");
          m[s] = (m[s] ?? 0) + 1;
          return m;
        }, {});
        return { states: vis, url: location.pathname + location.search };
      });
      const row = {
        role, w: w.tag, route, status, finalUrl: extra.url, ...r, states: extra.states,
        newConsole: log.console.slice(before.c), newPageErrors: log.pageErrors.slice(before.p),
      };
      out.push(row);
      const bad = r.stuck.length || r.pending || r.words;
      console.log(`${bad ? "FAIL" : "ok  "} ${role} ${w.tag} ${route} → ${extra.url} [${status}] stuck=${r.stuck.length} pending=${r.pending} words=${r.words} states=${JSON.stringify(extra.states)} console=${row.newConsole.length} pageErr=${row.newPageErrors.length}`);
      if (bad) {
        console.log("   ", r.stuck.slice(0, 6).join(" | "));
        const safe = route.replace(/[^a-z0-9]+/gi, "_").slice(0, 60);
        await shot(page, `motion-3d/reveal-fail-${role}-${w.tag}-${safe}`);
      }
    }
    await ctx.close();
  }
}
await browser.close();
writeFileSync(`docs/qa/audit/motion-3d/reveal-${which}-${process.env.ONLYW ?? "all"}-${process.env.FROM1440 ?? 0}.json`, JSON.stringify(out, null, 2));
