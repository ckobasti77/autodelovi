/**
 * Step 28 — owner requirement 1: no visible box has sharp corners.
 *
 * On every main route of the storefront, the mechanics portal, the account and the admin, at
 * both project widths (1440 and 390), after scrolling the page end to end: no card, button,
 * input, select, image, badge, dialog, menu, toast or tooltip has a computed border radius of
 * 0 on all four corners — apart from the one documented allowlist, full-bleed elements, whose
 * edges meet the viewport (DESIGN-SYSTEM §5.3). Overlays are opened and audited too: a page
 * capture never shows them.
 *
 * The audit is `cornerAuditInPage` in helpers/uiBoost.ts. One line per route is printed, and
 * per run the full-bleed elements that were let through, by name.
 */
import { expect, test, type Page } from "@playwright/test";

import { TEST_IDS } from "../../constants/testIds";
import {
  CATEGORY_PATH,
  PRODUCT_PATH,
  auditCorners,
  cornerLine,
  engineReady,
  missingCredentials,
  openRoute,
  routesFor,
  scrollEndToEnd,
  settle,
  signInAs,
  type CornerKind,
  type CornerReport,
  type Role,
} from "./helpers/uiBoost";

const describeFindings = (label: string, report: CornerReport) =>
  report.sharp.map(
    (item) => `${label}: ${item.kind} ${item.sig} ${item.size} „${item.text}“ in ${item.within}`,
  );

/** The allowlist as it was used: each full-bleed element once, with how often it was seen. */
function fullBleedSummary(seen: Map<string, number>): string {
  return [...seen.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sig, count]) => `${sig} ×${count}`)
    .join(" · ");
}

