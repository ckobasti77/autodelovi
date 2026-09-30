// Independent verification of vis-admin-09..12 (step 21 verifier). Read-only: dialogs are opened
// and closed with „Odustani“ (never confirmed); print views are only rendered.
// Usage (PowerShell, admin env set): node scripts/qa/audit/verify-vis-admin-09-12.mjs [v09 v10 v11 v12]
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { BASE, launch, newContext, shot } from "./kit.mjs";

const DIR = "docs/qa/audit/verify/vis-admin";
mkdirSync(DIR, { recursive: true });
const OUT = `${DIR}/verify-09-12.json`;
const R = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const save = () => writeFileSync(OUT, JSON.stringify(R, null, 2));
const want = process.argv.slice(2);
const run = (k) => want.length === 0 || want.includes(k);

async function login(page, next = "/admin") {
  await page.goto(`${BASE}/prijava?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByTestId("auth-email").waitFor({ timeout: 120000 });
  await page.waitForFunction(() => {
    const f = document.querySelector("[data-testid=auth-email]")?.closest("form");
    return !!f && Object.keys(f).some((k) => k.startsWith("__reactProps"));
  }, null, { timeout: 180000 });
  await page.getByTestId("auth-email").fill(process.env.SEED_ADMIN_EMAIL);
  await page.getByTestId("auth-password").fill(process.env.SEED_ADMIN_PASSWORD);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith(next), { timeout: 180000 });
}

const active = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a) return null;
    return {
      tag: a.tagName,
      label: a.getAttribute("aria-label"),
      text: (a.textContent ?? "").trim().slice(0, 60),
      inDialog: !!a.closest("[role=dialog],[role=alertdialog]"),
      focusVisible: a.matches(":focus-visible"),
    };
  });

const browser = await launch();

// ── v09: focus on open of the order transition dialogs ────────────────────────────
if (run("v09")) {
  R.v09 = {};
  for (const vp of [
    { tag: "1440", width: 1440, height: 900 },
    { tag: "390", width: 390, height: 844 },
  ]) {
    const ctx = await newContext(browser, { width: vp.width, height: vp.height, tag: `verify-va09-${vp.tag}` });
    const page = await ctx.newPage();
    const res = {};
    try {
      await login(page);
      await page.goto(`${BASE}/admin/porudzbine/SK-2026-000092`, { waitUntil: "domcontentloaded", timeout: 120000 });
      const menuBtn = page.getByRole("button", { name: "Promeni status" });
      await menuBtn.waitFor({ timeout: 60000 });
      await page.waitForTimeout(1500);
      res.statusChip = await page.evaluate(() => document.querySelector("main")?.innerText.slice(0, 300));
      // A. mouse: menu → „Otkaži porudžbinu“
      await menuBtn.click();
      await page.getByRole("menuitem", { name: /Otkaži/ }).click();
      await page.getByRole("alertdialog").waitFor({ timeout: 10000 });
      res.mouseAt50 = await active(page);
      await page.waitForTimeout(900);
      res.mouse = await active(page);
      res.mouseShot = await shot(page, `verify/vis-admin/vis-admin-09-reproduce-${vp.tag}-mouse`);
      await page.getByRole("alertdialog").getByRole("button", { name: "Odustani" }).click();
      await page.getByRole("alertdialog").waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
      await page.waitForTimeout(600);
      // B. keyboard: focus trigger, Enter, arrow to „Otkaži“, Enter
      await menuBtn.focus();
      await page.keyboard.press("Enter");
      await page.getByRole("menu").waitFor({ timeout: 5000 });
      const items = await page.getByRole("menuitem").allInnerTexts();
      res.menuItems = items;
      const idx = items.findIndex((t) => /Otkaži/.test(t));
      // Radix focuses the first item on keyboard open.
      for (let i = 0; i < idx; i++) await page.keyboard.press("ArrowDown");
      await page.keyboard.press("Enter");
      await page.getByRole("alertdialog").waitFor({ timeout: 10000 });
      await page.waitForTimeout(900);
      res.keyboard = await active(page);
      res.keyboardShot = await shot(page, `verify/vis-admin/vis-admin-09-reproduce-${vp.tag}-keyboard`);
      await page.getByRole("alertdialog").getByRole("button", { name: "Odustani" }).click();
      await page.waitForTimeout(700);
      // C. the direct primary transition button (no menu) — scope check
      const primary = page.locator("[data-testid^=admin-order-transition-]").first();
      if (await primary.count()) {
        res.primaryTestId = await primary.getAttribute("data-testid");
        await primary.click();
        await page.getByRole("alertdialog").waitFor({ timeout: 10000 });
        await page.waitForTimeout(900);
        res.primary = await active(page);
        res.primaryDialog = await page.getByRole("alertdialog").innerText();
        await page.getByRole("alertdialog").getByRole("button", { name: "Odustani" }).click();
        await page.waitForTimeout(700);
      }
    } catch (e) {
      res.error = String(e).slice(0, 400);
    }
    R.v09[vp.tag] = res;
    save();
    await ctx.close();
  }
}

// ── v09b: shared ConfirmDialog with a required reason (inquiry reject) — scope check ─
if (run("v09b")) {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-va09b" });
  const page = await ctx.newPage();
  const res = {};
  try {
    await login(page);
    await page.goto(`${BASE}/admin/upiti/UP-2026-000054`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(3000);
    res.buttons = await page.getByRole("button").allInnerTexts();
    const rej = page.getByRole("button", { name: /Odbij/ }).first();
    if (await rej.count()) {
      await rej.click();
      await page.waitForTimeout(400);
      const mi = page.getByRole("menuitem", { name: /Odbij/ });
      if (await mi.count()) await mi.first().click();
      await page.getByRole("alertdialog").waitFor({ timeout: 10000 });
      await page.waitForTimeout(900);
      res.active = await active(page);
      res.shot = await shot(page, "verify/vis-admin/vis-admin-09-reproduce-confirmdialog-reason");
      await page.getByRole("alertdialog").getByRole("button", { name: "Odustani" }).click();
    }
  } catch (e) {
    res.error = String(e).slice(0, 400);
  }
  R.v09b = res;
  save();
  await ctx.close();
}

// ── v09c: shared ConfirmDialog with required reason (customer block) — scope check; cancelled ─
if (run("v09c")) {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-va09c" });
  const page = await ctx.newPage();
  const res = {};
  try {
    await login(page);
    await page.goto(`${BASE}/admin/kupci`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(3500);
    await page.locator("tbody tr").first().click();
    await page.waitForURL((u) => /\/admin\/kupci\/.+/.test(u.pathname), { timeout: 60000 });
    res.href = page.url();
    await page.waitForTimeout(3500);
    const btn = page.getByRole("button", { name: /^Blokiraj/ }).first();
    res.hasBlock = (await btn.count()) > 0;
    if (res.hasBlock) {
      await btn.click();
      await page.getByRole("alertdialog").waitFor({ timeout: 10000 });
      await page.waitForTimeout(900);
      res.active = await active(page);
      res.shot = await shot(page, "verify/vis-admin/vis-admin-09-reproduce-confirmdialog-reason");
      await page.getByRole("alertdialog").getByRole("button", { name: "Odustani" }).click();
      await page.waitForTimeout(600);
      res.dialogClosed = (await page.getByRole("alertdialog").count()) === 0;
    }
  } catch (e) {
    res.error = String(e).slice(0, 400);
  }
  R.v09c = res;
  save();
  await ctx.close();
}

// ── v10: „Primljena“ in admin activity / audit / history ───────────────────────────
if (run("v10")) {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-va10" });
  const page = await ctx.newPage();
  const res = {};
  try {
    await login(page);
    await page.waitForTimeout(4000);
    const grab = () =>
      page.evaluate(() => {
        const t = document.body.innerText;
        return {
          primljenaArrow: (t.match(/[^\n]*Primljena\s*→[^\n]*/g) ?? []).slice(0, 8),
          novaChips: (t.match(/^NOVA$|^Nova$/gm) ?? []).length,
        };
      });
    res.dashboard = await grab();
    const act = page.getByText(/Primljena\s*→/).first();
    if (await act.count()) {
      await act.scrollIntoViewIfNeeded();
      await page.waitForTimeout(600);
    }
    res.dashboardShot = await shot(page, "verify/vis-admin/vis-admin-10-reproduce-pregled");
    await page.goto(`${BASE}/admin/revizija`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(4000);
    res.revizija = await grab();
    res.revizijaShot = await shot(page, "verify/vis-admin/vis-admin-10-reproduce-revizija");
    // order detail history of an order that was confirmed/cancelled from „nova“
    const num = (res.revizija.primljenaArrow[0] ?? res.dashboard.primljenaArrow[0] ?? "").match(/SK-\d{4}-\d{6}/)?.[0];
    if (num) {
      res.historyOrder = num;
      await page.goto(`${BASE}/admin/porudzbine/${num}`, { waitUntil: "domcontentloaded", timeout: 120000 });
      await page.waitForTimeout(3500);
      res.history = await page.evaluate(() => {
        const h = [...document.querySelectorAll("h2,h3")].find((e) => /Istorija/.test(e.textContent ?? ""));
        const sec = h?.closest("section") ?? h?.parentElement?.parentElement;
        return sec ? sec.innerText.slice(0, 600) : null;
      });
      res.historyHasPrimljenaStatus = /Primljena\s*(→|—)/.test(res.history ?? "");
      const hs = page.getByText("Istorija", { exact: true }).first();
      if (await hs.count()) await hs.scrollIntoViewIfNeeded();
      await page.waitForTimeout(500);
      res.historyShot = await shot(page, "verify/vis-admin/vis-admin-10-reproduce-history");
    }
  } catch (e) {
    res.error = String(e).slice(0, 400);
  }
  R.v10 = res;
  save();
  await ctx.close();
}

// ── v11: status chip icons for „Završena“ and „Čeka deo“ ──────────────────────────
if (run("v11")) {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-va11", deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  const res = {};
  try {
    await login(page);
    await page.goto(`${BASE}/admin/porudzbine?status=sve`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(4000);
    res.chips = await page.evaluate(() => {
      const out = {};
      for (const el of document.querySelectorAll("span")) {
        const t = (el.textContent ?? "").trim();
        if (!/^(Završena|Čeka deo|Nova|Potvrđena|Otkazana)$/i.test(t)) continue;
        const svg = el.querySelector("svg") ?? el.parentElement?.querySelector("svg");
        if (!svg || out[t]) continue;
        out[t] = (svg.innerHTML ?? "").slice(0, 120);
      }
      return out;
    });
    for (const name of ["Završena", "Čeka deo"]) {
      const chip = page.locator("td span", { hasText: new RegExp(`^${name}$`, "i") }).first();
      if (await chip.count()) {
        await chip.scrollIntoViewIfNeeded();
        const box = await chip.boundingBox();
        if (box) {
          res[`${name}Shot`] = await shot(page, `verify/vis-admin/vis-admin-11-reproduce-${name === "Završena" ? "zavrsena" : "ceka-deo"}`, {
            clip: { x: Math.max(0, box.x - 260), y: Math.max(0, box.y - 12), width: 520, height: box.height + 24 },
          });
        }
      } else res[`${name}Missing`] = true;
    }
    // „Čeka deo“ filter tab
    await page.goto(`${BASE}/admin/porudzbine?status=ceka_deo`, { waitUntil: "domcontentloaded", timeout: 120000 });
    await page.waitForTimeout(3500);
    res.cekaDeoTab = (await page.locator("main").innerText()).slice(0, 400);
    const cd = page.locator("td span", { hasText: /^Čeka deo$/i }).first();
    if (await cd.count()) {
      const box = await cd.boundingBox();
      res.cekaDeoSvg = await cd.evaluate((el) => (el.querySelector("svg") ?? el.parentElement?.querySelector("svg"))?.innerHTML.slice(0, 120));
      if (box) res.cekaDeoShot = await shot(page, "verify/vis-admin/vis-admin-11-reproduce-ceka-deo", { clip: { x: Math.max(0, box.x - 260), y: Math.max(0, box.y - 12), width: 520, height: box.height + 24 } });
    }
    // reference glyphs: an inquiry „U obradi“ chip (Hourglass) for comparison
    await page.goto(`${BASE}/admin/upiti?status=sve`, { waitUntil: "domcontentloaded", timeout: 120000 }).catch(() => {});
    await page.waitForTimeout(3500);
    res.inquiryChips = await page.evaluate(() => {
      const out = {};
      for (const el of document.querySelectorAll("span")) {
        const t = (el.textContent ?? "").trim();
        if (!/^(U obradi)$/i.test(t)) continue;
        const svg = el.querySelector("svg") ?? el.parentElement?.querySelector("svg");
        if (!svg || out[t]) continue;
        out[t] = (svg.innerHTML ?? "").slice(0, 120);
      }
      return out;
    });
  } catch (e) {
    res.error = String(e).slice(0, 400);
  }
  R.v11 = res;
  save();
  await ctx.close();
}

// ── v12: print background ─────────────────────────────────────────────────────────
if (run("v12")) {
  const ctx = await newContext(browser, { width: 794, height: 1123, tag: "verify-va12", mobile: false });
  const page = await ctx.newPage();
  const res = {};
  try {
    await login(page);
    for (const [key, route] of [
      ["predracun", "/admin/porudzbine/SK-2026-000033/predracun"],
      ["otpremnica", "/admin/porudzbine/SK-2026-000092/otpremnica"],
    ]) {
      await page.emulateMedia({ media: "screen" });
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle", timeout: 120000 });
      await page.waitForTimeout(1500);
      await page.emulateMedia({ media: "print" });
      await page.waitForTimeout(500);
      const css = await page.evaluate(() => {
        const cs = (el) => getComputedStyle(el).backgroundColor;
        const wrap = document.querySelector("[data-theme=paper]");
        return {
          html: cs(document.documentElement),
          body: cs(document.body),
          htmlTheme: document.documentElement.getAttribute("data-theme"),
          bodyClass: document.body.className,
          wrapper: wrap ? cs(wrap) : null,
          wrapperH: wrap ? Math.round(wrap.getBoundingClientRect().height) : null,
          docH: document.documentElement.scrollHeight,
          rootBgVar: getComputedStyle(document.documentElement).getPropertyValue("--color-bg"),
          wrapperVars: wrap
            ? Object.fromEntries(
                ["--color-bg", "--color-ink-1", "--color-ink-2", "--color-ink-3", "--color-line"].map((v) => [
                  v,
                  getComputedStyle(wrap).getPropertyValue(v).trim(),
                ]),
              )
            : null,
          wrapperClass: wrap?.className,
        };
      });
      const file = await shot(page, `verify/vis-admin/vis-admin-12-reproduce-${key}-print`);
      const buf = await page.screenshot({ type: "png" });
      const { data, info } = await sharp(buf).raw().toBuffer({ resolveWithObject: true });
      const px = (x, y) => {
        const i = (y * info.width + x) * info.channels;
        return [data[i], data[i + 1], data[i + 2]];
      };
      res[key] = { route, css, file, px_400_1000: px(400, 1000), px_400_1100: px(400, 1100), px_400_200: px(400, 200), px_5_5: px(5, 5) };
      // PDF with background graphics on
      const pdf = `${DIR}/vis-admin-12-reproduce-${key}.pdf`;
      await page.pdf({ path: pdf, format: "A4", printBackground: true, preferCSSPageSize: true });
      res[key].pdf = pdf;
      save();
    }
  } catch (e) {
    res.error = String(e).slice(0, 400);
  }
  R.v12 = res;
  save();
  await ctx.close();
}

await browser.close();
console.log(JSON.stringify(R, null, 2));
