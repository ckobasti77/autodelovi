/**
 * Step 18 — notifications, e-mails and automations (docs/ROADMAP.md step 18 acceptance), on
 * the production build at desktop width:
 * - a guest order placed in the storefront → the e-mail log has the customer and the staff
 *   message (log mode) and the owner's bell shows the new order;
 * - a status change in the admin → the customer e-mail for it is logged;
 * - the template gallery previews, sends a test message and passes axe; the four key e-mails
 *   are screenshotted at desktop and phone width (docs/qa/screens/step-18/);
 * - the unsubscribe page handles an invalid link.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

import { TEST_IDS } from "../../constants/testIds";

const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;

test.skip(!email || !password, "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set");
test.skip(({ viewport }) => (viewport?.width ?? 0) < 1024, "admin runs at desktop widths");
test.describe.configure({ mode: "serial" });
test.use({
  userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 SklopE2E/${Date.now()}`,
});

const SHOTS = path.resolve("docs/qa/screens/step-18");

function convexRun<T>(fn: string, args: Record<string, unknown> = {}): T {
  const out = execFileSync(
    process.execPath,
    [path.resolve("node_modules/convex/bin/main.js"), "run", `testing:${fn}`, JSON.stringify(args)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
  );
  const start = out.search(/[[{]|^-?\d|^null/m);
  return JSON.parse(out.slice(start)) as T;
}

type Mail = { templateKey: string; to: string[]; mode: string; status: string; subject: string };

async function waitForMail(number: string, predicate: (m: Mail[]) => boolean): Promise<Mail[]> {
  let mails: Mail[] = [];
  for (let i = 0; i < 20; i++) {
    mails = convexRun<Mail[]>("emailProbe", { number });
    if (predicate(mails)) return mails;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return mails;
}

// Playwright's trace snapshotter tries to script into the sandboxed e-mail preview frames
// (srcdoc, no allow-scripts); Chrome logs that as an error. Not an app error — with
// `--trace=off` the message never appears.
const TRACE_SANDBOX_NOISE = /^Blocked script execution in 'about:srcdoc'/;

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && !TRACE_SANDBOX_NOISE.test(m.text())) errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

async function seriousAxe(page: Page): Promise<string[]> {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"])
    .exclude("iframe")
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

async function signIn(page: Page, next = "/admin") {
  await page.goto(`/prijava?next=${encodeURIComponent(next)}`);
  await page.getByTestId(TEST_IDS.authEmail).fill(email!);
  await page.getByTestId(TEST_IDS.authPassword).fill(password!);
  await page.getByTestId(TEST_IDS.authSubmit).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, "\\/")}$`), { timeout: 60_000 });
}

let orderNumber = "";
const customerEmail = `e2e-notify-${Date.now()}@primer.rs`;

test("a storefront order logs the customer and staff e-mails and rings the bell", async ({
  page,
}) => {
  const errors = collectErrors(page);
  const samples = convexRun<{ inStock: { slug: string } | null }>("samples");
  test.skip(!samples.inStock, "no in-stock sample in the seed");

  await page.goto(`/deo/${samples.inStock!.slug}`);
  const add = page.locator("#buy-box").getByTestId(TEST_IDS.productAddToCart);
  await add.click();
  await expect(add).toContainText("Dodato", { timeout: 20_000 });
  await page.goto("/porudzbina");
  await expect(page.getByTestId(TEST_IDS.checkoutStep("contact"))).toBeVisible({ timeout: 20_000 });
  await page.getByLabel("Ime", { exact: true }).fill("Jelena");
  await page.getByLabel("Prezime").fill("Obradović");
  await page.getByLabel("Telefon", { exact: true }).fill("064 222 3344");
  await page.getByLabel("E-pošta").fill(customerEmail);
  await page.getByTestId("checkout-next").click();
  await expect(page.getByTestId(TEST_IDS.checkoutStep("delivery"))).toBeVisible();
  await page.getByRole("radio", { name: /Lično preuzimanje/ }).click();
  await page.getByTestId("checkout-next").click();
  await expect(page.getByTestId(TEST_IDS.checkoutStep("payment"))).toBeVisible();
  await page.getByRole("radio", { name: /Gotovinom pri preuzimanju/ }).click();
  await page.getByTestId("checkout-next").click();
  await expect(page.getByTestId(TEST_IDS.checkoutStep("review"))).toBeVisible();
  await page.getByRole("checkbox", { name: /Prihvatam uslove kupovine/ }).click();
  await page.waitForTimeout(3200);
  await page.getByTestId(TEST_IDS.checkoutSubmit).click();
  await expect(page).toHaveURL(/\/porudzbina\/hvala\//, { timeout: 30_000 });
  orderNumber = (await page.getByTestId(TEST_IDS.orderNumber).first().textContent())?.trim() ?? "";
  expect(orderNumber).toMatch(/^SK-\d{4}-\d{6}$/);
  // Customer notice on the status page (log mode: no claim that an e-mail went out).
  await expect(page.getByTestId("order-notices")).toContainText("Svaku promenu vidite");

  const mails = await waitForMail(
    orderNumber,
    (m) =>
      m.some((x) => x.templateKey === "order_received") &&
      m.some((x) => x.templateKey === "staff_order_new"),
  );
  const customer = mails.find((m) => m.templateKey === "order_received");
  expect(customer?.to).toEqual([customerEmail]);
  expect(customer?.mode).toBe("log");
  expect(customer?.subject).toBe(`Porudžbina ${orderNumber} je primljena`);
  const staff = mails.filter((m) => m.templateKey === "staff_order_new").flatMap((m) => m.to);
  expect(staff).toContain(email!.toLowerCase());

  // Admin: the outbox lists both, the bell shows the order.
  await signIn(page);
  await page.goto("/admin/mejlovi");
  await expect(page.getByTestId("email-delivery-banner")).toContainText("Samo zapis");
  await expect(page.getByText(`Porudžbina ${orderNumber} je primljena`)).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(new RegExp(`Nova porudžbina ${orderNumber}`)).first()).toBeVisible();
  expect(await seriousAxe(page)).toEqual([]);

  const bell = page.getByTestId(TEST_IDS.adminNotificationBell);
  await expect(bell).toHaveAttribute("aria-label", /nepročitano/);
  await bell.click();
  const popover = page.getByRole("dialog");
  await expect(popover.getByText(`Nova porudžbina ${orderNumber}`)).toBeVisible({
    timeout: 20_000,
  });
  await page.keyboard.press("Escape");

  // Open the logged customer message.
  await page.getByText(`Porudžbina ${orderNumber} je primljena`).click();
  const sheet = page.getByRole("dialog", { name: "Poruka" });
  await expect(sheet.getByText(customerEmail)).toBeVisible();
  // Sandboxed frames: assert on the document itself (Playwright cannot script into them).
  await expect(sheet.locator("iframe")).toHaveAttribute("srcdoc", /Porudžbina je primljena\./);
  await page.keyboard.press("Escape");
  expect(errors).toEqual([]);
});

test("a status change logs the customer e-mail", async ({ page }) => {
  test.skip(!orderNumber, "needs the order from the previous test");
  const errors = collectErrors(page);
  await signIn(page);
  await page.goto(`/admin/porudzbine/${orderNumber}`);
  await page.getByTestId(TEST_IDS.adminOrderTransition("potvrdjena")).click();
  await page.getByTestId("admin-order-transition-confirm").click();
  await expect(page.getByText("Potvrđena", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
  const mails = await waitForMail(orderNumber, (m) =>
    m.some((x) => x.templateKey === "order_confirmed"),
  );
  const confirmed = mails.find((m) => m.templateKey === "order_confirmed");
  expect(confirmed?.to).toEqual([customerEmail]);
  expect(confirmed?.subject).toBe(`Porudžbina ${orderNumber} je potvrđena`);
  // The order detail lists its e-mails too.
  await expect(page.getByText(`Porudžbina ${orderNumber} je potvrđena`).first()).toBeVisible({
    timeout: 20_000,
  });
  // Clean up: cancel the e-2-e order so it does not wait in the queue.
  await page.getByRole("button", { name: "Promeni status" }).click();
  await page.getByRole("menuitem", { name: "Otkaži porudžbinu" }).click();
  await page.getByLabel("Razlog otkazivanja").fill("E2E test obaveštenja");
  await page.getByTestId("admin-order-transition-confirm").click();
  await expect(page.getByText("Otkazana", { exact: true }).first()).toBeVisible({
    timeout: 20_000,
  });
  expect(errors).toEqual([]);
});

test("template gallery: previews, a test send and the four key e-mails", async ({ page }) => {
  const errors = collectErrors(page);
  mkdirSync(SHOTS, { recursive: true });
  await signIn(page);
  await page.goto("/admin/mejlovi/sabloni?sablon=order_confirmed");
  const preview = page.getByTestId("template-preview");
  await expect(
    preview.getByRole("heading", { name: "Porudžbina potvrđena (predračun)" }),
  ).toBeVisible({
    timeout: 20_000,
  });
  await expect(preview.locator("iframe")).toHaveAttribute("srcdoc", /Podaci za uplatu/);
  expect(await seriousAxe(page)).toEqual([]);

  await preview.getByRole("button", { name: "Pošalji probnu poruku" }).click();
  await expect(page.getByText(/Probna poruka je zabeležena/).first()).toBeVisible({
    timeout: 20_000,
  });
  await page.goto("/admin/mejlovi?sablon=order_confirmed");
  await expect(
    page.getByText(/^\[PROBA\] Porudžbina SK-2026-000187 je potvrđena/).first(),
  ).toBeVisible({
    timeout: 20_000,
  });

  for (const key of ["order_received", "order_confirmed", "staff_order_new", "back_in_stock"]) {
    for (const [view, suffix] of [
      ["", "desktop"],
      ["&prikaz=telefon", "mobile"],
    ] as const) {
      await page.goto(`/admin/mejlovi/sabloni?sablon=${key}${view}`);
      const frame = page.getByTestId("template-preview").locator("iframe");
      await expect(frame).toBeVisible({ timeout: 20_000 });
      await page.waitForTimeout(400);
      await frame.screenshot({ path: path.join(SHOTS, `email-${key}-${suffix}.png`) });
    }
  }
  await page.goto("/admin/mejlovi/sabloni?sablon=order_confirmed");
  await page.screenshot({
    path: path.join(SHOTS, "admin-template-gallery-1440.png"),
    fullPage: false,
  });
  await page.goto("/admin/mejlovi");
  await page.screenshot({ path: path.join(SHOTS, "admin-outbox-1440.png"), fullPage: false });
  expect(errors).toEqual([]);
});

test("the unsubscribe page rejects an unknown link", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/obavestenja/odjava/nepostojeci-token-aaaaaaaaaaaaaaaaaaaaaaaa");
  await expect(page.getByRole("heading", { level: 1, name: "Odjava obaveštenja" })).toBeVisible();
  await page.getByTestId("unsubscribe-confirm").click();
  await expect(page.getByText("Link nije ispravan ili je već iskorišćen.")).toBeVisible({
    timeout: 20_000,
  });
  expect(errors).toEqual([]);
});
