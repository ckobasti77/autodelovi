// a11y-app (second pass): deep keyboard/ARIA checks on the admin shell and key admin screens.
// Each section is independent (try/catch) and the result is written after every section.
// Usage: node scripts/qa/audit/a11y-app-deep-admin.mjs [section ...]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { BASE, launch, newContext, shot, axe } from "./kit.mjs";
import { login, focused } from "./a11y-app-lib.mjs";

const DIR = "docs/qa/audit/a11y-app";
const OUT = `${DIR}/deep-admin.json`;
const R = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const want = process.argv.slice(2);
const save = () => writeFileSync(OUT, JSON.stringify(R, null, 2));

const browser = await launch();
let state = existsSync(`${DIR}/state/admin.json`) ? JSON.parse(readFileSync(`${DIR}/state/admin.json`, "utf8")) : null;

async function page(width = 1440) {
  const ctx = await newContext(browser, { width, height: width === 1024 ? 768 : 900, tag: "a11y-app-deep" });
  if (state) await ctx.addCookies(state.cookies);
  if (state?.origins?.length) {
    await ctx.addInitScript((origins) => {
      for (const o of origins) if (o.origin === location.origin) for (const i of o.localStorage) localStorage.setItem(i.name, i.value);
    }, state.origins);
  }
  const p = await ctx.newPage();
  return { ctx, p };
}
async function open(p, route) {
  await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
  if (new URL(p.url()).pathname.startsWith("/prijava")) {
    await login(p, "admin");
    state = await p.context().storageState();
    writeFileSync(`${DIR}/state/admin.json`, JSON.stringify(state));
    await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
  }
  await p.locator("main h1").first().waitFor({ timeout: 120000 }).catch(() => {});
  await p.waitForLoadState("load", { timeout: 60000 }).catch(() => {});
  // hydration of the shell
  await p.waitForFunction(() => {
    const b = document.querySelector("[data-testid=admin-notification-bell]") || document.querySelector("main button");
    return !!b && Object.keys(b).some((k) => k.startsWith("__reactProps"));
  }, null, { timeout: 120000 }).catch(() => {});
  await p.waitForTimeout(2500);
}
async function section(name, fn) {
  if (want.length && !want.includes(name)) return;
  const t = Date.now();
  try {
    R[name] = await fn();
  } catch (e) {
    R[name] = { error: String(e).slice(0, 400) };
  }
  R[name]._ms = Date.now() - t;
  save();
  console.log(name, JSON.stringify(R[name]).slice(0, 1500));
}

// A. Skip link from a fresh load.
await section("skip", async () => {
  const { ctx, p } = await page(1440);
  await open(p, "/admin/porudzbine");
  await p.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
  await p.keyboard.press("Tab");
  const first = await focused(p);
  const ev1 = await shot(p, "a11y-app/deep-skip-01-visible", { clip: { x: 0, y: 0, width: 700, height: 120 } });
  await p.keyboard.press("Enter");
  await p.waitForTimeout(500);
  const afterEnter = await focused(p);
  const target = await p.evaluate(() => {
    const t = document.getElementById("sadrzaj");
    return t ? { tag: t.tagName.toLowerCase(), tabindex: t.getAttribute("tabindex"), inMain: !!t.closest("main") || t.tagName === "MAIN" } : null;
  });
  await p.keyboard.press("Tab");
  const nextTab = await focused(p);
  await ctx.close();
  return { first, afterEnter, target, nextTab, url: p.url().replace(BASE, ""), ev1 };
});

