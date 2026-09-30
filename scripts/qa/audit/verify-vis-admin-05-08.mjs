/**
 * Independent verification of vis-admin-05..08 (step 21 audit).
 *   node scripts/qa/audit/verify-vis-admin-05-08.mjs [05|06|07|08 ...]
 * Evidence: docs/qa/audit/verify/vis-admin/*-reproduce.{webp,json}
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, loginAdmin, shot } from "./kit.mjs";

const DIR = "docs/qa/audit/verify/vis-admin";
mkdirSync(DIR, { recursive: true });
const only = process.argv.slice(2);
const want = (k) => only.length === 0 || only.includes(k);

async function load(page, r) {
  await page.goto(BASE + r, { waitUntil: "domcontentloaded", timeout: 60_000 }).catch(() => {});
  await page
    .waitForFunction(() => !!document.querySelector("main h1") && !document.querySelector("main .skeleton"), null, {
      timeout: 30_000,
    })
    .catch(() => {});
  await page.waitForTimeout(800);
}

const b = await launch();

/* ---------------- 05: bulk bar layout shift ---------------- */
if (want("05")) {
  const out = {};
  for (const vp of [
    { width: 1440, height: 900 },
    { width: 1280, height: 800 },
    { width: 1024, height: 768 },
  ]) {
    const ctx = await newContext(b, { ...vp, tag: `verify-va05-${vp.width}` });
    const page = await ctx.newPage();
    await loginAdmin(page);
    for (const r of ["/admin/porudzbine", "/admin/proizvodi"]) {
      const key = `${vp.width} ${r}`;
      const res = {};
      for (const mode of ["same-spot", "next-row"]) {
        await load(page, r);
        await page.waitForSelector("main tbody tr [role=checkbox]", { timeout: 20_000 });
        const rowsTop = () =>
          page.evaluate(() =>
            [...document.querySelectorAll("main tbody tr")].slice(0, 3).map((tr) => Math.round(tr.getBoundingClientRect().top)),
          );
        const cb = page.locator("main tbody tr").first().locator("[role=checkbox]");
        const bb = await cb.boundingBox();
        const x = bb.x + bb.width / 2;
        const y = bb.y + bb.height / 2;
        const before = await rowsTop();
        const toolbarH = await page.evaluate(() => {
          const t = document.querySelector("main table");
          return t ? Math.round(t.getBoundingClientRect().top) : null;
        });
        const urlBefore = page.url();
        await page.mouse.move(x, y);
        await page.mouse.click(x, y);
        await page.waitForTimeout(600);
        const after = await rowsTop();
        const bb2 = await cb.boundingBox();
        const checkedAfter1 = await cb.getAttribute("data-state");
        const bulkBar = await page.evaluate(() => {
          const e = document.querySelector('[role=region][aria-label="Grupne radnje"]');
          return e ? Math.round(e.getBoundingClientRect().height) : null;
        });
        const tableTopAfter = await page.evaluate(() => {
          const t = document.querySelector("main table");
          return t ? Math.round(t.getBoundingClientRect().top) : null;
        });
        const x2 = x;
        const y2 = mode === "same-spot" ? y : y + (before[1] - before[0]);
        const under = await page.evaluate(
          ([px, py]) => {
            const e = document.elementFromPoint(px, py);
            if (!e) return null;
            const td = e.closest("td");
            const tr = e.closest("tr");
            const rowIdx = tr ? [...tr.parentElement.children].indexOf(tr) : -1;
            return `${e.tagName.toLowerCase()} role=${e.getAttribute("role") ?? ""} tdIndex=${td ? [...td.parentElement.children].indexOf(td) : -1} rowIndex=${rowIdx}`;
          },
          [x2, y2],
        );
        if (mode === "same-spot") {
          await shot(page, `verify/vis-admin/vis-admin-05-reproduce-${vp.width}-${r.replace(/\W+/g, "_")}-after-first-click`, {
            clip: { x: 0, y: Math.max(0, bb.y - 180), width: Math.min(vp.width, 1000), height: 300 },
          });
        }
        await page.mouse.click(x2, y2);
        await page.waitForTimeout(2500);
        const urlAfter = page.url();
        let secondState = null;
        if (urlAfter === urlBefore) {
          secondState = await page
            .locator("main tbody tr")
            .nth(mode === "same-spot" ? 0 : 1)
            .locator("[role=checkbox]")
            .getAttribute("data-state")
            .catch(() => null);
        }
        res[mode] = {
          rowTopsBefore: before,
          rowTopsAfter: after,
          tableTopBefore: toolbarH,
          tableTopAfter,
          bulkBarH: bulkBar,
          checkbox: { yBefore: Math.round(bb.y), yAfter: bb2 ? Math.round(bb2.y) : null, h: Math.round(bb.height) },
          firstClickState: checkedAfter1,
          secondClickAt: [Math.round(x2), Math.round(y2)],
          underSecondClick: under,
          navigated: urlAfter !== urlBefore,
          urlAfter: urlAfter.replace(BASE, ""),
          secondRowStateIfStayed: secondState,
        };
        if (urlAfter !== urlBefore && mode === "same-spot") {
          await page.waitForTimeout(800);
          await shot(page, `verify/vis-admin/vis-admin-05-reproduce-${vp.width}-${r.replace(/\W+/g, "_")}-after-second-click`, {
            clip: { x: 0, y: 0, width: Math.min(vp.width, 1000), height: 260 },
          });
        }
      }
      // off-checkbox click inside the selection cell (no bulk bar involved): does it open the row?
      await load(page, r);
      await page.waitForSelector("main tbody tr [role=checkbox]", { timeout: 20_000 });
      const td = page.locator("main tbody tr").first().locator("td").first();
      const tdBox = await td.boundingBox();
      const cbBox = await td.locator("[role=checkbox]").boundingBox();
      const u0 = page.url();
      await page.mouse.click(cbBox.x + cbBox.width / 2, tdBox.y + 4);
      await page.waitForTimeout(2500);
      res.selectCellEdgeClick = {
        tdBox: { y: Math.round(tdBox.y), h: Math.round(tdBox.height), w: Math.round(tdBox.width) },
        cbBox: { y: Math.round(cbBox.y), h: Math.round(cbBox.height) },
        navigated: page.url() !== u0,
        urlAfter: page.url().replace(BASE, ""),
      };
      out[key] = res;
      console.log(key, JSON.stringify(res));
      writeFileSync(`${DIR}/vis-admin-05-reproduce.json`, JSON.stringify(out, null, 2));
    }
    await ctx.close();
  }
}

