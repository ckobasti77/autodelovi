import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, overflowX, shot, axe, loginAdmin, loginWith } from "./kit.mjs";

const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const OUT = "verify/a11y-app";
mkdirSync(`docs/qa/audit/${OUT}`, { recursive: true });
const which = process.argv[2] ?? "all";
const res = {};
const browser = await launch("chromium");

const focusDesc = (page) =>
  page.evaluate(() => {
    const a = document.activeElement;
    if (!a) return null;
    return `${a.tagName.toLowerCase()}${a.getAttribute("name") ? `[name=${a.getAttribute("name")}]` : ""} "${(a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40)}"`;
  });
const liveRegions = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[role="alert"],[role="status"],[aria-live]')]
      .filter((e) => e.textContent.trim())
      .map((e) => `${e.getAttribute("role") || "live"}:${e.textContent.trim().slice(0, 80)}`),
  );

// ---------- 07 registration
if (which === "all" || which === "07") {
  res["07"] = {};
  for (const w of [390, 1440]) {
    const ctx = await newContext(browser, { width: w, height: w < 1024 ? 844 : 900, tag: "v07" });
    const page = await ctx.newPage();
    await page.goto(`${BASE}/registracija`, { waitUntil: "networkidle" });
    await page.waitForTimeout(800);
    // Tab from the first field to the submit button, like a keyboard user.
    await page.locator('input[name="name"]').focus();
    let tabs = 0;
    for (; tabs < 15; tabs++) {
      const isSubmit = await page.evaluate(() => document.activeElement?.getAttribute("data-testid") === "signup-submit");
      if (isSubmit) break;
      await page.keyboard.press("Tab");
    }
    const before = await liveRegions(page);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(900);
    const submit = page.getByTestId("signup-submit");
    res["07"][`registracija-${w}`] = {
      tabsToSubmit: tabs,
      focus: await focusDesc(page),
      live: await liveRegions(page),
      before,
      invalid: await page.evaluate(() => [...document.querySelectorAll('[aria-invalid="true"]')].map((e) => e.getAttribute("name") || e.id)),
      errorsText: await page.evaluate(() =>
        [...document.querySelectorAll("form .text-danger")].map((e) => e.textContent.trim()).filter(Boolean),
      ),
      submitTop: (await submit.boundingBox())?.y,
      firstFieldTop: (await page.locator('input[name="name"]').boundingBox())?.y,
      vh: page.viewportSize().height,
    };
    await shot(page, `${OUT}/a11y-app-07-reproduce-${w}`);
    await ctx.close();
  }
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "v07b" });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/za-majstore/registracija`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  const btn = page.locator('form button[type="submit"]').last();
  await btn.focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  res["07"]["za-majstore-390"] = { focus: await focusDesc(page), live: await liveRegions(page) };
  await page.goto(`${BASE}/prijava`, { waitUntil: "networkidle" });
  await page.getByTestId("auth-submit").focus();
  await page.keyboard.press("Enter");
  await page.waitForTimeout(900);
  res["07"]["prijava-390"] = { focus: await focusDesc(page), live: await liveRegions(page) };
  await ctx.close();
}

// ---------- 08 price list picker
async function tabScan(page, maxTabs = 70) {
  const stops = [];
  let shotName = null;
  for (let i = 0; i < maxTabs; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(80);
    const info = await page.evaluate(() => {
      const a = document.activeElement;
      if (!a || a === document.body) return null;
      const r = a.getBoundingClientRect();
      const bars = [...document.querySelectorAll("div")].filter((d) => {
        const cs = getComputedStyle(d);
        return cs.position === "sticky" && cs.bottom === "0px";
      });
      let covered = 0;
      let barRect = null;
      let inBar = false;
      for (const b of bars) {
        const br = b.getBoundingClientRect();
        if (b.contains(a)) {
          inBar = true;
          continue;
        }
        barRect = { top: Math.round(br.top), bottom: Math.round(br.bottom), h: Math.round(br.height) };
        const top = Math.max(r.top, br.top);
        const bottom = Math.min(r.bottom, br.bottom);
        if (bottom > top && r.height > 0) covered = Math.max(covered, (bottom - top) / r.height);
      }
      return {
        label: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40),
        top: Math.round(r.top),
        bottom: Math.round(r.bottom),
        covered: Math.round(covered * 100),
        barRect,
        inBar,
      };
    });
    if (!info) continue;
    stops.push(info);
    if (!shotName && info.covered >= 100) shotName = info.label;
    if (info.inBar) break;
  }
  return { stops, shotName };
}

if (which === "all" || which === "08") {
  res["08"] = {};
  for (const w of [390, 360, 768, 1440]) {
    const ctx = await newContext(browser, { width: w, height: w === 1440 ? 900 : w === 768 ? 1024 : 844, tag: "v08" });
    const page = await ctx.newPage();
    await loginWith(page, acc.mechanic.email, acc.mechanic.password, "/majstor");
    await page.goto(`${BASE}/majstor/cenovnik`, { waitUntil: "networkidle" });
    await page.waitForTimeout(1500);
    await page.locator("h1").first().click();
    // First pass: find which stops are fully hidden.
    const { stops, shotName } = await tabScan(page);
    // Second pass: stop on the first fully hidden one to capture it.
    if (shotName && w === 390) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.locator("h1").first().click();
      for (let i = 0; i < 70; i++) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(60);
        const lab = await page.evaluate(() => (document.activeElement.getAttribute("aria-label") || document.activeElement.textContent || "").trim().slice(0, 40));
        if (lab === shotName) break;
      }
      await page.waitForTimeout(300);
      await shot(page, `${OUT}/a11y-app-08-reproduce-390`);
    }
    res["08"][w] = {
      total: stops.length,
      fullCount: stops.filter((s) => s.covered >= 100).length,
      full: stops.filter((s) => s.covered >= 100).map((s) => `${s.label} [${s.top}-${s.bottom}]`),
      partial: stops.filter((s) => s.covered > 0 && s.covered < 100).map((s) => `${s.label} ${s.covered}%`),
      bar: stops.find((s) => s.barRect)?.barRect,
      firstHidden: shotName,
      scrollPaddingBottom: await page.evaluate(() => getComputedStyle(document.documentElement).scrollPaddingBottom),
    };
    await ctx.close();
  }
}

// ---------- 09 mechanic header widths
if (which === "all" || which === "09") {
  res["09"] = {};
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "v09" });
  const page = await ctx.newPage();
  await loginWith(page, acc.mechanic.email, acc.mechanic.password, "/majstor");
  for (const route of ["/majstor", "/majstor/cenovnik", "/", "/delovi/kocioni-diskovi"]) {
    for (const w of [320, 360, 375, 390]) {
      await page.setViewportSize({ width: w, height: 800 });
      await page.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await page.waitForTimeout(700);
      const o = await overflowX(page);
      const menu = await page.evaluate(() => {
        const b = [...document.querySelectorAll("header button, header a")].find((e) =>
          /Otvori meni/i.test(e.getAttribute("aria-label") || e.textContent),
        );
        if (!b) return null;
        const r = b.getBoundingClientRect();
        return { left: Math.round(r.left), right: Math.round(r.right), vw: document.documentElement.clientWidth };
      });
      const headerItems =
        w === 360 || w === 320
          ? await page.evaluate(() =>
              [...document.querySelectorAll("header a, header button")]
                .filter((e) => e.getBoundingClientRect().width > 0)
                .map(
                  (e) =>
                    `${(e.getAttribute("aria-label") || e.textContent).trim().slice(0, 22)}@${Math.round(e.getBoundingClientRect().left)}-${Math.round(e.getBoundingClientRect().right)}`,
                ),
            )
          : undefined;
      res["09"][`${route} ${w}`] = { over: o.over, offenders: o.offenders.slice(0, 3), menu, headerItems };
      if (route === "/majstor" && (w === 360 || w === 320)) {
        await shot(page, `${OUT}/a11y-app-09-reproduce-mechanic-${w}`, { clip: { x: 0, y: 0, width: w, height: 140 } });
      }
    }
  }
  await ctx.close();
  const actx = await newContext(browser, { width: 320, height: 800, tag: "v09a" });
  const ap = await actx.newPage();
  for (const route of ["/", "/prijava", "/registracija", "/delovi/kocioni-diskovi"]) {
    for (const w of [320, 360]) {
      await ap.setViewportSize({ width: w, height: 800 });
      await ap.goto(`${BASE}${route}`, { waitUntil: "networkidle" });
      await ap.waitForTimeout(500);
      res["09"][`anon ${route} ${w}`] = await overflowX(ap);
    }
  }
  await actx.close();
}

// ---------- 10 admin notifications link
if (which === "all" || which === "10") {
  res["10"] = {};
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "v10" });
  const page = await ctx.newPage();
  await loginAdmin(page);
  await page.goto(`${BASE}/admin/obavestenja`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
  const link = page.getByRole("link", { name: "podešavanjima" }).first();
  res["10"].link = await link.evaluate((a) => {
    const cs = getComputedStyle(a);
    const p = getComputedStyle(a.parentElement);
    return {
      color: cs.color,
      deco: cs.textDecorationLine,
      weight: cs.fontWeight,
      parentTag: a.parentElement.tagName,
      parentColor: p.color,
      parentWeight: p.fontWeight,
      theme: a.closest("[data-theme]")?.getAttribute("data-theme"),
      bg: getComputedStyle(document.body).backgroundColor,
    };
  });
  res["10"].axe = await axe(page);
  const box = await link.boundingBox();
  await shot(page, `${OUT}/a11y-app-10-reproduce-1440`, {
    clip: { x: Math.max(0, box.x - 520), y: Math.max(0, box.y - 70), width: 760, height: 150 },
  });
  await link.hover();
  await page.waitForTimeout(250);
  res["10"].hoverDeco = await link.evaluate((a) => getComputedStyle(a).textDecorationLine);
  // Other admin prose links with the same pattern
  res["10"].otherInlineNoUnderline = await page.evaluate(() =>
    [...document.querySelectorAll("main p a, main span a")]
      .filter((a) => getComputedStyle(a).textDecorationLine === "none")
      .map((a) => a.textContent.trim().slice(0, 40)),
  );
  await ctx.close();
}

writeFileSync(`docs/qa/audit/${OUT}/a11y-app-07-10-reproduce-${which}.json`, JSON.stringify(res, null, 2));
console.log(JSON.stringify(res, null, 2));
await browser.close();
