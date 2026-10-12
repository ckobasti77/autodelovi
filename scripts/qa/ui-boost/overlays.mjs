/**
 * Storefront overlays (step 27): the states a page capture never shows.
 *   node scripts/qa/ui-boost/overlays.mjs <outDir> [--base=http://localhost:3000] [--widths=390,1440]
 *
 * Per viewport: the search dialog with live suggestions (typed, then arrow keys), the vehicle
 * picker, the cart drawer with one line, the mobile menu and the contact sheet (390 only), and
 * the offline notice. Viewport captures (overlays are fixed).
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import { PRODUCT, VIEWPORTS, launch, newContext, parseArgs } from "./kit.mjs";

const args = parseArgs();
const outDir = path.resolve(args.positional[0] ?? "docs/qa/screens/step-27/overlays");
const widths = args.flag("widths")?.split(",");
mkdirSync(outDir, { recursive: true });

const browser = await launch();
for (const viewport of VIEWPORTS.filter((v) => !widths || widths.includes(v.tag))) {
  const context = await newContext(browser, args.base, viewport, { tag: "overlays" });
  const page = await context.newPage();
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 160)));
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 160)}`));
  const shot = async (name) => {
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(outDir, `${name}-${viewport.tag}.png`) });
    console.log(`${name}@${viewport.tag}`);
  };
  const step = async (name, run) => {
    try {
      await run();
    } catch (error) {
      console.log(`${name}@${viewport.tag}: FAILED — ${String(error).slice(0, 180)}`);
    }
  };

  await page.goto(`${args.base}/delovi/kocioni-diskovi`, {
    waitUntil: "networkidle",
    timeout: 120_000,
  });

  await step("search", async () => {
    await page.getByTestId("header-search-trigger").click();
    const input = page.getByRole("dialog").getByRole("combobox");
    await input.fill("disk");
    await page.getByRole("dialog").getByRole("option").first().waitFor({ timeout: 20_000 });
    await shot("search-suggestions");
    await page.keyboard.press("ArrowDown");
    await page.keyboard.press("ArrowDown");
    await shot("search-keyboard");
    await input.fill("1K0 615 301 AA");
    await page.waitForTimeout(900);
    await shot("search-code");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
  });

  await step("vehicle", async () => {
    if (viewport.mobile) await page.getByTestId("bottom-bar-vehicle").click();
    else
      await page
        .getByRole("button", { name: /Izaberite vozilo/ })
        .first()
        .click();
    await page.getByRole("dialog").waitFor({ timeout: 20_000 });
    await shot("vehicle-picker");
    await page.keyboard.press("Escape");
  });

  await step("cart", async () => {
    await page.goto(`${args.base}${PRODUCT}`, { waitUntil: "networkidle", timeout: 120_000 });
    await page.locator("#buy-box").getByTestId("product-add-to-cart").click();
    await page.getByText("Dodato").first().waitFor({ timeout: 30_000 });
    await page.getByTestId("cart-button").first().click();
    await page.getByRole("dialog").waitFor({ timeout: 20_000 });
    await shot("cart-drawer");
    await page.keyboard.press("Escape");
  });

  if (viewport.mobile) {
    await step("menu", async () => {
      await page.goto(`${args.base}/delovi`, { waitUntil: "networkidle", timeout: 120_000 });
      await page.getByTestId("mobile-menu-trigger").click();
      await page.getByRole("dialog").waitFor({ timeout: 20_000 });
      await shot("mobile-menu");
      await page.keyboard.press("Escape");
      await page
        .getByTestId("bottom-bar")
        .getByRole("button", { name: /Kontakt/ })
        .click();
      await page.getByRole("dialog").waitFor({ timeout: 10_000 });
      await shot("contact-sheet");
      await page.keyboard.press("Escape");
    });
  }

  await step("offline", async () => {
    await page.goto(`${args.base}/delovi`, { waitUntil: "networkidle", timeout: 120_000 });
    await context.setOffline(true);
    await page
      .getByText(/Nema veze/)
      .first()
      .waitFor({ timeout: 10_000 });
    await shot("offline");
    await context.setOffline(false);
  });

  console.log(
    `errors@${viewport.tag}: ${errors.length}${errors.length ? ` → ${errors.slice(0, 3).join(" | ")}` : ""}`,
  );
  await context.close();
}
await browser.close();