function noteFullBleed(seen: Map<string, number>, report: CornerReport) {
  for (const item of report.fullBleed) {
    const key = `${item.kind} ${item.sig}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
}

async function auditRoutes(page: Page, role: Role, width: string): Promise<string[]> {
  await signInAs(page, role);
  const findings: string[] = [];
  const state = { cartReady: false };
  let boxes = 0;
  const allowed = new Map<string, number>();
  const routes = routesFor(role);
  for (const route of routes) {
    await openRoute(page, route, state);
    await scrollEndToEnd(page);
    const report = await auditCorners(page);
    const label = `${route.name}@${width}`;
    console.log(cornerLine(label, report));
    boxes += Object.values(report.checked).reduce((sum, count) => sum + count, 0);
    noteFullBleed(allowed, report);
    findings.push(...describeFindings(label, report));
  }
  console.log(
    `corners ${role}@${width}: ${routes.length} routes, ${boxes} elements audited, ${findings.length} sharp`,
  );
  console.log(`corners ${role}@${width} full-bleed allowlist used: ${fullBleedSummary(allowed)}`);
  return findings;
}

test.describe("no sharp corners on the main routes", () => {
  test.setTimeout(15 * 60_000);

  for (const [role, title] of [
    ["visitor", "storefront"],
    ["mechanic", "mechanics portal"],
    ["customer", "account"],
    ["admin", "admin"],
  ] as const) {
    test(`${title}: every box is rounded`, async ({ page }, testInfo) => {
      test.skip(missingCredentials(role) !== null, missingCredentials(role) ?? "");
      const width = String(testInfo.project.use.viewport?.width ?? "");
      expect(await auditRoutes(page, role, width)).toEqual([]);
    });
  }
});

test.describe("no sharp corners on overlays", () => {
  test.setTimeout(5 * 60_000);

  /** Audits the open overlay; `kinds` must have been seen, so the audit cannot pass on nothing. */
  async function snap(page: Page, label: string, kinds: CornerKind[], findings: string[]) {
    await page.waitForTimeout(600);
    const report = await auditCorners(page);
    console.log(cornerLine(label, report));
    for (const kind of kinds) {
      expect.soft(report.checked[kind], `${label}: a ${kind} was audited`).toBeGreaterThan(0);
    }
    findings.push(...describeFindings(label, report));
  }

  test("storefront: search, vehicle picker, filters, cart drawer, menu and contact sheet", async ({
    page,
  }, testInfo) => {
    const width = String(testInfo.project.use.viewport?.width ?? "");
    const mobile = testInfo.project.name.startsWith("mobile");
    const findings: string[] = [];

    await page.goto(CATEGORY_PATH, { waitUntil: "load" });
    await settle(page);
    await engineReady(page);

    await page.getByTestId(TEST_IDS.headerSearchTrigger).first().click();
    const search = page.getByRole("dialog");
    await search.getByRole("combobox").fill("disk");
    await search.getByRole("option").first().waitFor({ timeout: 20_000 });
    await snap(page, `search dialog@${width}`, ["dialog", "menu"], findings);
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    if (mobile) await page.getByTestId(TEST_IDS.bottomBarVehicle).click();
    else await page.getByTestId(TEST_IDS.vehiclePickerTrigger).first().click();
    await page.getByRole("dialog").waitFor({ timeout: 20_000 });
    await snap(page, `vehicle picker@${width}`, ["dialog"], findings);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    if (mobile) {
      await page
        .getByRole("button", { name: /^Filteri/ })
        .first()
        .click();
      await page.getByRole("dialog").waitFor({ timeout: 20_000 });
      await snap(page, `filters sheet@${width}`, ["dialog"], findings);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      await page.getByTestId(TEST_IDS.mobileMenuTrigger).click();
      await page.getByRole("dialog").waitFor({ timeout: 20_000 });
      await snap(page, `mobile menu@${width}`, ["dialog"], findings);
      await page.keyboard.press("Escape");
      await expect(page.getByRole("dialog")).toHaveCount(0);

      // With no contact channel in the settings „Kontakt“ is a link to the inquiry, not a sheet.
      const contact = page.getByTestId(TEST_IDS.bottomBar).getByRole("button", { name: /Kontakt/ });
      if ((await contact.count()) > 0) {
        await contact.click();
        await page.getByRole("dialog").waitFor({ timeout: 20_000 });
        await snap(page, `contact sheet@${width}`, ["dialog"], findings);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("dialog")).toHaveCount(0);
      } else {
        console.log(`corners contact sheet@${width}: no contact channel set — a link, no sheet`);
      }
    }

    await page.goto(PRODUCT_PATH, { waitUntil: "load" });
    await settle(page);
    await page.locator("#buy-box").getByTestId(TEST_IDS.productAddToCart).click();
    await page.getByText("Dodato").first().waitFor({ timeout: 30_000 });
    await page.getByTestId(TEST_IDS.cartButton).first().click();
    await page.getByRole("dialog").waitFor({ timeout: 20_000 });
    await snap(page, `cart drawer@${width}`, ["dialog", "button"], findings);
    await page.keyboard.press("Escape");

    expect(findings).toEqual([]);
  });

  test("components: dialog, sheets, menus, tooltip and every toast variant", async ({
    page,
  }, testInfo) => {
    const width = String(testInfo.project.use.viewport?.width ?? "");
    const findings: string[] = [];
    await page.goto("/styleguide", { waitUntil: "load" });
    await settle(page);
    await engineReady(page);
    await scrollEndToEnd(page);

    await page
      .getByRole("figure", { name: /Dialog · alertdialog/ })
      .getByRole("button", { name: "Otkaži porudžbinu" })
      .click();
    await page.getByRole("alertdialog").waitFor({ timeout: 10_000 });
    await snap(page, `alert dialog@${width}`, ["dialog", "button"], findings);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("alertdialog")).toHaveCount(0);

    await page.getByRole("button", { name: "Otvori filtere" }).click();
    await page.getByRole("dialog").waitFor({ timeout: 10_000 });
    await snap(page, `sheet@${width}`, ["dialog"], findings);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    const menus = page.getByRole("figure", { name: /Tooltip \(400 ms/ });
    await menus.getByRole("button", { name: "Radnje za SK-2026-000187" }).click();
    await page.getByRole("menu").waitFor({ timeout: 10_000 });
    await snap(page, `row menu@${width}`, ["menu"], findings);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);

    await menus.getByRole("button", { name: "Kolone" }).click();
    await page.getByRole("menu").waitFor({ timeout: 10_000 });
    await snap(page, `checkbox menu@${width}`, ["menu"], findings);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("menu")).toHaveCount(0);

    const help = menus.getByRole("button", { name: "Šta znači Original VAG?" });
    await help.hover();
    await help.focus();
    await page.getByRole("tooltip").waitFor({ timeout: 10_000 });
    await snap(page, `tooltip@${width}`, ["tooltip"], findings);
    await page.keyboard.press("Escape");

    // Three at a time (the viewport shows at most three): success, info, warning — then error
    // with an action and the one with a link.
    for (const name of ["Uspeh", "Info", "Upozorenje"]) {
      await page.getByRole("button", { name, exact: true }).click();
    }
    await page.locator("li[data-swipe-direction]").nth(2).waitFor({ timeout: 10_000 });
    await snap(page, `toasts success, info, warning@${width}`, ["toast"], findings);
    for (const name of ["Greška", "Sa linkom"]) {
      await page.getByRole("button", { name, exact: true }).click();
    }
    await page.getByText("Porudžbina nije poslata").first().waitFor({ timeout: 10_000 });
    await snap(page, `toasts error, with a link@${width}`, ["toast"], findings);

    expect(findings).toEqual([]);
  });

  test("admin: command palette, notifications and a row menu", async ({ page }, testInfo) => {
    test.skip(missingCredentials("admin") !== null, missingCredentials("admin") ?? "");
    const width = String(testInfo.project.use.viewport?.width ?? "");
    const findings: string[] = [];
    await signInAs(page, "admin");
    await settle(page);

    await page.keyboard.press("Control+k");
    await page.getByRole("combobox", { name: /Pretraga/ }).waitFor({ timeout: 20_000 });
    await snap(page, `admin palette@${width}`, ["dialog"], findings);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.getByTestId(TEST_IDS.adminNotificationBell).click();
    await page.getByRole("dialog").waitFor({ timeout: 20_000 });
    await snap(page, `admin notifications@${width}`, ["dialog"], findings);
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);

    await page.goto("/admin/porudzbine", { waitUntil: "load" });
    await settle(page);
    const trigger = page.locator('main button[aria-haspopup="menu"]').first();
    await trigger.waitFor({ timeout: 30_000 });
    await trigger.click();
    await page.getByRole("menu").waitFor({ timeout: 10_000 });
    await snap(page, `admin row menu@${width}`, ["menu"], findings);
    await page.keyboard.press("Escape");

    expect(findings).toEqual([]);
  });
});