// B. Command palette opened from its trigger; focus return; active option contrast; live region.
await section("palette", async () => {
  const { ctx, p } = await page(1440);
  await open(p, "/admin");
  const trigger = p.getByRole("button", { name: /Broj porudžbine/ }).first();
  await trigger.focus();
  const trig = await focused(p);
  await p.keyboard.press("Enter");
  await p.waitForTimeout(900);
  const openFocus = await focused(p);
  await p.keyboard.type("SK-2026-00009", { delay: 40 });
  await p.waitForTimeout(4000);
  await p.keyboard.press("ArrowDown");
  await p.waitForTimeout(300);
  const active = await p.evaluate(() => {
    const input = document.querySelector("[role=combobox]");
    const el = document.getElementById(input?.getAttribute("aria-activedescendant") ?? "");
    const dlg = el?.closest("[role=dialog]");
    const bg = (x) => getComputedStyle(x).backgroundColor;
    return { text: el?.textContent.trim().slice(0, 40), optionBg: el && bg(el), dialogBg: dlg && bg(dlg), outline: el && getComputedStyle(el).outlineStyle, inputOutline: input && getComputedStyle(input).outlineStyle, inputBorder: input && getComputedStyle(input.parentElement).borderBottomColor };
  });
  const live = await p.evaluate(() => [...document.querySelectorAll("[role=dialog] [aria-live],[role=dialog] [role=status],[role=dialog] [role=alert]")].map((e) => ({ live: e.getAttribute("aria-live"), role: e.getAttribute("role"), text: e.textContent.trim().slice(0, 80) })));
  const ev = await shot(p, "a11y-app/deep-palette-active-option", { clip: { x: 400, y: 60, width: 640, height: 420 } });
  await p.keyboard.press("Control+a");
  await p.keyboard.type("qqqzzzxx", { delay: 30 });
  await p.waitForTimeout(3500);
  const noResults = await p.evaluate(() => ({
    listbox: document.querySelector("[role=listbox]")?.textContent.trim().slice(0, 80),
    liveTexts: [...document.querySelectorAll("[aria-live],[role=status],[role=alert]")].map((e) => e.textContent.trim()).filter(Boolean),
    activedescendant: document.querySelector("[role=combobox]")?.getAttribute("aria-activedescendant"),
  }));
  await p.keyboard.press("Escape");
  await p.waitForTimeout(700);
  const afterEsc = await focused(p);
  // Ctrl+K from a link inside main, then Esc
  await p.locator("main a").first().focus();
  const before2 = await focused(p);
  await p.keyboard.press("Control+k");
  await p.waitForTimeout(800);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(600);
  const afterEsc2 = await focused(p);
  await ctx.close();
  return { trig, openFocus, active, live, ev, noResults, afterEsc, before2, afterEsc2 };
});

