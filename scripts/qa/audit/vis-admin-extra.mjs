/**
 * vis-admin track (run 3): targeted captures and measurements the first sweep missed —
 * loaded dashboard, orders/inquiries crops, sidebar overflow, command palette, settings h1,
 * 2560 px captures. Evidence: docs/qa/audit/vis-admin/extra/*.webp + extra.json
 *   node scripts/qa/audit/vis-admin-extra.mjs [part...]   (parts: a b c d e f g h i; default all)
 */
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { BASE, launch, newContext, watch, shot } from "./kit.mjs";

/** Login tolerant of a slow shared server (kit.loginWith waits for networkidle, which times out under load). */
async function loginAdmin(page) {
  await page.goto(BASE + "/prijava?next=%2Fadmin", { waitUntil: "domcontentloaded", timeout: 120_000 });
  await page.getByTestId("auth-email").waitFor({ timeout: 90_000 });
  await page.waitForTimeout(1500);
  await page.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL);
  await page.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith("/admin"), { timeout: 120_000 });
}

const parts = process.argv.slice(2);
const want = (p) => !parts.length || parts.includes(p);
const OUT = "docs/qa/audit/vis-admin/extra.json";
mkdirSync("docs/qa/audit/vis-admin/extra", { recursive: true });
const out = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const save = () => writeFileSync(OUT, JSON.stringify(out, null, 2));

async function go(page, route) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 90_000 });
      break;
    } catch (e) {
      console.log("retry", route, String(e).slice(0, 80));
    }
  }
  await page.waitForLoadState("load").catch(() => {});
  await page
    .waitForFunction(() => !document.querySelector('[aria-busy="true"]'), null, { timeout: 30_000 })
    .catch(() => {});
  await page.waitForTimeout(1200);
  if (/\/prijava/.test(page.url())) {
    console.log("session lost, re-login");
    await loginAdmin(page);
    return go(page, route);
  }
}

const b = await launch();
const ctx = await newContext(b, { width: 1440, height: 900, tag: "vis-admin3" });
const page = await ctx.newPage();
const log = watch(page);
for (let i = 0; i < 4; i++) {
  try {
    await loginAdmin(page);
    break;
  } catch {
    console.log("login retry", i);
  }
}

