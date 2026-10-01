/** cart-mechanic-overlays: FLOW-21 (duplicates vs stock), FLOW-22 (qty 0 / >999), VIS-02 (focus under the bar). */
import { BASE, launch, newContext, shot } from "../audit/kit.mjs";
import { loginMechanic } from "../audit/flows-import-mech-lib.mjs";
const only = process.argv[2] ?? "all";
const browser = await launch();
const log = (k, v) => console.log(`--- ${k}: ${typeof v === "string" ? v : JSON.stringify(v)}`);
try {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "fix-qo" });
  const page = await ctx.newPage();
  await loginMechanic(page, "/majstor");
  const clearCart = async () => {
    await page.goto(`${BASE}/korpa`, { waitUntil: "load" });
    await page.waitForTimeout(3000);
    for (let i = 0; i < 20; i++) {
      const b = page.getByRole("button", { name: /^Ukloni / }).first();
      if (!(await b.count())) break;
      await b.click();
      await page.waitForTimeout(1200);
    }
  };
  const quick = async (text, tag) => {
    await page.goto(`${BASE}/majstor/brza-porudzbina`, { waitUntil: "load" });
    const input = page.getByTestId("mechanic-quick-order-input");
    await input.waitFor({ timeout: 60000 });
    await page.waitForTimeout(1500);
    await input.fill(text);
    await page.getByTestId("mechanic-quick-order-check").click();
    await page.waitForFunction(
      () => document.querySelectorAll('[data-testid="mechanic-quick-order-row"]').length > 0 &&
        !document.querySelector('[data-testid="mechanic-quick-order-row"][data-status="pending"]'),
      null, { timeout: 60000 });
    await page.waitForTimeout(1200);
    const rows = await page.getByTestId("mechanic-quick-order-row").evaluateAll((els) =>
      els.map((e) => `[${e.getAttribute("data-status")}] ${e.innerText.replace(/\n+/g, " · ")}`));
    const addAll = await page.getByTestId("mechanic-quick-order-add-all").innerText().catch(() => "");
    log(`${tag} rows`, rows);
    log(`${tag} addAll`, addAll);
    return rows;
  };
  if (only === "all" || only === "flow") {
    await clearCart();
    await quick("5Q0615505R 2\n5Q0 615 505 R 2\n036 121 959 P 1", "21a");
    await shot(page, "../fix/cart-mechanic-overlays/flow21-duplicates-1440");
    await page.getByTestId("mechanic-quick-order-add-all").click();
    await page.waitForTimeout(3000);
    log("21a after add rows", await page.getByTestId("mechanic-quick-order-row").evaluateAll((els) => els.map((e) => e.innerText.replace(/\n+/g, " · "))));
    log("21a toast", await page.locator("[data-sonner-toast], [role=status]").allInnerTexts().catch(() => []));
    await quick("5Q0615505R 2", "21b-again");
    await clearCart();
    await quick("1K0615540Q 1\n1K0 615 540 Q 1", "21c-stock1");
    await quick("5Q0615505R 0\n5Q0615505R 1000\n5Q0615505R x0\nZZ9999999", "22");
    await shot(page, "../fix/cart-mechanic-overlays/flow22-qty-range-1440");
    await clearCart();
  }
  await ctx.close();
  if (only === "all" || only === "vis") {
    for (const [w, h] of [[390, 844], [1440, 900]]) {
      const c2 = await newContext(browser, { width: w, height: h, tag: "fix-qo-vis" });
      const p2 = await c2.newPage();
      await loginMechanic(p2, "/majstor");
      await p2.goto(`${BASE}/majstor/brza-porudzbina`, { waitUntil: "load" });
      const input = p2.getByTestId("mechanic-quick-order-input");
      await input.waitFor({ timeout: 60000 });
      await p2.waitForTimeout(1500);
      await input.fill(["5Q0615505R 2", "036 121 959 P 1", "1K0615301AA 2", "5Q0 698 151 x4", "1K0698151 1", "03L 115 562", "1K0615540Q 1", "ZZ9999999", "04E 115 561 H", "5Q0 615 301 F", "1K0 698 451 J", "6R0 698 151 A"].join("\n"));
      await p2.getByTestId("mechanic-quick-order-check").click();
      await p2.waitForFunction(() => document.querySelectorAll('[data-testid="mechanic-quick-order-row"]').length > 0 &&
        !document.querySelector('[data-testid="mechanic-quick-order-row"][data-status="pending"]'), null, { timeout: 60000 });
      await p2.waitForTimeout(1500);
      await p2.evaluate(() => window.scrollTo(0, 0));
      await p2.locator("#qo-title").click();
      const bar = await p2.evaluate(() => {
        const b = [...document.querySelectorAll("div")].find((d) => d.className.includes("sticky bottom-0") && d.querySelector('[data-testid="mechanic-quick-order-add-all"]'));
        return { h: Math.round(b.getBoundingClientRect().height), spb: document.documentElement.style.scrollPaddingBottom };
      });
      let hidden = 0, partly = 0, stops = 0;
      const hiddenNames = [];
      for (let i = 0; i < 90; i++) {
        await p2.keyboard.press("Tab");
        const r = await p2.evaluate(() => {
          const a = document.activeElement;
          if (!a || a === document.body) return null;
          const b = [...document.querySelectorAll("div")].find((d) => d.className.includes("sticky bottom-0") && d.querySelector('[data-testid="mechanic-quick-order-add-all"]'));
          if (!b || b.contains(a)) return { skip: true };
          const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
          const ov = Math.max(0, Math.min(ar.bottom, br.bottom) - Math.max(ar.top, br.top));
          const inMain = !!a.closest("main");
          return { inMain, frac: ar.height ? ov / ar.height : 0, name: (a.getAttribute("aria-label") || a.textContent || "").trim().slice(0, 40) };
        });
        if (!r || r.skip || !r.inMain) continue;
        stops++;
        if (r.frac >= 0.99) { hidden++; hiddenNames.push(r.name); } else if (r.frac > 0) partly++;
      }
      log(`vis02 ${w}`, { bar, stops, hidden, partly, hiddenNames });
      await p2.evaluate(() => window.scrollTo(0, 0));
      await p2.waitForTimeout(300);
      await shot(p2, `../fix/cart-mechanic-overlays/vis02-quick-order-${w}`);
      await c2.close();
    }
  }
} finally {
  await browser.close();
}
