/**
 * admin-lists-shell (step 22) verification: VIS-16, A11Y-11, A11Y-12 (command palette),
 * VIS-17 + A11Y-16 (bulk selection), FLOW-23 (plain-text preview), A11Y-15 (inline link),
 * FLOW-19 (offline banner). Writes docs/qa/fix/admin-lists-shell/verify.json.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/admin-lists-shell-verify.mjs [only,keys]
 */
import { mkdirSync, writeFileSync } from "node:fs";

import { BASE, axe, convexRun, launch, loginAdmin, newContext } from "../audit/kit.mjs";

const only = process.argv[2]?.split(",") ?? null;
const want = (k) => !only || only.includes(k);
const out = {};
const browser = await launch("chromium");

async function session(width, height, fn) {
  const ctx = await newContext(browser, { width, height });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 200)));
  try {
    await loginAdmin(page);
    return { ...(await fn(page, ctx)), errors };
  } finally {
    await ctx.close();
  }
}

try {
  if (want("palette")) {
    for (const [w, h] of [
      [390, 844],
      [1440, 900],
    ]) {
      out[`palette-${w}`] = await session(w, h, async (page) => {
        await page.goto(`${BASE}/admin/porudzbine`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("main table tbody tr[data-row]", { timeout: 30000 });
        await page.keyboard.press("Control+k");
        const input = page.getByRole("combobox");
        await input.waitFor();
        await input.fill("SK-2026-000092");
        await page.waitForSelector("[role=option] >> text=/SK-2026/", { timeout: 15000 });
        await page.waitForTimeout(700);
        const geo = await page.evaluate(() => {
          const d = document.querySelector("[role=dialog]").getBoundingClientRect();
          const c = [...document.querySelectorAll("[role=dialog] button")].find(
            (b) => b.getAttribute("aria-label") === "Zatvori",
          );
          const cb = c?.getBoundingClientRect();
          return {
            vw: innerWidth,
            dialog: [Math.round(d.left), Math.round(d.right)],
            close: cb ? [Math.round(cb.left), Math.round(cb.right)] : null,
            closeOnScreen: cb ? cb.right <= innerWidth : false,
            docOver: document.documentElement.scrollWidth - document.documentElement.clientWidth,
          };
        });
        const statusResults = await page.locator("[role=dialog] p[role=status]").textContent();
        await page.keyboard.press("ArrowDown");
        const active = await page.evaluate(() => {
          const o = document.querySelector("[role=option][aria-selected=true]");
          const s = getComputedStyle(o);
          return {
            label: o.textContent.slice(0, 30),
            outline: `${s.outlineStyle} ${s.outlineWidth} ${s.outlineColor} offset ${s.outlineOffset}`,
            bg: s.backgroundColor,
          };
        });
        await input.fill("qqqzzzxx");
        await page.waitForTimeout(1500);
        const statusNone = await page.locator("[role=dialog] p[role=status]").textContent();
        return { geo, statusResults, active, statusNone };
      });
      console.log(`palette-${w}`, JSON.stringify(out[`palette-${w}`]));
    }
  }

  if (want("bulk")) {
    for (const path of ["/admin/porudzbine", "/admin/proizvodi"]) {
      out[`bulk${path}`] = await session(1440, 900, async (page) => {
        await page.goto(`${BASE}${path}`, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("main table tbody tr[data-row]", { timeout: 30000 });
        await page.waitForTimeout(800);
        const tops = () =>
          page.evaluate(() =>
            [...document.querySelectorAll("main table tbody tr[data-row]")]
              .slice(0, 3)
              .map((r) => Math.round(r.getBoundingClientRect().top)),
          );
        const before = await tops();
        const box = await page
          .locator("main table tbody tr[data-row]")
          .first()
          .locator("[role=checkbox]")
          .boundingBox();
        const x = box.x + box.width / 2;
        const y = box.y + box.height / 2;
        await page.mouse.click(x, y);
        await page.waitForTimeout(400);
        const after = await tops();
        const status1 = await page.locator("main p[role=status]").first().textContent();
        const url1 = page.url();
        await page.mouse.click(x, y); // same spot: must toggle, not open the record
        await page.waitForTimeout(800);
        const url2 = page.url();
        const status2 = await page.locator("main p[role=status]").first().textContent();
        const checked = await page
          .locator("main table tbody tr[data-row]")
          .first()
          .getAttribute("aria-selected");
        // Keyboard: focus the first row and press Space.
        await page.locator("main table tbody tr[data-row]").first().focus();
        await page.keyboard.press("Space");
        await page.waitForTimeout(300);
        const status3 = await page.locator("main p[role=status]").first().textContent();
        return {
          before,
          after,
          shifted: before.some((t, i) => t !== after[i]),
          status1,
          navigated: url1 !== url2,
          status2,
          firstRowSelectedAfterSecondClick: checked,
          status3,
        };
      });
      console.log(`bulk${path}`, JSON.stringify(out[`bulk${path}`]));
    }
  }

  if (want("text")) {
    out.text = await session(1440, 900, async (page) => {
      await page.goto(`${BASE}/admin/mejlovi/sabloni?sablon=order_received&prikaz=tekst`, {
        waitUntil: "domcontentloaded",
      });
      const pre = page.locator("main pre").first();
      await pre.waitFor({ timeout: 30000 });
      const gallery = await pre.evaluate((p) => ({
        transform: getComputedStyle(p).textTransform,
        wrap: getComputedStyle(p).overflowWrap,
        overflow: p.scrollWidth - p.clientWidth,
        visibleStart: p.innerText.slice(0, 40),
      }));
      await page.goto(`${BASE}/admin/obavestenja`, { waitUntil: "domcontentloaded" });
      const link = page.locator("main a", { hasText: "podešavanjima" }).first();
      await link.waitFor({ timeout: 30000 });
      const deco = await link.evaluate((a) => getComputedStyle(a).textDecorationLine);
      const violations = (await axe(page)).filter((v) => v.id === "link-in-text-block");
      return { gallery, linkDecoration: deco, linkInTextBlock: violations.length };
    });
    console.log("text", JSON.stringify(out.text));
  }

  if (want("offline")) {
    out.offline = await session(1440, 900, async (page, ctx) => {
      await page.goto(`${BASE}/admin`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("main h1", { timeout: 30000 });
      await page.waitForTimeout(2500);
      const strip = page.getByTestId("admin-connection");
      const idle = (await strip.textContent()) ?? "";
      await ctx.setOffline(true);
      await page.waitForTimeout(2500);
      const offline = (await strip.textContent()) ?? "";
      const role = await strip.getAttribute("role");
      const sticky = await strip.evaluate((e) => getComputedStyle(e).position);
      await ctx.setOffline(false);
      const back = [];
      for (let i = 0; i < 8; i++) {
        await page.waitForTimeout(1000);
        back.push(((await strip.textContent()) ?? "").slice(0, 40));
      }
      return { idle, offline, role, sticky, back };
    });
    console.log("offline", JSON.stringify(out.offline));
  }

  if (want("confirm")) {
    const { number } = convexRun("testing:createTestOrder", { tag: "fix22-als" });
    out.confirm = await session(1440, 900, async (page, ctx) => {
      // Bulk „Potvrdi“ on the list goes through the shared ConfirmDialog (useConfirm).
      await page.goto(`${BASE}/admin/porudzbine`, { waitUntil: "domcontentloaded" });
      const row = page.locator("main table tbody tr[data-row]", { hasText: number });
      await row.waitFor({ timeout: 30000 });
      await page.waitForTimeout(1500);
      await row.locator("[role=checkbox]").click();
      await page.getByRole("region", { name: "Grupne radnje" }).getByRole("button", { name: "Potvrdi", exact: true }).click();
      const dialog = page.getByRole("alertdialog");
      await dialog.waitFor();
      await ctx.setOffline(true);
      await page.waitForTimeout(500);
      await dialog.getByRole("button", { name: "Potvrdi", exact: true }).click();
      await page.waitForTimeout(3000);
      const buttons = await dialog
        .locator("button")
        .evaluateAll((bs) => bs.map((b) => `${b.textContent.trim()}|${b.disabled}`));
      const dialogStatus = await dialog.locator("p[role=status]").textContent();
      const banner = await page.getByTestId("admin-connection").textContent();
      await dialog.getByRole("button", { name: "Zatvori", exact: true }).last().click();
      await page.waitForTimeout(800);
      const dialogClosed = (await page.getByRole("alertdialog").count()) === 0;
      await ctx.setOffline(false);
      let applied = false;
      for (let i = 0; i < 20 && !applied; i++) {
        await page.waitForTimeout(1000);
        applied = !(await page.locator("main table tbody tr[data-row]", { hasText: number }).count());
      }
      return { number, buttons, dialogStatus, banner, dialogClosed, appliedAfterReconnect: applied };
    });
    console.log("confirm", JSON.stringify(out.confirm));
  }
} finally {
  await browser.close();
}
mkdirSync("docs/qa/fix/admin-lists-shell", { recursive: true });
writeFileSync(
  `docs/qa/fix/admin-lists-shell/verify${only ? `-${only.join("-")}` : ""}.json`,
  JSON.stringify(out, null, 2),
);
