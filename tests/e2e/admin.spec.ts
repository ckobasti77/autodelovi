/**
 * Step 15 — admin panel (docs/ROADMAP.md step 15 acceptance), desktop widths only:
 * owner login → create a product, upload an image, edit it → order nova → potvrđena →
 * poslata with a tracking number → answer an inquiry with a quote → approve a mechanic with
 * a tier → save settings; plus the command palette, the notification bell and axe on the
 * main screens. Test documents come from internal helpers (`convex/testing.ts`) that use the
 * same library code as the storefront; state is verified with internal probes.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { TEST_IDS } from "../../constants/testIds";
import { mbCheckDigit, pibCheckDigit } from "../../lib/domain/identifiers";

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

test.skip(!email || !password, "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set");
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "admin runs at desktop widths");
test.describe.configure({ mode: "serial" });
test.afterAll(() => {
  convexRun<number>("deactivateE2EProducts");
});

function convexRun<T>(fn: string, args: Record<string, unknown> = {}): T {
  const out = execFileSync(
    process.execPath,
    [path.resolve("node_modules/convex/bin/main.js"), "run", `testing:${fn}`, JSON.stringify(args)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
  );
  // The CLI prints the JSON value last: an object, array, number or null.
  const start = out.search(/[[{]|^-?\d|^null/m);
  return JSON.parse(out.slice(start)) as T;
}

const stamp = String(Date.now()).slice(-7);

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function seriousAxe(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .analyze();
  return result.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map(
      (v) =>
        `${v.id}: ${v.nodes
          .map((n) => n.target.join(" "))
          .slice(0, 3)
          .join(", ")}`,
    );
}

async function signIn(page: Page) {
  await page.goto(`/prijava?next=${encodeURIComponent("/admin")}`);
  await page.getByTestId(TEST_IDS.authEmail).fill(email!);
  await page.getByTestId(TEST_IDS.authPassword).fill(password!);
  await page.getByTestId(TEST_IDS.authSubmit).click();
  await expect(page).toHaveURL(/\/admin$/, { timeout: 60_000 });
  await expect(page.getByRole("heading", { level: 1, name: "Pregled" })).toBeVisible({
    timeout: 30_000,
  });
}

test("dashboard, palette, bell and axe", async ({ page }) => {
  const errors = collectErrors(page);
  await signIn(page);
  await expect(page.getByText("Porudžbine danas")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId(TEST_IDS.adminNotificationBell)).toBeVisible();
  expect(await seriousAxe(page)).toEqual([]);

  const { number } = convexRun<{ number: string }>("createTestOrder", { tag: `p${stamp}` });
  await page.keyboard.press("Control+k");
  const palette = page.getByRole("combobox", { name: /Pretraga/ });
  await expect(palette).toBeFocused();
  await palette.fill(number);
  await expect(page.getByRole("option", { name: new RegExp(number) }).first()).toBeVisible({
    timeout: 20_000,
  });
  await palette.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/admin/porudzbine/${number}`), { timeout: 20_000 });
  await expect(page.getByRole("heading", { level: 1 })).toContainText(number.slice(-6));

  await page.getByTestId(TEST_IDS.adminNotificationBell).click();
  await expect(page.getByRole("dialog").getByText("Obaveštenja", { exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("create a product with an image, then edit it", async ({ page }) => {
  const errors = collectErrors(page);
  await signIn(page);
  const name = `Kočioni disk E2E ${stamp}`;
  await page.goto("/admin/proizvodi/novi");
  await page.getByTestId("admin-product-name").fill(name);
  await page.getByTestId("admin-product-sku").fill(`E2E-${stamp}`);
  await page
    .getByTestId("admin-product-category")
    .selectOption({ label: "Kočnice › Kočioni diskovi" });
  await page.getByTestId("admin-product-manufacturer").selectOption({ label: "ATE" });
  await page.getByTestId("admin-product-price").fill("12990");
  // Test products stay off the storefront.
  await page.getByRole("switch", { name: /Aktivan/ }).click();
  await page.getByRole("button", { name: "Sačuvaj artikal" }).click();
  await expect(page).toHaveURL(/\/admin\/proizvodi\/[a-z0-9]{20,}$/, { timeout: 30_000 });
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible({ timeout: 20_000 });

  await page
    .getByTestId("admin-product-image-input")
    .setInputFiles(path.resolve("tests/fixtures/part-photo.jpg"));
  const images = page.getByRole("list", { name: "Slike artikla" });
  await expect(images.getByRole("img", { name })).toBeVisible({ timeout: 30_000 });
  await expect(images.getByText("Glavna")).toBeVisible();

  await page.getByTestId("admin-product-price").fill("13490");
  await page.getByRole("button", { name: "Sačuvaj", exact: true }).click();
  await expect(page.getByText("Sačuvano.").first()).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await expect(page.getByTestId("admin-product-price")).toHaveValue("13490", { timeout: 20_000 });
  expect(await seriousAxe(page)).toEqual([]);
  expect(errors).toEqual([]);
});

test("order: nova → potvrđena → poslata with a tracking number", async ({ page }) => {
  const errors = collectErrors(page);
  await signIn(page);
  const { number } = convexRun<{ number: string }>("createTestOrder", { tag: `o${stamp}` });
  await page.goto("/admin/porudzbine?status=nova");
  await expect(
    page.getByTestId(TEST_IDS.adminOrderRow).filter({ hasText: number.slice(-6) }),
  ).toBeVisible({ timeout: 20_000 });
  expect(await seriousAxe(page)).toEqual([]);
  await page.goto(`/admin/porudzbine/${number}`);

  await page.getByTestId(TEST_IDS.adminOrderTransition("potvrdjena")).click();
  await page.getByTestId("admin-order-transition-confirm").click();
  await expect(page.getByText("Potvrđena", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });

  await page.getByTestId(TEST_IDS.adminOrderTransition("poslata")).click();
  await page.getByTestId("admin-order-tracking-input").fill(`DE${stamp}RS`);
  await page.getByTestId("admin-order-transition-confirm").click();
  await expect(page.getByText("Poslata", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(`DE${stamp}RS`).first()).toBeVisible();

  const probe = convexRun<{ status: string; eventTypes: string[] }>("orderProbe", { number });
  expect(probe.status).toBe("poslata");
  expect(probe.eventTypes.filter((t) => t === "order.status_changed")).toHaveLength(2);
  expect(errors).toEqual([]);
});

test("inquiry: answer with a quote", async ({ page }) => {
  const errors = collectErrors(page);
  await signIn(page);
  const { number } = convexRun<{ number: string }>("createTestInquiry", { tag: stamp });
  await page.goto(`/admin/upiti/${number}`);
  await page.getByTestId("admin-quote-compose").click();
  const composer = page.getByTestId("admin-quote-composer");
  await composer.getByRole("button", { name: "Slobodna stavka" }).click();
  await composer.getByLabel("Naziv", { exact: true }).fill("Set kvačila LuK 2.0 TDI");
  await composer.getByLabel("Cena sa PDV").fill("24990");
  await composer.getByLabel("Rok (dana)").fill("2");
  await composer.getByLabel("Dostupnost").selectOption("on_order");
  await page.getByTestId("admin-quote-send").click();
  await page.getByTestId("admin-quote-send-confirm").click();
  await expect(page.getByText(/Ponuda je poslata/).first()).toBeVisible({ timeout: 20_000 });
  const probe = convexRun<{ inquiryStatus: string; quoteStatus: string; quoteTotalPara: number }>(
    "adminProbe",
    {
      inquiryNumber: number,
    },
  );
  expect(probe).toMatchObject({
    inquiryStatus: "ponuda_poslata",
    quoteStatus: "sent",
    quoteTotalPara: 2_499_000,
  });
  expect(errors).toEqual([]);
});

test("approve a mechanic with a tier", async ({ page }) => {
  const errors = collectErrors(page);
  await signIn(page);
  const pib8 = `2${stamp}`;
  const mb7 = `7${stamp.slice(-6)}`;
  const { profileId, companyName } = convexRun<{ profileId: string; companyName: string }>(
    "createPendingMechanic",
    {
      tag: stamp,
      pib: `${pib8}${pibCheckDigit(pib8)}`,
      mb: `${mb7}${mbCheckDigit(mb7)}`,
    },
  );
  await page.goto("/admin/majstori");
  await expect(page.getByRole("row").filter({ hasText: companyName })).toBeVisible({
    timeout: 20_000,
  });
  await page.goto(`/admin/majstori/${profileId}`);
  await expect(page.getByRole("heading", { level: 1, name: companyName })).toBeVisible({
    timeout: 20_000,
  });
  await page.getByLabel("Nivo rabata").selectOption({ label: "Partner · 20 %" });
  await page.getByTestId(TEST_IDS.adminMechanicApprove).click();
  await expect(page.getByText("Odobren", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
  const probe = convexRun<{ status: string; tierName: string }>("mechanicProfileProbe", {
    profileId,
  });
  expect(probe).toEqual({ status: "approved", tierName: "Partner" });
  expect(errors).toEqual([]);
});

test("save settings (company) and restore", async ({ page }) => {
  const errors = collectErrors(page);
  await signIn(page);
  const before = convexRun<{ legalName: string }>("adminProbe", {}).legalName;
  await page.goto("/admin/podesavanja?tab=firma");
  const input = page.getByTestId("admin-settings-legal-name");
  await expect(input).toBeVisible({ timeout: 20_000 });
  await input.fill(`Proba E2E ${stamp} d.o.o.`);
  await page.getByRole("button", { name: "Sačuvaj", exact: true }).click();
  await expect(page.getByText("Sačuvano.").first()).toBeVisible({ timeout: 20_000 });
  expect(convexRun<{ legalName: string }>("adminProbe", {}).legalName).toBe(
    `Proba E2E ${stamp} d.o.o.`,
  );
  expect(await seriousAxe(page)).toEqual([]);
  await input.fill(before);
  await page.getByRole("button", { name: "Sačuvaj", exact: true }).click();
  await expect
    .poll(() => convexRun<{ legalName: string }>("adminProbe", {}).legalName, { timeout: 20_000 })
    .toBe(before);
  expect(errors).toEqual([]);
});
