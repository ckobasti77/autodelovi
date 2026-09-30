/**
 * Step 14 — mechanics portal (docs/ROADMAP.md step 14 acceptance):
 * register a workshop → approve through the internal helper → mechanic prices on product,
 * search, category and cart (never in the cached HTML) → quick order with exact / ambiguous
 * / not-found lines → one-click inquiry for the miss → order with deferred payment.
 * Plus: staff approval through `/admin/majstori` (owner from SEED_ADMIN_*), axe on the new
 * templates, the text-reveal check on `/za-majstore`.
 *
 * Convex state goes through internal functions (`convex/testing.ts`) via the Convex CLI.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { TEST_IDS } from "../../constants/testIds";
import { mbCheckDigit, pibCheckDigit } from "../../lib/domain/identifiers";

test.use({
  userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 SklopE2E-M/${Date.now()}`,
});

function convexRun<T>(fn: string, args: Record<string, unknown> = {}): T {
  const out = execFileSync(
    process.execPath,
    [path.resolve("node_modules/convex/bin/main.js"), "run", `testing:${fn}`, JSON.stringify(args)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
  );
  const start = out.search(/[[{]|^null/m);
  return JSON.parse(out.slice(start)) as T;
}

type Samples = { inStock: { slug: string; name: string; oem: string } | null };
type QuickSamples = {
  exact: { code: string; slug: string; name: string } | null;
  ambiguous: { code: string; count: number } | null;
};

let samples: Samples;
let quick: QuickSamples;
test.beforeAll(() => {
  samples = convexRun<Samples>("samples");
  quick = convexRun<QuickSamples>("quickOrderSamples");
});

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  return errors;
}

/** A unique, checksum-valid PIB and MB per run (not real companies). */
function identifiers() {
  const seed = String(Date.now()).slice(-7);
  const pib8 = `1${seed}`;
  const mb7 = `6${seed.slice(-6)}`;
  return { pib: `${pib8}${pibCheckDigit(pib8)}`, mb: `${mb7}${mbCheckDigit(mb7)}` };
}

async function seriousAxe(page: Page): Promise<string[]> {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(400);
  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .exclude("nextjs-portal")
    .analyze();
  return results.violations
    .filter((v) => v.impact === "serious" || v.impact === "critical")
    .map((v) => `${v.id} (${v.impact}): ${v.nodes.slice(0, 3).map((n) => n.target.join(" ")).join(" | ")}`);
}

async function register(page: Page, email: string, company: string) {
  const ids = identifiers();
  await page.goto("/za-majstore/registracija");
  const form = page.getByTestId(TEST_IDS.mechanicRegistrationForm);
  await expect(form).toBeVisible({ timeout: 20_000 });
  await page.getByTestId(TEST_IDS.mechanicRegEmail).fill(email);
  await page.getByTestId(TEST_IDS.mechanicRegPassword).fill("Radionica2026x");
  await page.getByTestId(TEST_IDS.mechanicRegCompany).fill(company);
  await page.getByTestId(TEST_IDS.mechanicRegPib).fill(ids.pib);
  await page.getByTestId(TEST_IDS.mechanicRegMb).fill(ids.mb);
  await page.getByTestId(TEST_IDS.mechanicRegContact).fill("Dragan Jović");
  await page.getByTestId(TEST_IDS.mechanicRegPhone).fill("064 555 1234");
  await page.getByTestId(TEST_IDS.mechanicRegCity).fill("Kragujevac");
  await page.getByTestId(TEST_IDS.mechanicRegAddress).fill("Kralja Petra I 12");
  await page.getByTestId(`${TEST_IDS.mechanicRegService}-mehanika`).click();
  await page.getByTestId(TEST_IDS.mechanicRegTerms).click();
  await page.getByTestId(TEST_IDS.mechanicRegSubmit).click();
  await expect(page).toHaveURL(/\/za-majstore\/hvala/, { timeout: 45_000 });
  return ids;
}

async function anonymousHtml(browser: Browser, url: string, cookiesFrom?: Page): Promise<string> {
  const context = await browser.newContext();
  if (cookiesFrom) await context.addCookies(await cookiesFrom.context().cookies());
  const res = await context.request.get(url);
  const html = await res.text();
  await context.close();
  return html;
}