// C. Orders table: sort headers, tab stops, row focus, selection, bulk bar, status badges.
await section("orders", async () => {
  const { ctx, p } = await page(1440);
  await open(p, "/admin/porudzbine");
  await p.locator("tbody tr[data-row]").first().waitFor({ timeout: 90000 });
  const headers = await p.evaluate(() => [...document.querySelectorAll("thead th")].map((th) => ({ text: th.textContent.trim().slice(0, 30), sort: th.getAttribute("aria-sort"), btn: !!th.querySelector("button"), btnName: th.querySelector("button")?.getAttribute("aria-label") || th.querySelector("button")?.textContent.trim() })));
  const caption = await p.evaluate(() => document.querySelector("table caption")?.textContent);
  // tab through from the first sortable header
  const firstSort = p.locator("thead th button").first();
  await firstSort.focus();
  const stops = [];
  for (let i = 0; i < 14; i++) {
    const f = await focused(p);
    stops.push(`${f.tag}${f.role ? `[${f.role}]` : ""} "${f.name.slice(0, 40)}" ${f.outline}`);
    await p.keyboard.press("Tab");
  }
  // focus the first row, screenshot focus ring
  const row = p.locator("tbody tr[data-row]").first();
  await row.focus();
  const rowFocus = await p.evaluate(() => {
    const e = document.activeElement;
    const cs = getComputedStyle(e);
    const td = e.querySelector("td");
    return { tag: e.tagName, outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} ${cs.outlineOffset}`, shadow: cs.boxShadow, tdShadow: td && getComputedStyle(td).boxShadow, name: e.getAttribute("aria-label"), selected: e.getAttribute("aria-selected") };
  });
  const box = await row.boundingBox();
  const evRow = await shot(p, "a11y-app/deep-orders-row-focus", { clip: { x: 230, y: Math.max(0, box.y - 60), width: 1200, height: 160 } });
  await p.keyboard.press("Space");
  await p.waitForTimeout(700);
  const afterSpace = await p.evaluate(() => ({
    selectedRows: document.querySelectorAll("tbody tr[data-state=selected]").length,
    live: [...document.querySelectorAll("[aria-live],[role=status],[role=alert]")].map((e) => `${e.getAttribute("role") || ""}/${e.getAttribute("aria-live") || ""}: ${e.textContent.trim().slice(0, 80)}`).filter((t) => !t.endsWith(": ")),
    toolbar: [...document.querySelectorAll("[role=toolbar],[data-testid*=bulk]")].map((e) => ({ role: e.getAttribute("role"), label: e.getAttribute("aria-label"), text: e.textContent.trim().slice(0, 120) })),
    focusStill: document.activeElement?.tagName,
  }));
  const evBulk = await shot(p, "a11y-app/deep-orders-bulk", { fullPage: false });
  // status badge: text or colour only?
  const badges = await p.evaluate(() => [...document.querySelectorAll("tbody tr[data-row]")].slice(0, 6).map((tr) => [...tr.querySelectorAll("td")].map((td) => td.textContent.trim().slice(0, 22)).join(" | ")));
  // unselect
  await p.keyboard.press("Space").catch(() => {});
  await ctx.close();
  return { caption, headers, stops, rowFocus, evRow, afterSpace, evBulk, badges };
});

// D. Settings tabs.
await section("settings", async () => {
  const { ctx, p } = await page(1440);
  await open(p, "/admin/podesavanja");
  const tl = await p.evaluate(() => {
    const lists = [...document.querySelectorAll("[role=tablist]")];
    return lists.map((l) => ({ label: l.getAttribute("aria-label"), orient: l.getAttribute("aria-orientation"), tabs: [...l.querySelectorAll("[role=tab]")].map((t) => `${t.textContent.trim()}${t.getAttribute("aria-selected") === "true" ? "*" : ""}${t.getAttribute("aria-controls") ? "" : "(no controls)"} tabindex=${t.getAttribute("tabindex")}`) }));
  });
  const nav = await p.evaluate(() => [...document.querySelectorAll("main nav, main [role=navigation]")].map((n) => ({ label: n.getAttribute("aria-label"), links: [...n.querySelectorAll("a")].map((a) => `${a.textContent.trim()}${a.getAttribute("aria-current") ? "*" : ""}`) })));
  let arrows = null;
  const firstTab = p.locator("[role=tab]").first();
  if (await firstTab.count()) {
    await firstTab.focus();
    const a0 = await focused(p);
    await p.keyboard.press("ArrowRight");
    await p.waitForTimeout(600);
    const a1 = await focused(p);
    const sel = await p.evaluate(() => [...document.querySelectorAll("[role=tab][aria-selected=true]")].map((t) => t.textContent.trim()));
    arrows = { a0, a1, sel, url: p.url().replace(BASE, "") };
    await p.keyboard.press("ArrowLeft");
  }
  const ev = await shot(p, "a11y-app/deep-settings-tabs", { clip: { x: 232, y: 0, width: 1208, height: 360 } });
  const ax = await axe(p);
  await ctx.close();
  return { tl, nav, arrows, ev, ax };
});

// E. Import wizard entry: file input reachable and labelled.
await section("import", async () => {
  const { ctx, p } = await page(1440);
  await open(p, "/admin/uvoz");
  const inputs = await p.evaluate(() => [...document.querySelectorAll("main input[type=file]")].map((i) => {
    const lbl = i.labels?.[0];
    const cs = getComputedStyle(i);
    return { id: i.id, ariaLabel: i.getAttribute("aria-label"), labelledby: i.getAttribute("aria-labelledby"), label: lbl?.textContent.trim().slice(0, 80), tabindex: i.getAttribute("tabindex"), disabled: i.disabled, accept: i.accept, clip: `${cs.position} ${cs.width}x${cs.height} ${cs.clip} op=${cs.opacity}` };
  }));
  // Tab from the h1 area until the file input or dropzone gets focus
  await p.locator("main h1").first().click();
  const stops = [];
  for (let i = 0; i < 10; i++) {
    await p.keyboard.press("Tab");
    const f = await focused(p);
    const isFile = await p.evaluate(() => document.activeElement?.type === "file");
    stops.push(`${f.tag}${isFile ? "[file]" : ""}${f.role ? `[${f.role}]` : ""} "${f.name.slice(0, 40)}" ${f.outline} ${f.shadow}`);
    if (isFile) {
      R._importFileFocusShot = await shot(p, "a11y-app/deep-import-file-focus", { clip: { x: 232, y: 60, width: 1208, height: 520 } });
      break;
    }
  }
  const live = await p.evaluate(() => [...document.querySelectorAll("main [aria-live],main [role=status],main [role=alert],main [role=progressbar]")].map((e) => `${e.getAttribute("role") || ""}/${e.getAttribute("aria-live") || ""}`));
  const steps = await p.evaluate(() => {
    const n = document.querySelector("nav[aria-label='Koraci uvoza']");
    return n ? { html: n.outerHTML.slice(0, 600), current: [...n.querySelectorAll("[aria-current]")].map((e) => `${e.textContent.trim()}=${e.getAttribute("aria-current")}`) } : null;
  });
  await ctx.close();
  return { inputs, stops, live, steps, shot: R._importFileFocusShot };
});

// F. Dashboard charts: text alternatives and table toggle.
await section("charts", async () => {
  const { ctx, p } = await page(1440);
  await open(p, "/admin");
  await p.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await p.waitForTimeout(1500);
  const charts = await p.evaluate(() => [...document.querySelectorAll("main svg")].filter((s) => s.getBoundingClientRect().width > 150).map((s) => ({
    role: s.getAttribute("role"), label: s.getAttribute("aria-label"), labelledby: s.getAttribute("aria-labelledby"), hidden: s.getAttribute("aria-hidden") ?? s.closest("[aria-hidden]")?.getAttribute("aria-hidden"),
    title: s.querySelector("title")?.textContent, focusables: s.querySelectorAll("[tabindex],a,button").length, w: Math.round(s.getBoundingClientRect().width),
    region: s.closest("section,figure,[role=region]")?.querySelector("h2,h3,figcaption")?.textContent?.slice(0, 60),
  })));
  const toggles = await p.evaluate(() => [...document.querySelectorAll("main button")].filter((b) => /tabel|grafik/i.test(b.textContent)).map((b) => ({ text: b.textContent.trim(), expanded: b.getAttribute("aria-expanded"), pressed: b.getAttribute("aria-pressed"), controls: b.getAttribute("aria-controls") })));
  const btn = p.locator("main button", { hasText: /Prikaži tabelu/ }).first();
  let after = null;
  if (await btn.count()) {
    await btn.focus();
    await p.keyboard.press("Enter");
    await p.waitForTimeout(800);
    after = await p.evaluate(() => ({ focus: document.activeElement?.textContent.trim().slice(0, 40), tables: [...document.querySelectorAll("main table")].map((t) => ({ caption: t.querySelector("caption")?.textContent?.slice(0, 60), th: t.querySelectorAll("th").length, rows: t.querySelectorAll("tbody tr").length })) }));
    R._chartTableShot = await shot(p, "a11y-app/deep-dashboard-chart-table", { fullPage: false });
  }
  const evChart = await shot(p, "a11y-app/deep-dashboard-bottom", { fullPage: false });
  await ctx.close();
  return { charts, toggles, after, evChart, tableShot: R._chartTableShot };
});

// G. Order detail at 1024: unlabeled control, dialogs.
await section("orderDetail", async () => {
  const { ctx, p } = await page(1024);
  await open(p, "/admin/porudzbine/SK-2026-000092");
  const unlabeled = await p.evaluate(() => [...document.querySelectorAll("main button,main [role=checkbox],main input:not([type=hidden])")].filter((b) => b.offsetParent || b.getClientRects().length).map((b) => {
    const name = b.getAttribute("aria-label") || (b.getAttribute("aria-labelledby") && document.getElementById(b.getAttribute("aria-labelledby"))?.textContent) || (b.id && document.querySelector(`label[for="${b.id}"]`)?.textContent) || b.closest("label")?.textContent || b.textContent.trim() || b.title;
    return { tag: b.tagName.toLowerCase(), role: b.getAttribute("role"), type: b.type, id: b.id, name: (name || "").trim().slice(0, 60), hidden: b.getAttribute("aria-hidden"), tabindex: b.getAttribute("tabindex") };
  }).filter((x) => !x.name));
  const buttons = await p.evaluate(() => [...document.querySelectorAll("main button")].filter((b) => b.offsetParent).map((b) => (b.getAttribute("aria-label") || b.textContent.trim()).slice(0, 40)));
  const statusRegion = await p.evaluate(() => [...document.querySelectorAll("main [role=status]")].map((e) => e.textContent.trim().slice(0, 100)));
  // Open the first dialog-opening button that is safe (status change / cancel) and close with Esc.
  const cand = p.locator("main button[aria-haspopup=dialog], main button", { hasText: /Otkaži|Promeni|Dodaj napomenu|Status|Pošalji|Izmeni/ }).first();
  let dialog = null;
  if (await cand.count()) {
    const label = (await cand.textContent())?.trim();
    await cand.focus();
    await p.keyboard.press("Enter");
    await p.waitForTimeout(900);
    dialog = await p.evaluate(() => {
      const d = [...document.querySelectorAll("[role=dialog],[role=alertdialog]")].pop();
      if (!d) return null;
      const lb = d.getAttribute("aria-labelledby");
      return { role: d.getAttribute("role"), name: lb ? document.getElementById(lb)?.textContent : d.getAttribute("aria-label"), desc: d.getAttribute("aria-describedby") ? document.getElementById(d.getAttribute("aria-describedby"))?.textContent?.slice(0, 80) : null, focusIn: d.contains(document.activeElement), focusName: (document.activeElement?.getAttribute("aria-label") || document.activeElement?.textContent || "").trim().slice(0, 40) };
    });
    if (dialog) {
      dialog.opener = label;
      dialog.ev = await shot(p, "a11y-app/deep-order-dialog-1024", { fullPage: false });
      dialog.axe = await axe(p, { include: "[role=dialog],[role=alertdialog]" });
      // trap check: tab 12 times, all inside?
      let outside = 0;
      for (let i = 0; i < 12; i++) { await p.keyboard.press("Tab"); if (!(await p.evaluate(() => !!document.activeElement?.closest("[role=dialog],[role=alertdialog]")))) outside++; }
      dialog.tabOutside = outside;
      await p.keyboard.press("Escape");
      await p.waitForTimeout(600);
      dialog.afterEsc = await focused(p);
    }
  }
  const ev = await shot(p, "a11y-app/deep-order-detail-1024", { fullPage: false });
  await ctx.close();
  return { unlabeled, buttons, statusRegion, dialog, ev };
});

// H. Bell popover and sidebar live counts.
await section("bell", async () => {
  const { ctx, p } = await page(1440);
  await open(p, "/admin");
  const counts = await p.evaluate(() => {
    const side = [...document.querySelectorAll("nav[aria-label=Administracija] a")].filter((a) => /\d/.test(a.textContent)).map((a) => ({ text: a.textContent.trim(), aria: a.getAttribute("aria-label"), live: !!a.closest("[aria-live]") || !!a.querySelector("[aria-live]") }));
    const bell = document.querySelector("[data-testid=admin-notification-bell]");
    return { side, bell: bell && { label: bell.getAttribute("aria-label"), visible: bell.textContent.trim(), expanded: bell.getAttribute("aria-expanded"), haspopup: bell.getAttribute("aria-haspopup") }, bellLive: [...document.querySelectorAll("header [aria-live]")].map((e) => e.textContent.trim()) };
  });
  await p.getByTestId("admin-notification-bell").click();
  await p.waitForTimeout(1200);
  const pop = await p.evaluate(() => {
    const c = document.querySelector("[data-radix-popper-content-wrapper] > *");
    if (!c) return null;
    const unread = c.querySelectorAll("[aria-label='nepročitano']");
    return { role: c.getAttribute("role"), labelledby: c.getAttribute("aria-labelledby"), label: c.getAttribute("aria-label"), heading: c.querySelector("h2,h3,p")?.textContent?.slice(0, 40), unreadMarks: unread.length, unreadMarkTag: unread[0]?.tagName, unreadMarkRole: unread[0]?.getAttribute("role"), items: [...c.querySelectorAll("li")].slice(0, 3).map((li) => ({ text: li.textContent.trim().slice(0, 70), link: !!li.querySelector("a"), button: !!li.querySelector("button") })) };
  });
  await ctx.close();
  return { counts, pop };
});

await browser.close();
console.log("saved", OUT);
