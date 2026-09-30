/**
 * a11y-store: interactive states opened by keyboard — axe in the open state, initial focus,
 * focus trap (25 Tabs), Escape, focus return. Each scenario in a fresh context.
 *   node scripts/qa/audit/a11y-store-states.mjs [scenario...]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { launch, newContext, watch, shot, axe, BASE } from "./kit.mjs";

const OUT = "docs/qa/audit/a11y-store";
mkdirSync(OUT, { recursive: true });

const active = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { body: true };
    const r = el.getBoundingClientRect();
    const dlg = el.closest("[role=dialog],[role=alertdialog]");
    return {
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") || "",
      name: (el.getAttribute("aria-label") || el.textContent || el.getAttribute("placeholder") || "").replace(/\s+/g, " ").trim().slice(0, 60),
      testid: el.getAttribute("data-testid") || "",
      inDialog: dlg ? (dlg.getAttribute("aria-label") || document.getElementById(dlg.getAttribute("aria-labelledby") || "")?.textContent || "dialog").slice(0, 40) : "",
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      outline: getComputedStyle(el).outlineStyle + " " + getComputedStyle(el).outlineWidth,
    };
  });

const dialogs = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[role=dialog],[role=alertdialog]")]
      .filter((d) => d.getBoundingClientRect().height > 0 && getComputedStyle(d).visibility !== "hidden")
      .map((d) => ({
        name: d.getAttribute("aria-label") || document.getElementById(d.getAttribute("aria-labelledby") || "")?.textContent || "(no name)",
        modal: d.getAttribute("aria-modal"),
        desc: d.getAttribute("aria-describedby") ? document.getElementById(d.getAttribute("aria-describedby"))?.textContent?.slice(0, 80) : null,
      })),
  );

async function trapAndEscape(page, rec, tag, { tabs = 25, escape = true } = {}) {
  rec.initialFocus = await active(page);
  rec.dialogs = await dialogs(page);
  rec.axe = await axe(page);
  rec.shot = await shot(page, `a11y-store/state-${tag}`);
  const seen = [];
  let escaped = 0;
  for (let i = 0; i < tabs; i++) {
    await page.keyboard.press("Tab");
    await page.waitForTimeout(60);
    const a = await active(page);
    seen.push(a.body ? "BODY" : `${a.tag}${a.role ? "[" + a.role + "]" : ""}:${a.name}${a.inDialog ? "" : " <OUTSIDE>"}`);
    if (!a.inDialog) escaped++;
  }
  rec.tabSequence = [...new Set(seen)];
  rec.tabsOutside = escaped;
  if (escape) {
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    rec.afterEscapeDialogs = await dialogs(page);
    rec.afterEscapeFocus = await active(page);
  }
}

const scenarios = {
  // 1440 home: „/“ opens the search dialog; type an OEM code; suggestions; ArrowDown; Enter.
  async search(browser) {
    const rec = { scenario: "search 1440 /" };
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "a11ysearch" });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "load", timeout: 180000 }); await page.waitForTimeout(2000);
    await page.waitForTimeout(800);
    await page.keyboard.press("/");
    await page.waitForTimeout(700);
    rec.afterSlash = await active(page);
    await page.keyboard.type("5Q0615505R", { delay: 40 });
    await page.waitForTimeout(1500);
    rec.combobox = await page.evaluate(() => {
      const i = document.activeElement;
      const lb = document.getElementById(i.getAttribute("aria-controls") || "");
      const lives = [...document.querySelectorAll("[aria-live]")].map((l) => `${l.getAttribute("aria-live")}:${l.textContent.trim().slice(0, 120)}`).filter((t) => t.length > 8);
      return {
        expanded: i.getAttribute("aria-expanded"),
        options: lb ? [...lb.querySelectorAll("[role=option]")].map((o) => o.textContent.replace(/\s+/g, " ").trim().slice(0, 90)) : null,
        groups: lb ? [...lb.querySelectorAll("[role=group]")].map((g) => g.getAttribute("aria-label") || g.getAttribute("aria-labelledby")) : null,
        lives,
      };
    });
    rec.axeOpen = await axe(page);
    rec.shotOpen = await shot(page, "a11y-store/state-search-suggestions-1440");
    await page.keyboard.press("ArrowDown");
    await page.waitForTimeout(200);
    rec.afterDown = await page.evaluate(() => {
      const i = document.activeElement;
      const id = i.getAttribute("aria-activedescendant");
      const o = id ? document.getElementById(id) : null;
      return { activedescendant: id, option: o?.textContent.replace(/\s+/g, " ").trim().slice(0, 90), selected: o?.getAttribute("aria-selected") };
    });
    await page.keyboard.press("Enter");
    await page.waitForURL(/\/deo\/|\/pretraga/, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(1200);
    rec.urlAfterEnter = page.url();
    rec.focusAfterNav = await active(page);
    rec.title = await page.title();
    await ctx.close();
    return rec;
  },

  // 1440 home: vehicle picker via keyboard (header chip).
  async vehicle(browser) {
    const rec = { scenario: "vehicle picker 1440 /" };
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "a11yveh" });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "load", timeout: 180000 }); await page.waitForTimeout(2000);
    const trig = page.locator("[data-testid=vehicle-picker-trigger]:visible").first();
    await trig.focus();
    rec.trigger = await active(page);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    rec.snapshot = await page.locator("[role=dialog]").last().ariaSnapshot().catch((e) => String(e));
    await trapAndEscape(page, rec, "vehicle-dialog-1440", { escape: false, tabs: 12 });
    // keyboard selection: focus the first list, type/arrow
    rec.pick = [];
    const dlg = page.locator("[role=dialog]").last();
    const opt = dlg.getByRole("option", { name: /Volkswagen/ }).first();
    const btn = dlg.getByRole("button", { name: /Volkswagen/ }).first();
    const target = (await opt.count()) ? opt : btn;
    rec.pick.push(`vw role ${(await opt.count()) ? "option" : (await btn.count()) ? "button" : "none"}`);
    if (await target.count()) {
      await target.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1000);
      rec.pick.push(await active(page));
      rec.snapshotStep2 = await dlg.ariaSnapshot().catch((e) => String(e));
      rec.shotStep2 = await shot(page, "a11y-store/state-vehicle-step2-1440");
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(700);
    rec.afterEscapeDialogs = await dialogs(page);
    rec.afterEscapeFocus = await active(page);
    await ctx.close();
    return rec;
  },

  // 1440 home: 3D „Lista delova“ → parts list dialog → pick a category → part panel.
  async parts(browser) {
    const rec = { scenario: "3D parts list + part panel 1440 /" };
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "a11yparts" });
    const page = await ctx.newPage();
    const log = watch(page);
    await page.goto(BASE + "/", { waitUntil: "load", timeout: 180000 }); await page.waitForTimeout(2000);
    await page.waitForTimeout(1000);
    const trig = page.getByTestId("parts-list-trigger").first();
    await trig.focus();
    rec.trigger = await active(page);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2500);
    rec.snapshot = (await page.getByTestId("parts-list-dialog").ariaSnapshot().catch((e) => String(e))).slice(0, 3000);
    await trapAndEscape(page, rec, "partslist-1440", { escape: false, tabs: 10 });
    // pick first category via keyboard: find first button/link in dialog list
    const dlg = page.getByTestId("parts-list-dialog");
    const first = dlg.locator("button, a").filter({ hasText: /Kočion|disk/i }).first();
    if (await first.count()) {
      await first.focus();
      rec.pickName = (await first.textContent())?.replace(/\s+/g, " ").trim();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(3500);
      const panel = page.getByTestId("part-panel");
      rec.panelVisible = await panel.isVisible().catch(() => false);
      rec.panelFocus = await active(page);
      rec.panelDialogs = await dialogs(page);
      rec.panelSnapshot = (await panel.ariaSnapshot().catch((e) => String(e))).slice(0, 3000);
      rec.panelAxe = await axe(page);
      rec.panelShot = await shot(page, "a11y-store/state-partpanel-1440");
      const seq = [];
      for (let i = 0; i < 14; i++) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(60);
        const a = await active(page);
        seq.push(`${a.tag}:${a.name}${a.inDialog ? "" : " <OUT>"}`);
      }
      rec.panelTabs = seq;
      await page.keyboard.press("Escape");
      await page.waitForTimeout(1200);
      rec.panelAfterEscVisible = await panel.isVisible().catch(() => false);
      rec.panelAfterEscFocus = await active(page);
    }
    rec.console = log.console.slice(0, 5);
    await ctx.close();
    return rec;
  },

  // 390 home: mobile menu sheet.
  async menu(browser) {
    const rec = { scenario: "mobile menu 390 /" };
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "a11ymenu" });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "load", timeout: 180000 }); await page.waitForTimeout(2000);
    const trig = page.getByTestId("mobile-menu-trigger").first();
    await trig.focus();
    rec.trigger = await active(page);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1200);
    rec.snapshot = await page.locator("[role=dialog]").last().ariaSnapshot().catch((e) => String(e));
    rec.handle = await page.evaluate(() => {
      const b = [...document.querySelectorAll("[role=dialog] button")].find((x) => /Proširi|Smanji/.test(x.getAttribute("aria-label") || ""));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { name: b.getAttribute("aria-label"), w: Math.round(r.width), h: Math.round(r.height) };
    });
    await trapAndEscape(page, rec, "menu-390");
    await ctx.close();
    return rec;
  },

  // 390 category: filter sheet.
  async filters(browser) {
    const rec = { scenario: "filter sheet 390 /delovi/kocioni-diskovi" };
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "a11yfilt" });
    const page = await ctx.newPage();
    await page.goto(BASE + "/delovi/kocioni-diskovi", { waitUntil: "load", timeout: 180000 }); await page.waitForTimeout(2000);
    const trig = page.getByRole("button", { name: /^Filteri/ }).first();
    await trig.focus();
    rec.trigger = await active(page);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1200);
    rec.snapshot = (await page.locator("[role=dialog]").last().ariaSnapshot().catch((e) => String(e))).slice(0, 2500);
    // toggle the first checkbox with Space and read live count
    await trapAndEscape(page, rec, "filters-390", { tabs: 20 });
    await ctx.close();
    return rec;
  },

  // 390 home: vehicle picker as bottom sheet.
  async vehicle390(browser) {
    const rec = { scenario: "vehicle picker 390 /" };
    const ctx = await newContext(browser, { width: 390, height: 844, tag: "a11yveh390" });
    const page = await ctx.newPage();
    await page.goto(BASE + "/", { waitUntil: "load", timeout: 180000 }); await page.waitForTimeout(2000);
    const trig = page.locator("[data-testid=vehicle-picker-trigger]:visible").first();
    await trig.focus();
    rec.trigger = await active(page);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    rec.handle = await page.evaluate(() => {
      const b = [...document.querySelectorAll("[role=dialog] button")].find((x) => /Proširi|Smanji/.test(x.getAttribute("aria-label") || ""));
      if (!b) return null;
      const r = b.getBoundingClientRect();
      return { name: b.getAttribute("aria-label"), w: Math.round(r.width), h: Math.round(r.height) };
    });
    await trapAndEscape(page, rec, "vehicle-sheet-390");
    await ctx.close();
    return rec;
  },

  // 1440 home without consent: banner + settings.
  async banner(browser) {
    const rec = { scenario: "consent banner 1440 + 390 /" };
    for (const [w, h] of [[1440, 900], [390, 844]]) {
      const ctx = await newContext(browser, { width: w, height: h, consent: false, tag: `a11ybanner${w}` });
      const page = await ctx.newPage();
      await page.goto(BASE + "/", { waitUntil: "load", timeout: 180000 }); await page.waitForTimeout(2000);
      await page.waitForTimeout(1000);
      const r = {};
      r.dialogs = await dialogs(page);
      r.focusAtLoad = await active(page);
      r.axe = await axe(page);
      r.shot = await shot(page, `a11y-store/state-banner-${w}`);
      r.bannerRect = await page.getByTestId("consent-banner").boundingBox();
      // Tab order: where does the banner come?
      const seq = [];
      for (let i = 0; i < 8; i++) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(60);
        const a = await active(page);
        seq.push(`${a.tag}:${a.name}${a.inDialog ? " [banner]" : ""} ${a.rect}`);
      }
      r.tabs = seq;
      // open settings
      const settings = page.getByTestId("consent-banner").getByRole("button", { name: /Podešavanja/ });
      if (await settings.count()) {
        await settings.focus();
        await page.keyboard.press("Enter");
        await page.waitForTimeout(800);
        r.settingsFocus = await active(page);
        r.settingsSnapshot = await page.getByTestId("consent-banner").ariaSnapshot().catch((e) => String(e));
        r.settingsAxe = await axe(page);
        r.settingsShot = await shot(page, `a11y-store/state-banner-settings-${w}`);
      }
      // 2.4.11: tab deep into the page and see whether the banner covers the focused element
      await page.goto(BASE + "/delovi/kocioni-diskovi", { waitUntil: "load", timeout: 180000 }); await page.waitForTimeout(2000);
      await page.waitForTimeout(800);
      const covered = [];
      for (let i = 0; i < 40; i++) {
        await page.keyboard.press("Tab");
        await page.waitForTimeout(50);
        const c = await page.evaluate(() => {
          const el = document.activeElement;
          const banner = document.querySelector("[data-testid=consent-banner]");
          if (!el || !banner || banner.contains(el)) return null;
          const r = el.getBoundingClientRect();
          const b = banner.getBoundingClientRect();
          const visTop = Math.max(r.top, 0);
          const visBottom = Math.min(r.bottom, b.top);
          const hiddenFully = visBottom <= visTop;
          return hiddenFully ? `${el.tagName.toLowerCase()} "${(el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40)}" rect ${Math.round(r.top)}-${Math.round(r.bottom)} bannerTop ${Math.round(b.top)}` : null;
        });
        if (c) covered.push(c);
      }
      r.coveredByBanner = covered;
      if (covered.length) r.coveredShot = await shot(page, `a11y-store/state-banner-covers-${w}`);
      rec[w] = r;
      await ctx.close();
    }
    return rec;
  },
};

const names = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(scenarios);
const browser = await launch();
const results = {};
for (const n of names) {
  try {
    results[n] = await scenarios[n](browser);
  } catch (e) {
    results[n] = { error: String(e).slice(0, 500) };
  }
  console.log("==", n, JSON.stringify(results[n], null, 1).slice(0, 6000));
}
await browser.close();
writeFileSync(`${OUT}/states-${names.join("-")}.json`, JSON.stringify(results, null, 1));