test.describe("mechanics portal", () => {
  test("register → approve → own prices → quick order → deferred order", async ({ page, browser }) => {
    test.skip(!samples.inStock || !quick.exact, "no in-stock / quick-order samples in the seed");
    test.setTimeout(300_000);
    const errors = collectErrors(page);
    const email = `e2e-majstor-${Date.now()}@primer.rs`;

    // Landing → registration.
    await page.goto("/za-majstore");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Za majstore");
    await expect(page.getByRole("link", { name: "Registrujte servis" }).first()).toBeVisible();
    const ids = await register(page, email, "Auto servis E2E");

    let probe = convexRun<{ status: string; pib: string; eventTypes: string[] } | null>("mechanicProbe", { email });
    expect(probe?.status).toBe("pending");
    expect(probe?.pib).toBe(ids.pib);
    expect(probe?.eventTypes).toContain("mechanic.registered");

    // Pending: status screen, retail prices only.
    await page.goto("/majstor");
    await expect(page.getByTestId(TEST_IDS.mechanicStatus)).toHaveAttribute("data-status", "pending", { timeout: 20_000 });
    await page.goto(`/deo/${samples.inStock!.slug}`);
    await expect(page.locator("#buy-box")).toBeVisible();
    await page.waitForTimeout(1500);
    await expect(page.locator("#buy-box").getByTestId(TEST_IDS.productYourPrice)).toHaveCount(0);

    // Staff approval (internal helper = the same code path as the admin screen).
    convexRun("approveMechanic", { email, tierSlug: "majstor-plus", creditEnabled: true });
    probe = convexRun("mechanicProbe", { email });
    expect(probe?.status).toBe("approved");
    expect(probe?.eventTypes).toContain("mechanic.approved");

    // Product: „Vaša cena“ with the retail price struck through — live, not in the HTML.
    await page.reload();
    const yourPrice = page.locator("#buy-box").getByTestId(TEST_IDS.productYourPrice);
    await expect(yourPrice).toBeVisible({ timeout: 20_000 });
    await expect(yourPrice).toContainText("Vaša cena");
    await expect(yourPrice.locator("s")).toBeVisible();
    for (const html of [
      await anonymousHtml(browser, `/deo/${samples.inStock!.slug}`),
      await anonymousHtml(browser, `/deo/${samples.inStock!.slug}`, page),
    ]) {
      expect(html).not.toContain("Vaša cena");
    }

    // Search results and a category listing.
    await page.goto(`/pretraga?q=${encodeURIComponent(quick.exact!.code)}`);
    const card = page.locator(`[data-product-slug="${quick.exact!.slug}"]`).first();
    await expect(card).toBeVisible({ timeout: 20_000 });
    await expect(card.getByTestId(TEST_IDS.productYourPrice)).toBeVisible({ timeout: 20_000 });

    // Portal overview shows the tier.
    await page.goto("/majstor");
    await expect(page.getByTestId(TEST_IDS.mechanicTierBadge)).toContainText("Majstor Plus", { timeout: 20_000 });

    // Quick order: exact + ambiguous + not found.
    await page.goto("/majstor/brza-porudzbina");
    const lines = [`${quick.exact!.code} 2`, ...(quick.ambiguous ? [`${quick.ambiguous.code} 1`] : []), "ZZ9999999 3"];
    await page.getByTestId(TEST_IDS.mechanicQuickOrderInput).fill(lines.join("\n"));
    await page.getByTestId(TEST_IDS.mechanicQuickOrderCheck).click();
    const rows = page.getByTestId(TEST_IDS.mechanicQuickOrderRow);
    await expect(rows).toHaveCount(lines.length, { timeout: 20_000 });
    await expect(rows.nth(0)).toHaveAttribute("data-status", "exact", { timeout: 20_000 });
    if (quick.ambiguous) {
      await expect(rows.nth(1)).toHaveAttribute("data-status", "ambiguous");
      await rows.nth(1).getByRole("radio").first().check();
    }
    await expect(rows.last()).toHaveAttribute("data-status", "not_found");
    const addAll = page.getByTestId(TEST_IDS.mechanicQuickOrderAddAll);
    await expect(addAll).toBeEnabled();
    await addAll.click();
    await expect(page.getByTestId(TEST_IDS.cartCount).first()).not.toHaveText("0", { timeout: 20_000 });

    // Misses → one inquiry, contact from the profile.
    await page.getByTestId(TEST_IDS.mechanicQuickOrderInquire).click();
    await expect(
      page.getByRole("region", { name: "Brza porudžbina" }).getByRole("status").filter({ hasText: /Upit UP-\d{4}-\d{6} je poslat/ }),
    ).toBeVisible({ timeout: 20_000 });

    // Cart shows the mechanic price.
    await page.goto("/korpa");
    await expect(page.getByText("Vaša cena").first()).toBeVisible({ timeout: 20_000 });

    // Checkout: company + workshop prefilled, deferred payment offered and used.
    await page.goto("/porudzbina");
    await expect(page.getByTestId(TEST_IDS.checkoutStep("contact"))).toBeVisible({ timeout: 20_000 });
    await expect(page.getByLabel("E-pošta")).toHaveValue(email);
    await page.getByTestId("checkout-next").click();
    await expect(page.getByTestId(TEST_IDS.checkoutStep("delivery"))).toBeVisible();
    await expect(page.getByLabel("Ulica i broj")).toHaveValue("Kralja Petra I 12");
    await page.getByLabel("Poštanski broj").fill("34000");
    await page.getByTestId("checkout-next").click();
    await expect(page.getByTestId(TEST_IDS.checkoutStep("payment"))).toBeVisible();
    await page.getByRole("radio", { name: /Odloženo plaćanje/ }).click();
    await page.getByTestId("checkout-next").click();
    await expect(page.getByTestId(TEST_IDS.checkoutStep("review"))).toBeVisible();
    await page.getByRole("checkbox", { name: /Prihvatam uslove kupovine/ }).click();
    await page.waitForTimeout(3200);
    await page.getByTestId(TEST_IDS.checkoutSubmit).click();
    await expect(page).toHaveURL(/\/porudzbina\/hvala\//, { timeout: 30_000 });
    const number = (await page.getByTestId(TEST_IDS.orderNumber).first().textContent())?.trim() ?? "";
    const order = convexRun<{ paymentMethod: string; customerType: string; status: string } | null>("orderProbe", { number });
    expect(order).toMatchObject({ paymentMethod: "deferred", customerType: "mechanic", status: "nova" });

    // History shows the order with its due date.
    await page.goto("/majstor/porudzbine");
    await expect(page.getByText(number)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Odloženo plaćanje do \d{2}\.\d{2}\.\d{4}\./).first()).toBeVisible();

    expect(errors).toEqual([]);
  });

  test("staff approve a registration in /admin/majstori", async ({ page, browser }, testInfo) => {
    const adminEmail = process.env.SEED_ADMIN_EMAIL;
    const adminPassword = process.env.SEED_ADMIN_PASSWORD;
    test.skip(!adminEmail || !adminPassword, "SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set");
    test.skip(testInfo.project.name.startsWith("mobile"), "admin runs at desktop widths");
    test.setTimeout(240_000);
    const email = `e2e-servis-${Date.now()}@primer.rs`;
    const company = `Servis Odobrenje ${Date.now() % 100_000}`;
    await register(page, email, company);

    const staff = await browser.newContext({ viewport: { width: 1440, height: 900 } });
    const admin = await staff.newPage();
    const errors = collectErrors(admin);
    await admin.goto(`/prijava?next=${encodeURIComponent("/admin/majstori")}`);
    await admin.getByTestId(TEST_IDS.authEmail).fill(adminEmail!);
    await admin.getByTestId(TEST_IDS.authPassword).fill(adminPassword!);
    await admin.getByTestId(TEST_IDS.authSubmit).click();
    await expect(admin).toHaveURL(/\/admin\/majstori/, { timeout: 30_000 });
    const row = admin.getByRole("row").filter({ hasText: company });
    await expect(row).toBeVisible({ timeout: 20_000 });
    expect(await seriousAxe(admin)).toEqual([]);
    await row.click();
    await expect(admin.getByRole("heading", { level: 1, name: company })).toBeVisible({ timeout: 20_000 });
    await admin.getByLabel("Nivo rabata").selectOption({ label: "Partner · 20 %" });
    await admin.getByRole("switch", { name: /Odloženo plaćanje/ }).click();
    await admin.getByTestId(TEST_IDS.adminMechanicApprove).click();
    await expect(admin.getByText("Odobren", { exact: true }).first()).toBeVisible({ timeout: 20_000 });
    expect(await seriousAxe(admin)).toEqual([]);
    const probe = convexRun<{ status: string; creditEnabled: boolean } | null>("mechanicProbe", { email });
    expect(probe).toMatchObject({ status: "approved", creditEnabled: true });
    await staff.close();
    expect(errors).toEqual([]);
  });

  test("axe and text reveal on the landing and the registration form", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/za-majstore");
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await page.evaluate(async () => {
      const step = Math.round(window.innerHeight * 0.6);
      for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 110));
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
    });
    await page.waitForTimeout(1800);
    const hidden = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("*")]
        .filter((e) => e.offsetParent && e.textContent?.trim() && getComputedStyle(e).opacity === "0")
        .map((e) => `${e.tagName.toLowerCase()}: ${e.textContent?.trim().slice(0, 60)}`),
    );
    expect(hidden).toEqual([]);
    expect(await page.locator('[data-reveal-state="pending"]').count()).toBe(0);
    expect(await seriousAxe(page)).toEqual([]);

    // The live parser demo reads messy lines.
    const demo = page.getByLabel("Nalepite kako vam je stiglo");
    await demo.fill("1k0-615-301-aa x3");
    await expect(page.getByRole("table").filter({ hasText: "Ovako sistem čita brojeve" })).toContainText("1K0615301AA");

    await page.goto("/za-majstore/registracija");
    await expect(page.getByTestId(TEST_IDS.mechanicRegistrationForm)).toBeVisible();
    // Client-side PIB checksum.
    await page.getByTestId(TEST_IDS.mechanicRegPib).fill("123456789");
    await page.getByTestId(TEST_IDS.mechanicRegMb).click();
    await expect(page.locator("#mr-pib-msg")).toContainText("PIB ima 9 cifara i kontrolni broj ne odgovara");
    // No error summary before the first send attempt.
    await expect(page.getByTestId(TEST_IDS.mechanicRegistrationForm).getByRole("alert")).toHaveCount(0);
    expect(await seriousAxe(page)).toEqual([]);
    expect(errors).toEqual([]);
  });
});
