// a11y-app: keyboard-only walk of the admin shell (1440): skip link, tab order, command palette,
// shortcuts dialog, bell popover, dashboard charts' text alternatives.
import { writeFileSync } from "node:fs";
import { launch, newContext, shot, axe } from "./kit.mjs";
import { login, go, focused, liveRegions } from "./a11y-app-lib.mjs";

const W = Number(process.env.W ?? 1440);
const browser = await launch();
const ctx = await newContext(browser, { width: W, height: W === 1024 ? 768 : 900, tag: "a11y-app-kbd" });
const page = await ctx.newPage();
const R = { width: W };
await login(page, "admin");
await go(page, "/admin");
await page.waitForTimeout(3000);

// 1. Tab order from the top of the dashboard.
await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
await page.mouse.click(5, 890 > 700 ? 600 : 400).catch(() => {});
await page.evaluate(() => document.activeElement?.blur());
const order = [];
for (let i = 0; i < 45; i++) {
  await page.keyboard.press("Tab");
  const f = await focused(page);
  order.push(`${i + 1}. ${f.tag}${f.role ? `[${f.role}]` : ""} "${f.name}" ${f.href} | ${f.outline} ${f.shadow} ${f.inViewport ? "" : "OFFSCREEN"}`);
  if (i === 0) R.skipShot = await shot(page, `a11y-app/kbd-${W}-01-skip-link`);
}
R.tabOrder = order;

// 2. Skip link activation.
await page.evaluate(() => document.activeElement?.blur());
await page.keyboard.press("Tab");
await page.keyboard.press("Enter");
await page.waitForTimeout(400);
R.afterSkip = await focused(page);
await page.keyboard.press("Tab");
R.afterSkipNextTab = await focused(page);

// 3. Command palette.
await page.keyboard.press("Control+k");
await page.waitForTimeout(800);
R.paletteOpenFocus = await focused(page);
R.paletteDialog = await page.evaluate(() => {
  const d = document.querySelector("[role=dialog]");
  return d ? { name: d.getAttribute("aria-labelledby") ? document.getElementById(d.getAttribute("aria-labelledby"))?.textContent : d.getAttribute("aria-label"), modal: d.getAttribute("aria-modal"), describedby: d.getAttribute("aria-describedby") } : null;
});
await page.keyboard.type("SK-2026-00009", { delay: 40 });
await page.waitForTimeout(3500);
R.paletteState = await page.evaluate(() => {
  const input = document.querySelector("[role=combobox]");
  const lb = document.getElementById(input?.getAttribute("aria-controls") ?? "");
  const opts = lb ? [...lb.querySelectorAll("[role=option]")] : [];
  return {
    activedescendant: input?.getAttribute("aria-activedescendant"),
    options: opts.length,
    firstOptionName: opts[0]?.textContent.trim().slice(0, 90),
    lbChildrenRoles: lb ? [...lb.children].slice(0, 4).map((c) => c.getAttribute("role")) : [],
  };
});
R.paletteLive = await liveRegions(page);
await page.keyboard.press("ArrowDown");
await page.keyboard.press("ArrowDown");
R.paletteAfterArrows = await page.evaluate(() => {
  const input = document.querySelector("[role=combobox]");
  const id = input?.getAttribute("aria-activedescendant");
  const el = id ? document.getElementById(id) : null;
  return { id, text: el?.textContent.trim().slice(0, 80), selected: el?.getAttribute("aria-selected"), visible: el ? (() => { const r = el.getBoundingClientRect(); const lb = el.closest("[role=listbox]").getBoundingClientRect(); return r.top >= lb.top && r.bottom <= lb.bottom; })() : null };
});
R.paletteShot = await shot(page, `a11y-app/kbd-${W}-02-palette-results`);
R.paletteAxe = await axe(page, { include: "[role=dialog]" });
// Nonsense query: is "no results" announced?
await page.keyboard.press("Control+a");
await page.keyboard.type("qqqzzzxx", { delay: 30 });
await page.waitForTimeout(3000);
R.paletteNoResults = await page.evaluate(() => {
  const lb = document.querySelector("[role=listbox]");
  return { listboxText: lb?.textContent.trim().slice(0, 100), liveTexts: [...document.querySelectorAll("[aria-live],[role=status],[role=alert]")].map((e) => e.textContent.trim().slice(0, 60)).filter(Boolean) };
});
R.paletteNoResultsShot = await shot(page, `a11y-app/kbd-${W}-03-palette-noresults`);
await page.keyboard.press("Escape");
await page.waitForTimeout(600);
R.afterPaletteEsc = await focused(page);

// 4. Shortcuts dialog via "?".
await page.evaluate(() => document.querySelector("main")?.focus());
await page.keyboard.press("Shift+Slash");
await page.waitForTimeout(700);
R.shortcuts = await page.evaluate(() => {
  const d = [...document.querySelectorAll("[role=dialog]")].pop();
  return d ? { title: document.getElementById(d.getAttribute("aria-labelledby") ?? "")?.textContent, text: d.textContent.slice(0, 400) } : null;
});
R.shortcutsFocus = await focused(page);
R.shortcutsShot = await shot(page, `a11y-app/kbd-${W}-04-shortcuts`);
await page.keyboard.press("Escape");
await page.waitForTimeout(500);

// 5. Bell popover by keyboard.
const bell = page.getByTestId("admin-notification-bell");
await bell.focus();
R.bellButton = await focused(page);
await page.keyboard.press("Enter");
await page.waitForTimeout(1200);
R.bellOpenFocus = await focused(page);
R.bellPopover = await page.evaluate(() => {
  const c = document.querySelector("[data-radix-popper-content-wrapper] > *");
  return c ? { role: c.getAttribute("role"), labelledby: c.getAttribute("aria-labelledby"), label: c.getAttribute("aria-label"), unreadDots: c.querySelectorAll("span[aria-label='nepročitano']").length, items: c.querySelectorAll("li").length, text: c.textContent.slice(0, 200) } : null;
});
R.bellAxe = await axe(page, { include: "[data-radix-popper-content-wrapper]" });
R.bellShot = await shot(page, `a11y-app/kbd-${W}-05-bell-open`);
await page.keyboard.press("Escape");
await page.waitForTimeout(500);
R.afterBellEsc = await focused(page);

// 6. Dashboard charts: text alternatives.
R.charts = await page.evaluate(() =>
  [...document.querySelectorAll("main svg")].filter((s) => s.getBoundingClientRect().width > 120).map((s) => ({
    role: s.getAttribute("role"), label: s.getAttribute("aria-label"), hidden: s.getAttribute("aria-hidden") ?? s.closest("[aria-hidden]")?.getAttribute("aria-hidden"),
    title: s.querySelector("title")?.textContent, figure: !!s.closest("figure"), figcaption: s.closest("figure")?.querySelector("figcaption")?.textContent?.slice(0, 80),
    siblingTable: !!s.closest("section,figure,div")?.querySelector("table"), w: Math.round(s.getBoundingClientRect().width), h: Math.round(s.getBoundingClientRect().height),
    heading: s.closest("section")?.querySelector("h2,h3")?.textContent?.slice(0, 60),
  })),
);
R.dashboardAxe = await axe(page);
writeFileSync(`docs/qa/audit/a11y-app/admin-kbd-${W}.json`, JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 1).slice(0, 12000));
await browser.close();
