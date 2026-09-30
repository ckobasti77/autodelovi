// Independent verification of a11y-app-11..14 (step 21 verifier). Read-only except client-side
// wizard navigation (no dry run / commit) and a row selection that is undone again.
// Usage: node scripts/qa/audit/verify-a11y-app-11-14.mjs [s11 s12 s13 s14]
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { BASE, launch, newContext, shot } from "./kit.mjs";

const DIR = "docs/qa/audit/verify/a11y-app";
mkdirSync(DIR, { recursive: true });
const OUT = `${DIR}/a11y-app-11-14-reproduce.json`;
const R = existsSync(OUT) ? JSON.parse(readFileSync(OUT, "utf8")) : {};
const save = () => writeFileSync(OUT, JSON.stringify(R, null, 2));
const want = process.argv.slice(2);
const run = (k) => want.length === 0 || want.includes(k);
const ACC = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));

async function login(page, email, password, next) {
  await page.goto(`${BASE}/prijava?next=${encodeURIComponent(next)}`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await page.getByTestId("auth-email").waitFor({ timeout: 120000 });
  await page.waitForFunction(() => {
    const f = document.querySelector("[data-testid=auth-email]")?.closest("form");
    return !!f && Object.keys(f).some((k) => k.startsWith("__reactProps"));
  }, null, { timeout: 180000 });
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith(next), { timeout: 180000 });
}

async function hydrated(page, sel) {
  await page.waitForFunction(
    (s) => {
      const el = document.querySelector(s);
      return !!el && Object.keys(el).some((k) => k.startsWith("__reactFiber") || k.startsWith("__reactProps"));
    },
    sel,
    { timeout: 180000 },
  );
}

/** Chromium AX node (role, name, states) for the first element matching `selector`. */
async function axNode(page, cdp, selector) {
  const { result } = await cdp.send("Runtime.evaluate", { expression: `document.querySelector(${JSON.stringify(selector)})` });
  if (!result.objectId) return null;
  const { nodes } = await cdp.send("Accessibility.getPartialAXTree", { objectId: result.objectId, fetchRelatives: false });
  const n = nodes[0];
  if (!n) return null;
  return {
    role: n.role?.value,
    name: n.name?.value ?? null,
    ignored: n.ignored,
    props: Object.fromEntries((n.properties ?? []).map((p) => [p.name, p.value?.value])),
  };
}

/** Starts recording every text change inside any live region (and live regions added later). */
async function recordLive(page) {
  await page.evaluate(() => {
    window.__liveLog = [];
    const isLive = (el) =>
      el.nodeType === 1 &&
      (el.closest("[aria-live]:not([aria-live=off]),[role=status],[role=alert],[role=log]") !== null);
    const obs = new MutationObserver((muts) => {
      for (const m of muts) {
        const t = m.target.nodeType === 3 ? m.target.parentElement : m.target;
        if (t && isLive(t)) window.__liveLog.push((t.closest("[aria-live],[role=status],[role=alert],[role=log]")?.textContent ?? "").trim().slice(0, 120));
        for (const a of m.addedNodes) {
          if (a.nodeType === 1 && (a.matches("[aria-live],[role=status],[role=alert],[role=log]") || a.querySelector("[aria-live],[role=status],[role=alert],[role=log]")))
            window.__liveLog.push("ADDED-LIVE:" + a.textContent.trim().slice(0, 120));
        }
      }
    });
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: false });
  });
}

const liveRegions = (page) =>
  page.evaluate(() =>
    [...document.querySelectorAll("[aria-live],[role=status],[role=alert],[role=log]")].map((e) => ({
      tag: e.tagName.toLowerCase(),
      role: e.getAttribute("role") || "",
      live: e.getAttribute("aria-live") || "",
      text: e.textContent.trim().slice(0, 100),
      inMain: !!e.closest("main"),
    })),
  );

const active = (page) =>
  page.evaluate(() => {
    const e = document.activeElement;
    return e ? `${e.tagName.toLowerCase()}${e.getAttribute("role") ? `[role=${e.getAttribute("role")}]` : ""} ${(e.getAttribute("aria-label") || e.textContent || "").trim().slice(0, 60)}` : null;
  });

