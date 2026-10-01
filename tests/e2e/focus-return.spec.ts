/**
 * Keyboard focus return for the store overlays that open from global state (A11Y-02).
 *
 * The vehicle picker, the cart drawer and the header search have no Radix trigger, so the shared
 * Dialog/Sheet restore focus from `lib/dom/focusReturn.ts`. After closing, focus must be back on
 * the control that opened the overlay (or the control that replaced it, e.g. the header chip that
 * now names the chosen vehicle) — never on <body>, which sends keyboard and screen-reader users
 * back to the skip link. Closing must not scroll the page either (MOT-07: the sticky header's
 * controls cancel the html scroll padding).
 */
import { expect, test, type Locator, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { TEST_IDS } from "../../constants/testIds";

function convexRun<T>(fn: string, args: Record<string, unknown> = {}): T {
  const out = execFileSync(
    process.execPath,
    [path.resolve("node_modules/convex/bin/main.js"), "run", `testing:${fn}`, JSON.stringify(args)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
  );
  const start = out.search(/[[{]|^null/m);
  return JSON.parse(out.slice(start)) as T;
}

type Samples = {
  inStock: { slug: string } | null;
  vehicleCategory: { categorySlug: string } | null;
};

let samples: Samples;
test.beforeAll(() => {
  samples = convexRun<Samples>("samples");
});

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** Tag + accessible hint of the focused element, or "BODY" when focus fell to the document. */
function activeElement(page: Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "BODY";
    const hint = el.getAttribute("aria-label") ?? el.getAttribute("data-testid") ?? el.textContent;
    return `${el.tagName.toLowerCase()}: ${(hint ?? "").trim().slice(0, 60)}`;
  });
}

async function scrollTo(page: Page, y: number): Promise<number> {
  await page.evaluate((top) => window.scrollTo(0, top), y);
  // Let lazy sections render and any scroll anchoring settle before the reference value is read.
  await page.waitForTimeout(600);
  return page.evaluate(() => Math.round(window.scrollY));
}

/** Keyboard-opens `trigger` and returns the dialog it opened. */
async function openWithKeyboard(page: Page, trigger: Locator, dialogName: string): Promise<Locator> {
  await expect(trigger).toBeVisible({ timeout: 20_000 });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog", { name: dialogName });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  return dialog;
}

async function expectClosed(page: Page, dialogName: string) {
  await expect(page.getByRole("dialog", { name: dialogName })).toHaveCount(0, { timeout: 10_000 });
}

function isMobile(projectName: string): boolean {
  return projectName.startsWith("mobile");
}

test.describe("focus returns to the opener when a store overlay closes (A11Y-02)", () => {
  test("vehicle picker: Escape returns focus to its trigger", async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/");
    // 1440: the header chip; 390: the chip is not shown, the hero field opens the same picker.
    const trigger = isMobile(testInfo.project.name)
      ? page.getByTestId(TEST_IDS.vehiclePickerTrigger).filter({ visible: true }).first()
      : page.getByTestId(TEST_IDS.header).getByTestId(TEST_IDS.vehiclePickerTrigger);
    await openWithKeyboard(page, trigger, "Izaberite vozilo");
    await page.keyboard.press("Escape");
    await expectClosed(page, "Izaberite vozilo");
    await expect(trigger).toBeFocused();
    expect(await activeElement(page)).not.toBe("BODY");
    expect(errors).toEqual([]);
  });

  test("vehicle picker: choosing a vehicle focuses the updated trigger", async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/");
    const mobile = isMobile(testInfo.project.name);
    const scope = mobile ? page.locator("main") : page.getByTestId(TEST_IDS.header);
    const trigger = scope.getByTestId(TEST_IDS.vehiclePickerTrigger).filter({ visible: true }).first();
    const picker = await openWithKeyboard(page, trigger, "Izaberite vozilo");
    await picker.getByRole("button", { name: "Volkswagen" }).click();
    await picker.getByRole("button", { name: /^Golf/ }).first().click();
    await picker.getByRole("button", { name: /Golf VII/ }).first().click();
    await picker.getByRole("button", { name: "Ne znam motor" }).click();
    await expectClosed(page, "Izaberite vozilo");
    // The trigger re-renders with the vehicle's name; focus lands on that control.
    await expect(trigger).toContainText("Golf VII");
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("cart drawer: Escape returns focus to the header cart without scrolling", async ({ page }) => {
    test.skip(!samples.inStock, "no in-stock product in the seed");
    const errors = collectErrors(page);
    await page.goto(`/deo/${samples.inStock!.slug}`);
    const y = await scrollTo(page, 900);
    expect(y).toBeGreaterThan(0);
    const cart = page.getByTestId(TEST_IDS.cartButton);
    await openWithKeyboard(page, cart, "Korpa");
    await page.keyboard.press("Escape");
    await expectClosed(page, "Korpa");
    await expect(cart).toBeFocused();
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(y);
    expect(errors).toEqual([]);
  });

  test("header search: typing then Escape returns focus to the search control without scrolling", async ({
    page,
  }, testInfo) => {
    test.skip(!samples.vehicleCategory, "no category sample in the seed");
    const errors = collectErrors(page);
    await page.goto(`/delovi/${samples.vehicleCategory!.categorySlug}`);
    const y = await scrollTo(page, 900);
    expect(y).toBeGreaterThan(0);
    // 1440: the field-like button; 390: the magnifier icon button.
    const trigger = isMobile(testInfo.project.name)
      ? page.getByTestId(TEST_IDS.header).getByRole("button", { name: "Pretraga delova" })
      : page.getByTestId(TEST_IDS.headerSearchTrigger);
    const dialog = await openWithKeyboard(page, trigger, "Pretraga delova");
    const input = dialog.getByRole("combobox");
    await expect(input).toBeFocused();
    await page.keyboard.type("disk");
    // The first Escape may only close the suggestion list; press until the dialog is gone.
    for (let i = 0; i < 3; i++) {
      if ((await page.getByRole("dialog", { name: "Pretraga delova" }).count()) === 0) break;
      await page.keyboard.press("Escape");
      await page.waitForTimeout(350);
    }
    await expectClosed(page, "Pretraga delova");
    await expect(trigger).toBeFocused();
    expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(y);
    expect(errors).toEqual([]);
  });
});