try {
  if (want("a")) {
    await go(page, "/admin");
    await page.waitForTimeout(3000);
    out.a = {
      busy: await page.locator('[aria-busy="true"]').count(),
      f: await shot(page, "vis-admin/extra/pregled-1440-loaded"),
      full: await shot(page, "vis-admin/extra/pregled-1440-full", { fullPage: true }),
      kpis: await page.evaluate(() =>
        [...document.querySelectorAll("main a, main div")]
          .filter((e) => /numeral/.test(e.className))
          .slice(0, 8)
          .map((e) => `${e.textContent.trim().slice(0, 20)} ${getComputedStyle(e).fontSize}`),
      ),
      svgText: await page.evaluate(() =>
        [...new Set([...document.querySelectorAll("main svg text")].map((t) => `${getComputedStyle(t).fontSize}/${getComputedStyle(t).fill}`))].slice(0, 8),
      ),
    };
    save();
    console.log("a", out.a);
  }
  if (want("b")) {
    await go(page, "/admin/porudzbine?status=sve");
    out.b = {
      crop: await shot(page, "vis-admin/extra/orders-rows-1440", { clip: { x: 232, y: 180, width: 1208, height: 330 } }),
      right: await shot(page, "vis-admin/extra/orders-right-1440", { clip: { x: 1040, y: 180, width: 400, height: 720 } }),
      number: await page.evaluate(() => {
        const cell = document.querySelector("main tbody tr td:nth-child(2)");
        if (!cell) return null;
        return [...cell.querySelectorAll("*")]
          .filter((e) => e.children.length === 0 && e.textContent.trim())
          .map((e) => `${e.textContent.trim()} color=${getComputedStyle(e).color} w=${getComputedStyle(e).fontWeight} fs=${getComputedStyle(e).fontSize} ff=${getComputedStyle(e).fontFamily.slice(0, 30)}`);
      }),
      wrap: await page.evaluate(() => {
        const w = document.querySelector("main .overflow-x-auto");
        return w ? { sw: w.scrollWidth, cw: w.clientWidth, cls: String(w.className).slice(0, 200), shadow: getComputedStyle(w).boxShadow, bg: getComputedStyle(w).backgroundImage.slice(0, 120) } : null;
      }),
      clippedTracking: await page.evaluate(() =>
        [...document.querySelectorAll("main td *")]
          .filter((e) => e.scrollWidth > e.clientWidth + 1 && e.textContent.includes("·"))
          .slice(0, 5)
          .map((e) => `${e.textContent.trim()} sw=${e.scrollWidth} cw=${e.clientWidth} to=${getComputedStyle(e).textOverflow} title=${e.getAttribute("title")}`),
      ),
    };
    save();
    console.log("b", out.b);
  }
  if (want("c")) {
    await go(page, "/admin/upiti");
    out.c = {
      right: await shot(page, "vis-admin/extra/upiti-right-1440", { clip: { x: 900, y: 150, width: 540, height: 420 } }),
      wrap: await page.evaluate(() => {
        const w = document.querySelector("main .overflow-x-auto");
        const ths = [...document.querySelectorAll("main thead th")].map((t) => `${t.innerText.trim()}:${Math.round(t.getBoundingClientRect().left)}-${Math.round(t.getBoundingClientRect().right)}`);
        return w ? { sw: w.scrollWidth, cw: w.clientWidth, right: Math.round(w.getBoundingClientRect().right), ths } : { ths };
      }),
    };
    save();
    console.log("c", out.c);
  }
  if (want("d")) {
    out.d = await page.evaluate(() => {
      const aside = document.querySelector("aside");
      const sc = [...(aside?.querySelectorAll("*") ?? [])].find((e) => e.scrollHeight > e.clientHeight + 4 && /auto|scroll/.test(getComputedStyle(e).overflowY));
      if (!sc) return { none: true };
      const cs = getComputedStyle(sc);
      const links = [...sc.querySelectorAll("a")].map((a) => ({ t: a.innerText.trim(), bottom: Math.round(a.getBoundingClientRect().bottom) }));
      return {
        sh: sc.scrollHeight,
        ch: sc.clientHeight,
        scrollbarWidth: cs.scrollbarWidth,
        scrollbarColor: cs.scrollbarColor,
        mask: cs.maskImage || cs.webkitMaskImage,
        vh: innerHeight,
        hidden: links.filter((l) => l.bottom > innerHeight).map((l) => l.t),
      };
    });
    out.d.f = await shot(page, "vis-admin/extra/sidebar-bottom-1440x900", { clip: { x: 0, y: 560, width: 460, height: 340 } });
    save();
    console.log("d", out.d);
  }
  if (want("e")) {
    await go(page, "/admin/porudzbine");
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(800);
    const dlg = page.getByRole("dialog");
    out.e = { open: await dlg.count() };
    out.e.empty = await shot(page, "vis-admin/extra/palette-open-1440");
    await page.keyboard.type("5Q0615", { delay: 60 });
    await page.waitForTimeout(3500);
    out.e.results = await shot(page, "vis-admin/extra/palette-5Q0-1440");
    await page.keyboard.press("Escape");
    await page.waitForTimeout(400);
    await page.keyboard.press("Control+k");
    await page.waitForTimeout(600);
    await page.keyboard.type("zzqqxx", { delay: 40 });
    await page.waitForTimeout(3000);
    out.e.none = await shot(page, "vis-admin/extra/palette-none-1440");
    await page.keyboard.press("Escape");
    save();
    console.log("e", out.e);
  }
  if (want("f")) {
    out.f = {};
    for (const t of ["firma", "prodaja", "seo", "funkcije"]) {
      await go(page, `/admin/podesavanja?tab=${t}`);
      out.f[t] = await page.evaluate(() => ({
        h1s: [...document.querySelectorAll("h1")].map((h) => `${h.innerText.trim()}|inMain=${!!h.closest("main")}|vis=${h.getBoundingClientRect().height > 0}`),
        title: document.title,
      }));
      if (t === "firma" || t === "prodaja") out.f[t].f = await shot(page, `vis-admin/extra/settings-${t}-1440`);
    }
    save();
    console.log("f", JSON.stringify(out.f));
  }
  if (want("g")) {
    await go(page, "/admin/kupci");
    out.g = { f: await shot(page, "vis-admin/extra/kupci-1440", { clip: { x: 232, y: 150, width: 1208, height: 420 } }) };
    await go(page, "/admin/mejlovi/sabloni");
    out.g.sab = await shot(page, "vis-admin/extra/sabloni-1440");
    out.g.sabH2 = await page.evaluate(() => [...document.querySelectorAll("main h2")].slice(0, 5).map((h) => `${h.innerText.trim()} ${getComputedStyle(h).fontSize} ${getComputedStyle(h).textTransform}`));
    save();
    console.log("g", out.g);
  }
  if (want("i")) {
    await page.setViewportSize({ width: 2560, height: 1440 });
    out.i = {};
    for (const r of ["/admin", "/admin/porudzbine", "/admin/upiti/UP-2026-000003", "/admin/podesavanja?tab=firma", "/admin/proizvodi"]) {
      await go(page, r);
      if (r === "/admin") await page.waitForTimeout(3000);
      const slug = r.replace(/^\/admin\/?/, "").replace(/[?=&/]/g, "_") || "pregled";
      out.i[r] = {
        f: await shot(page, `vis-admin/extra/2560-${slug}`),
        m: await page.evaluate(() => {
          const main = document.querySelector("main");
          const kids = main ? [...main.querySelectorAll(":scope > *")].map((k) => Math.round(k.getBoundingClientRect().width)) : [];
          const table = document.querySelector("main table");
          return { main: main && Math.round(main.getBoundingClientRect().width), kids: kids.slice(0, 5), table: table && Math.round(table.getBoundingClientRect().width) };
        }),
      };
      save();
      console.log("i", r, out.i[r].m);
    }
  }
  if (want("j")) {
    out.j = {};
    for (const [w, h] of [[390, 844], [768, 1024], [1024, 768]]) {
      await page.setViewportSize({ width: w, height: h });
      for (const r of ["/admin", "/admin/porudzbine", "/admin/porudzbine/SK-2026-000092", "/admin/upiti/UP-2026-000003"]) {
        await go(page, r);
        if (r === "/admin") await page.waitForTimeout(2500);
        const m = await page.evaluate(() => {
          const de = document.documentElement;
          const wide = [...document.querySelectorAll("main section, main > div > div, main article")]
            .map((e) => ({ e, r: e.getBoundingClientRect() }))
            .filter(({ r }) => r.right > innerWidth + 1)
            .slice(0, 4)
            .map(({ e, r }) => `${e.tagName.toLowerCase()} ${e.querySelector("h2,h3")?.innerText.trim() ?? ""} right=${Math.round(r.right)}`);
          const scrollers = [...document.querySelectorAll("main *")]
            .filter((e) => /auto|scroll/.test(getComputedStyle(e).overflowX) && e.scrollWidth > e.clientWidth + 1)
            .map((e) => `${e.closest("section")?.querySelector("h2")?.innerText.trim() ?? e.tagName} ${e.scrollWidth}/${e.clientWidth}`);
          const vis = [...document.querySelectorAll("main thead th")]
            .filter((t) => { const r = t.getBoundingClientRect(); return r.width > 0 && r.left < innerWidth && r.right <= innerWidth + 1; })
            .map((t) => t.innerText.trim());
          return { sw: de.scrollWidth, vw: innerWidth, wide, scrollers, visibleHeaders: vis };
        });
        out.j[`${w} ${r}`] = m;
        if (w === 390 && r === "/admin") {
          await page.evaluate(() => window.scrollTo(0, 700));
          await page.waitForTimeout(500);
          m.f = await shot(page, "vis-admin/extra/390-pregled-queue");
        }
        if (w === 1024 && r.includes("SK-")) m.f = await shot(page, "vis-admin/extra/1024-order-items", { clip: { x: 64, y: 200, width: 620, height: 330 } });
        if (w === 1024 && r === "/admin") m.f = await shot(page, "vis-admin/extra/1024-rail", { clip: { x: 0, y: 56, width: 300, height: 712 } });
        console.log("j", w, r, JSON.stringify(m).slice(0, 400));
        save();
      }
    }
  }
} catch (e) {
  console.log("ERR", String(e).slice(0, 300));
}
out.log = { console: log.console.slice(-10), pageErrors: log.pageErrors, bad: log.badResponses };
save();
await b.close();
console.log("DONE");
