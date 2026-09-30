/**
 * a11y-store (run 2): cart drawer open/close focus, cart page line removal focus + live region,
 * mobile search sheet (390) focus, suggestions and Escape return. Keyboard only.
 *   node scripts/qa/audit/a11y-store-cart.mjs
 */
import { writeFileSync } from "node:fs";
import { launch, newContext, shot, axe, BASE } from "./kit.mjs";

const out = {};
const note = (k, v) => {
  out[k] = v;
  console.log("--", k, (typeof v === "string" ? v : JSON.stringify(v)).slice(0, 2000));
};
const act = (page) =>
  page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    const r = el.getBoundingClientRect();
    const dlg = el.closest("[role=dialog]");
    return `${el.tagName.toLowerCase()}${el.id ? "#" + el.id : ""} "${(el.getAttribute("aria-label") || el.textContent || "").replace(/\s+/g, " ").trim().slice(0, 50)}" top=${Math.round(r.top)}${dlg ? " in-dialog=" + (dlg.getAttribute("aria-label") || dlg.querySelector("h2")?.textContent || "?") : ""}`;
  });
const browser = await launch();

for (const [w, h] of [[1440, 900], [390, 844]]) {
  const ctx = await newContext(browser, { width: w, height: h, tag: `a11ycart${w}` });
  const page = await ctx.newPage();
  try {
    await page.goto(BASE + "/deo/kocioni-disk-prednji-276-24-mm-demo-0004", { waitUntil: "load", timeout: 180000 });
    await page.waitForTimeout(3000);
    await page.getByTestId("product-add-to-cart").first().focus();
    await page.keyboard.press("Enter");
    await page.waitForTimeout(2000);
    note(`${w} focus after add`, await act(page));
    note(`${w} live regions after add`, await page.evaluate(() => [...document.querySelectorAll("[aria-live],[role=status],[role=alert]")].map((e) => `${e.getAttribute("role") || ""}/${e.getAttribute("aria-live") || ""}: ${e.textContent.replace(/\s+/g, " ").trim().slice(0, 80)}`).filter((s) => !s.endsWith(": "))));
    // open the drawer from the header cart control with the keyboard
    const cartCtl = page.locator("header a[href='/korpa'], header button[aria-label^='Korpa']").first();
    await cartCtl.focus();
    note(`${w} cart control`, await act(page));
    await page.keyboard.press("Enter");
    await page.waitForTimeout(1500);
    note(`${w} focus after open cart`, await act(page));
    note(`${w} url after cart Enter`, page.url());
    const dlg = await page.locator("[role=dialog]:visible").count();
    note(`${w} dialogs visible`, dlg);
    if (dlg) {
      note(`${w} drawer axe`, await axe(page));
      await shot(page, `a11y-store/v2-cart-drawer-${w}`);
      await page.keyboard.press("Escape");
      await page.waitForTimeout(900);
      note(`${w} focus after Escape drawer`, await act(page));
    }
    // cart page: remove a line with the keyboard
    await page.goto(BASE + "/korpa", { waitUntil: "load", timeout: 180000 });
    await page.waitForTimeout(3000);
    const inc = page.locator("main").getByRole("button", { name: "Povećaj količinu" }).first();
    if (await inc.count()) {
      await inc.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      note(`${w} korpa live after +1`, await page.evaluate(() => [...document.querySelectorAll("[aria-live],[role=status]")].map((e) => `${e.getAttribute("role") || ""}/${e.getAttribute("aria-live") || ""}: ${e.textContent.replace(/\s+/g, " ").trim().slice(0, 80)}`).filter((s) => !s.endsWith(": "))));
    }
    const rm = page.locator("main").getByRole("button", { name: /^Ukloni/ }).first();
    note(`${w} korpa remove buttons`, await page.locator("main").getByRole("button", { name: /^Ukloni/ }).count());
    if (await rm.count()) {
      await rm.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(2000);
      note(`${w} focus after remove`, await act(page));
      note(`${w} live after remove`, await page.evaluate(() => [...document.querySelectorAll("[aria-live],[role=status],[role=alert]")].map((e) => `${e.getAttribute("role") || ""}/${e.getAttribute("aria-live") || ""}: ${e.textContent.replace(/\s+/g, " ").trim().slice(0, 80)}`).filter((s) => !s.endsWith(": "))));
      await shot(page, `a11y-store/v2-korpa-after-remove-${w}`);
    }
    if (w === 390) {
      await page.goto(BASE + "/delovi/kocioni-diskovi", { waitUntil: "load", timeout: 180000 });
      await page.waitForTimeout(2500);
      const trig = page.locator("header").getByRole("button", { name: "Pretraga delova" });
      await trig.focus();
      await page.keyboard.press("Enter");
      await page.waitForTimeout(1500);
      note("390 search open focus", await act(page));
      await page.keyboard.type("disk", { delay: 60 });
      await page.waitForTimeout(2500);
      note("390 search combobox", await page.evaluate(() => {
        const i = document.activeElement;
        const lb = document.getElementById(i?.getAttribute("aria-controls") || "");
        return { role: i?.getAttribute("role"), expanded: i?.getAttribute("aria-expanded"), options: lb ? lb.querySelectorAll("[role=option]").length : -1 };
      }));
      note("390 search axe", await axe(page));
      await shot(page, "a11y-store/v2-search-sheet-390");
      await page.keyboard.press("Escape");
      await page.waitForTimeout(500);
      note("390 after Escape 1", await act(page));
      await page.keyboard.press("Escape");
      await page.waitForTimeout(900);
      note("390 after Escape 2", await act(page));
    }
  } catch (e) {
    note(`${w} error`, String(e).slice(0, 300));
  }
  await ctx.close();
}
writeFileSync("docs/qa/audit/a11y-store/v2-cart.json", JSON.stringify(out, null, 1));
await browser.close();