const browser = await launch("chromium");
try {
  // ---------- a11y-app-11: DataTable selection ----------
  if (run("s11")) {
    R.s11 = {};
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-a11y-11" });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await login(page, process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, "/admin");
    for (const route of ["/admin/porudzbine", "/admin/proizvodi"]) {
      const out = {};
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
      await page.locator("tbody tr[data-row]").first().waitFor({ timeout: 120000 });
      await hydrated(page, "tbody tr[data-row]");
      await page.waitForTimeout(1500);
      // Keyboard walk: Tab from the top until a row is focused.
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      let tabs = 0;
      for (; tabs < 80; tabs++) {
        await page.keyboard.press("Tab");
        const isRow = await page.evaluate(() => document.activeElement?.matches("tr[data-row]"));
        if (isRow) break;
      }
      out.tabsToRow = tabs + 1;
      out.table = await page.evaluate(() => {
        const t = document.querySelector("tbody tr[data-row]").closest("table");
        return { role: t.getAttribute("role"), caption: t.querySelector("caption")?.textContent?.trim() };
      });
      out.tableAX = await axNode(page, cdp, "table:has(tbody tr[data-row])");
      out.rowAXBefore = await axNode(page, cdp, "tbody tr[data-row]");
      out.checkbox = await page.evaluate(() => {
        const c = document.querySelector("tbody tr[data-row] [role=checkbox]");
        return c ? { tabindex: c.getAttribute("tabindex"), ariaChecked: c.getAttribute("aria-checked"), label: c.getAttribute("aria-label") } : null;
      });
      out.liveBefore = await liveRegions(page);
      await recordLive(page);
      await page.keyboard.press("Space");
      await page.waitForTimeout(1200);
      out.afterSpace = {
        activeElement: await active(page),
        rowAriaSelected: await page.evaluate(() => document.activeElement?.getAttribute("aria-selected")),
        rowAX: await axNode(page, cdp, "tbody tr[data-row][aria-selected=true]"),
        checkboxAX: await axNode(page, cdp, "tbody tr[data-row][aria-selected=true] [role=checkbox]"),
        bulkBar: await page.evaluate(() => {
          const b = document.querySelector("[role=region][aria-label='Grupne radnje']");
          return b ? { text: b.textContent.trim().slice(0, 120), live: b.getAttribute("aria-live"), inLive: !!b.closest("[aria-live],[role=status]") } : null;
        }),
        liveRegions: await liveRegions(page),
        liveChanges: await page.evaluate(() => window.__liveLog),
      };
      const tag = route.split("/").pop();
      out.shot = await shot(page, `verify/a11y-app/a11y-app-11-reproduce-${tag}`);
      // Undo the selection.
      await page.keyboard.press("Space");
      await page.waitForTimeout(600);
      out.afterUndo = {
        rowAriaSelected: await page.evaluate(() => document.activeElement?.getAttribute("aria-selected")),
        bulkBar: await page.evaluate(() => !!document.querySelector("[role=region][aria-label='Grupne radnje']")),
        liveChanges: await page.evaluate(() => window.__liveLog),
      };
      R.s11[route] = out;
      save();
    }
    await ctx.close();
  }

  // ---------- a11y-app-12: import wizard ----------
  if (run("s12")) {
    const out = {};
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-a11y-12" });
    const page = await ctx.newPage();
    await login(page, process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, "/admin");
    await page.goto(`${BASE}/admin/uvoz`, { waitUntil: "domcontentloaded", timeout: 180000 });
    await page.getByTestId("import-file-input").waitFor({ state: "attached", timeout: 120000 });
    await hydrated(page, "[data-testid=import-file-input]");
    await page.waitForTimeout(1200);
    out.fileStep = { live: await liveRegions(page) };
    out.fileInput = await page.evaluate(() => {
      const i = document.querySelector("[data-testid=import-file-input]");
      return { tabindex: i.getAttribute("tabindex"), type: i.type };
    });
    await recordLive(page);
    await page.getByTestId("import-file-input").setInputFiles(path.resolve("tests/fixtures/import/proizvodi-500.xlsx"));
    const next = page.getByRole("button", { name: /Dalje: kolone/ });
    await next.waitFor({ timeout: 120000 });
    await page.waitForTimeout(800);
    out.afterParse = { active: await active(page), live: await liveRegions(page), liveChanges: await page.evaluate(() => window.__liveLog) };
    await next.focus();
    await recordLive(page);
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    out.afterStepChange = {
      active: await active(page),
      currentStep: await page.evaluate(() => document.querySelector("nav[aria-label='Koraci uvoza'] [aria-current=step]")?.textContent.trim()),
      live: await liveRegions(page),
      liveChanges: await page.evaluate(() => window.__liveLog),
    };
    out.shotMapping = await shot(page, "verify/a11y-app/a11y-app-12-reproduce-mapping");
    // A finished batch page (read-only), if any is listed.
    await page.goto(`${BASE}/admin/uvoz/istorija`, { waitUntil: "domcontentloaded", timeout: 180000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const href = await page.evaluate(() => [...document.querySelectorAll("a[href^='/admin/uvoz/']")].map((a) => a.getAttribute("href")).find((h) => /\/admin\/uvoz\/[a-z0-9]{20,}/.test(h)));
    out.batchHref = href ?? null;
    if (href) {
      await page.goto(BASE + href, { waitUntil: "domcontentloaded", timeout: 180000 });
      await page.waitForTimeout(4000);
      out.batchPage = {
        live: await liveRegions(page),
        result: await page.evaluate(() => document.querySelector("[data-testid=import-result]")?.textContent.trim() ?? null),
        progressbars: await page.evaluate(() => [...document.querySelectorAll("[role=progressbar]")].map((p) => ({ label: p.getAttribute("aria-label"), now: p.getAttribute("aria-valuenow"), live: !!p.closest("[aria-live],[role=status]") }))),
      };
      out.shotBatch = await shot(page, "verify/a11y-app/a11y-app-12-reproduce-batch");
    }
    R.s12 = out;
    save();
    await ctx.close();
  }

  // ---------- a11y-app-13: notification bell ----------
  if (run("s13")) {
    const out = {};
    const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-a11y-13" });
    const page = await ctx.newPage();
    const cdp = await ctx.newCDPSession(page);
    await login(page, process.env.SEED_ADMIN_EMAIL, process.env.SEED_ADMIN_PASSWORD, "/admin");
    for (const route of ["/admin", "/admin/porudzbine"]) {
      await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
      const bell = page.getByTestId("admin-notification-bell").or(page.locator("button[aria-label^='Obaveštenja']")).first();
      await bell.waitFor({ timeout: 120000 });
      await hydrated(page, "button[aria-label^='Obaveštenja']");
      await page.waitForTimeout(2500);
      const r = {};
      r.bellLabel = await bell.getAttribute("aria-label");
      r.badge = await page.evaluate(() => document.querySelector("button[aria-label^='Obaveštenja']")?.textContent.trim());
      await bell.focus();
      await page.keyboard.press("Enter");
      await page.waitForSelector("[data-radix-popper-content-wrapper] [role=dialog]", { timeout: 20000 });
      await page.waitForTimeout(700);
      r.dialog = await page.evaluate(() => {
        const d = document.querySelector("[data-radix-popper-content-wrapper] [role=dialog]");
        return {
          role: d.getAttribute("role"),
          ariaLabel: d.getAttribute("aria-label"),
          labelledby: d.getAttribute("aria-labelledby"),
          describedby: d.getAttribute("aria-describedby"),
          headings: [...d.querySelectorAll("h1,h2,h3,h4,[role=heading]")].map((h) => h.textContent.trim()),
          titleEl: d.querySelector("p")?.outerHTML.slice(0, 120),
          items: d.querySelectorAll("li").length,
          itemTitles: [...d.querySelectorAll("li")].map((li) => li.textContent.trim().slice(0, 70)).slice(0, 8),
        };
      });
      r.dialogAX = await axNode(page, cdp, "[data-radix-popper-content-wrapper] [role=dialog]");
      r.activeInside = await active(page);
      if (route === "/admin") r.shot = await shot(page, "verify/a11y-app/a11y-app-13-reproduce");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      r.afterEsc = await active(page);
      out[route] = r;
    }
    R.s13 = out;
    save();
    await ctx.close();
  }

  // ---------- a11y-app-14: account sub-page headings ----------
  if (run("s14")) {
    const out = {};
    for (const vp of [{ width: 390, height: 844 }, { width: 1440, height: 900 }]) {
      const ctx = await newContext(browser, { ...vp, tag: `verify-a11y-14-${vp.width}` });
      const page = await ctx.newPage();
      await login(page, ACC.customer.email, ACC.customer.password, "/nalog");
      const res = {};
      for (const route of ["/nalog", "/nalog/porudzbine", "/nalog/upiti", "/nalog/vozila", "/nalog/profil"]) {
        await page.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 180000 });
        await page.locator("h1").first().waitFor({ timeout: 120000 });
        await page.waitForLoadState("load").catch(() => {});
        await page.waitForTimeout(3500);
        res[route] = await page.evaluate(() => ({
          title: document.title,
          headings: [...document.querySelectorAll("main h1, main h2, main h3, main h4, main [role=heading]")].map((h) => `${h.tagName}:${h.textContent.trim().slice(0, 50)}`),
          allHeadings: [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")].map((h) => `${h.tagName}:${h.textContent.trim().slice(0, 40)}`),
          currentTab: document.querySelector("[aria-current=page]")?.textContent.trim() ?? null,
          legends: [...document.querySelectorAll("main legend")].map((l) => l.textContent.trim()),
        }));
        if (vp.width === 390 && route === "/nalog/vozila") res.shot390 = await shot(page, "verify/a11y-app/a11y-app-14-reproduce-vozila-390");
        if (vp.width === 1440 && route === "/nalog/porudzbine") res.shot1440 = await shot(page, "verify/a11y-app/a11y-app-14-reproduce-porudzbine-1440");
      }
      out[vp.width] = res;
      R.s14 = out;
      save();
      await ctx.close();
    }
  }
} catch (e) {
  R.error = String(e).slice(0, 600);
  save();
  console.error(e);
} finally {
  await browser.close();
}
console.log(JSON.stringify(R, null, 1).slice(0, 12000));