/* ---------------- 06: order detail line items ---------------- */
if (want("06")) {
  const out = {};
  for (const vp of [
    { width: 1024, height: 768 },
    { width: 1152, height: 800 },
    { width: 1280, height: 800 },
    { width: 1440, height: 900 },
    { width: 768, height: 1024 },
    { width: 390, height: 844 },
  ]) {
    const ctx = await newContext(b, { ...vp, tag: `verify-va06-${vp.width}` });
    const page = await ctx.newPage();
    await loginAdmin(page);
    await load(page, "/admin/porudzbine/SK-2026-000092");
    await page.waitForSelector("main table caption", { timeout: 20_000 }).catch(() => {});
    const m = await page.evaluate(() => {
      const cap = [...document.querySelectorAll("main table caption")].find((c) => c.textContent.includes("Stavke"));
      if (!cap) return null;
      const table = cap.closest("table");
      const wrap = table.parentElement;
      const wr = wrap.getBoundingClientRect();
      const ths = [...table.querySelectorAll("thead th")].map((th) => {
        const r = th.getBoundingClientRect();
        return `${th.textContent.trim()}:${Math.round(r.left)}-${Math.round(r.right)}${r.right > wr.right + 1 ? "(CLIPPED)" : ""}`;
      });
      const style = getComputedStyle(wrap);
      return {
        wrapperLeft: Math.round(wr.left),
        wrapperRight: Math.round(wr.right),
        wrapperW: Math.round(wr.width),
        tableScrollW: wrap.scrollWidth,
        overflowX: style.overflowX,
        ths,
        sectionTop: Math.round(table.closest("section, [class*=rounded]")?.getBoundingClientRect().top ?? wr.top),
        docOverflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      };
    });
    out[vp.width] = m;
    console.log(vp.width, JSON.stringify(m));
    if (m) {
      const cap = page.locator("main table caption", { hasText: "Stavke" });
      const table = cap.locator("xpath=ancestor::table[1]");
      await table.scrollIntoViewIfNeeded();
      await page.evaluate(() => window.scrollBy(0, -120));
      await page.waitForTimeout(400);
      out[vp.width].f = await shot(page, `verify/vis-admin/vis-admin-06-reproduce-${vp.width}`, {});
    }
    writeFileSync(`${DIR}/vis-admin-06-reproduce.json`, JSON.stringify(out, null, 2));
    await ctx.close();
  }
}

/* ---------------- 07: rail badges ---------------- */
if (want("07")) {
  const out = {};
  for (const vp of [
    { width: 1024, height: 768 },
    { width: 1280, height: 800 },
    { width: 1366, height: 768 },
  ]) {
    const ctx = await newContext(b, { ...vp, tag: `verify-va07-${vp.width}`, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await loginAdmin(page);
    await load(page, "/admin/porudzbine");
    await page.waitForTimeout(1500);
    const items = await page.evaluate(() => {
      const nav = document.querySelector("aside nav, nav[aria-label]");
      const links = [...document.querySelectorAll("aside a[href^='/admin']")];
      return links
        .map((a) => {
          const svg = a.querySelector("svg");
          const spans = [...a.querySelectorAll("span")].filter((s) => {
            const t = s.childNodes[0]?.nodeType === 3 ? s.childNodes[0].textContent.trim() : "";
            return /^\d+\+?$/.test(t) && getComputedStyle(s).position === "absolute";
          });
          if (!svg || !spans.length) return null;
          const i = svg.getBoundingClientRect();
          const bRect = spans[0].getBoundingClientRect();
          const ox = Math.max(0, Math.min(i.right, bRect.right) - Math.max(i.left, bRect.left));
          const oy = Math.max(0, Math.min(i.bottom, bRect.bottom) - Math.max(i.top, bRect.top));
          return {
            href: a.getAttribute("href"),
            badge: spans[0].childNodes[0].textContent.trim(),
            icon: [Math.round(i.left), Math.round(i.top), Math.round(i.width), Math.round(i.height)],
            badgeRect: [Math.round(bRect.left), Math.round(bRect.top), Math.round(bRect.width), Math.round(bRect.height)],
            overlapPx: `${Math.round(ox)}x${Math.round(oy)}`,
            iconAreaCoveredPct: Math.round(((ox * oy) / (i.width * i.height)) * 100),
          };
        })
        .filter(Boolean);
    });
    out[vp.width] = { items };
    console.log(vp.width, JSON.stringify(items));
    if (vp.width < 1366) {
      out[vp.width].f = await shot(page, `verify/vis-admin/vis-admin-07-reproduce-${vp.width}-rail`, {
        clip: { x: 0, y: 0, width: 64, height: Math.min(vp.height, 760) },
      });
    }
    writeFileSync(`${DIR}/vis-admin-07-reproduce.json`, JSON.stringify(out, null, 2));
    await ctx.close();
  }
}

/* ---------------- 08: SEO description counters ---------------- */
if (want("08")) {
  const out = {};
  const ctx = await newContext(b, { width: 1440, height: 900, tag: "verify-va08" });
  const page = await ctx.newPage();
  await loginAdmin(page);
  const grab = async (labelText) =>
    page.evaluate((lt) => {
      const labels = [...document.querySelectorAll("label")].filter((l) => l.textContent.trim().startsWith(lt));
      return labels.map((l) => {
        const field = l.closest("div");
        let host = field;
        for (let k = 0; k < 3 && host && !host.querySelector("textarea"); k++) host = host.parentElement;
        const text = (host ?? field).innerText.replace(/\s+/g, " ").trim();
        const counts = [...(host ?? field).innerText.matchAll(/(\d+)\s*\/\s*(\d+)/g)].map((m) => m[0].replace(/\s+/g, " "));
        return { text: text.slice(0, 260), counts };
      });
    }, labelText);
  const clipAround = async (labelText, name) => {
    const lab = page.locator("label", { hasText: labelText }).first();
    await lab.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const bb = await lab.boundingBox();
    if (!bb) return null;
    return shot(page, `verify/vis-admin/vis-admin-${name}`, {
      clip: { x: Math.max(0, bb.x - 16), y: Math.max(0, bb.y - 12), width: 720, height: 230 },
    });
  };

  await load(page, "/admin/kategorije");
  await page.getByText("Blok motora i glava", { exact: true }).first().click();
  await page.waitForTimeout(1200);
  out.kategorije = await grab("Opis za pretraživače");
  out.kategorije.f = await clipAround("Opis za pretraživače", "08-reproduce-kategorije");

  await load(page, "/admin/proizvodi/novi");
  const ta = page.locator("label", { hasText: "Opis za pretraživače" }).first();
  await ta.scrollIntoViewIfNeeded().catch(() => {});
  // type a sample to show the counters diverge
  const tId = await ta.getAttribute("for");
  if (tId) await page.locator(`[id="${tId}"]`).fill("Prednji kočioni disk 276 mm za VW Golf 7, Audi A3 8V i Škoda Octavia 3. Na stanju, isporuka sutra.".padEnd(160, " x"));
  await page.waitForTimeout(400);
  out.proizvodNovi = await grab("Opis za pretraživače");
  out.proizvodNovi.f = await clipAround("Opis za pretraživače", "08-reproduce-proizvod-novi");

  await load(page, "/admin/podesavanja?tab=seo");
  await page.waitForTimeout(1200);
  out.settings = await grab("Podrazumevani opis");
  out.settings.f = await clipAround("Podrazumevani opis", "08-reproduce-podesavanja-seo");
  console.log(JSON.stringify(out, null, 1));
  writeFileSync(`${DIR}/vis-admin-08-reproduce.json`, JSON.stringify(out, null, 2));
  await ctx.close();
}

await b.close();
