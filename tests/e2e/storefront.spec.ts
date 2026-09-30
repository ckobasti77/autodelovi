/**
 * Step 12 storefront flows (docs/ROADMAP.md step 12/13 acceptance):
 * - OEM search → product → cart → guest order with pouzeće → the order exists in Convex with
 *   status `nova` and an `order.created` domain event;
 * - category filtering by the visitor's vehicle (picker → „Samo za …“);
 * - VIN inquiry with a photo upload;
 * - back-in-stock subscription;
 * - axe (zero serious/critical) on home, category, product, cart, checkout, inquiry;
 * - the text-reveal check on home, category and product.
 *
 * Convex state is read with internal probes (`convex/testing.ts`) through the Convex CLI,
 * so nothing test-only is reachable from the internet.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { execFileSync } from "node:child_process";
import path from "node:path";

import { TEST_IDS } from "../../constants/testIds";

// A unique user agent per run gives fresh per-client rate-limit buckets in Convex.
test.use({
  userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 SklopE2E/${Date.now()}`,
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

type Samples = {
  inStock: { slug: string; name: string; oem: string; stockQty: number } | null;
  outOfStock: { slug: string; name: string } | null;
  vehicleCategory: {
    categorySlug: string;
    brandSlug: string;
    modelSlug: string;
    generationSlug: string;
    fitting: number;
  } | null;
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

async function scrollEndToEnd(page: Page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.6);
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(1800);
}

async function hiddenCopy(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("*")]
      .filter((e) => e.offsetParent && e.textContent?.trim() && getComputedStyle(e).opacity === "0")
      .map((e) => `${e.tagName.toLowerCase()}: ${e.textContent?.trim().slice(0, 60)}`),
  );
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

async function addFirstToCart(page: Page, slug: string) {
  await page.goto(`/deo/${slug}`);
  const add = page.locator("#buy-box").getByTestId(TEST_IDS.productAddToCart);
  await expect(add).toBeVisible();
  await add.click();
  await expect(add).toContainText("Dodato", { timeout: 20_000 });
}

test.describe("storefront", () => {
  test("OEM search → product → cart → guest order with pouzeće lands in Convex", async ({ page }) => {
    test.skip(!samples.inStock, "no in-stock sample in the seed");
    const errors = collectErrors(page);
    const sample = samples.inStock!;

    // Messy input: lowercase, dashes instead of spaces — the search normalises it.
    const messy = sample.oem.toLowerCase().replace(/\s+/g, "-");
    await page.goto("/");
    const search = page.getByTestId(TEST_IDS.heroSearchInput).getByRole("combobox");
    await search.fill(messy);
    await search.press("Enter");
    await expect(page).toHaveURL(/\/pretraga\?q=/);
    await expect(page.getByRole("heading", { name: "Tačno poklapanje" })).toBeVisible();
    const card = page.locator(`[data-product-slug="${sample.slug}"]`).first();
    await expect(card).toBeVisible();
    await card.getByRole("link").first().click();
    await expect(page).toHaveURL(new RegExp(`/deo/${sample.slug}`));
    await expect(page.getByRole("heading", { level: 1 })).toContainText(sample.name.slice(0, 12));

    const add = page.locator("#buy-box").getByTestId(TEST_IDS.productAddToCart);
    await add.click();
    await expect(add).toContainText("Dodato", { timeout: 20_000 });
    await expect(page.getByTestId(TEST_IDS.cartCount)).toHaveText("1", { timeout: 20_000 });

    // The header cart opens the drawer; its primary action leads to the checkout.
    await page.getByTestId(TEST_IDS.cartButton).click();
    const drawer = page.getByTestId("cart-drawer");
    await expect(drawer).toBeVisible({ timeout: 20_000 });
    await expect(drawer).toContainText(sample.name.slice(0, 12));
    await drawer.getByTestId("cart-checkout").click();
    await expect(page).toHaveURL(/\/porudzbina$/);
    await expect(page.getByTestId(TEST_IDS.checkoutStep("contact"))).toBeVisible({ timeout: 20_000 });
    const stamp = Date.now();
    await page.getByLabel("Ime", { exact: true }).fill("Nikola");
    await page.getByLabel("Prezime").fill("Stanković");
    await page.getByLabel("Telefon", { exact: true }).fill("064 123 4567");
    await page.getByLabel("E-pošta").fill(`e2e-${stamp}@primer.rs`);
    await page.getByTestId("checkout-next").click();

    await expect(page.getByTestId(TEST_IDS.checkoutStep("delivery"))).toBeVisible();
    await page.getByRole("radio", { name: /Kurirska služba/ }).click();
    await page.getByLabel("Ulica i broj").fill("Bulevar oslobođenja 12");
    await page.getByLabel("Poštanski broj").fill("21000");
    await page.getByLabel("Mesto").fill("Novi Sad");
    await page.getByTestId("checkout-next").click();

    await expect(page.getByTestId(TEST_IDS.checkoutStep("payment"))).toBeVisible();
    await expect(page.getByRole("radio", { name: /Pouzećem/ })).toBeChecked();
    await page.getByTestId("checkout-next").click();

    await expect(page.getByTestId(TEST_IDS.checkoutStep("review"))).toBeVisible();
    await page.getByRole("checkbox", { name: /Prihvatam uslove kupovine/ }).click();
    await page.waitForTimeout(3200); // server-side timing check (≥ 3 s after the form opened)
    await page.getByTestId(TEST_IDS.checkoutSubmit).click();

    await expect(page).toHaveURL(/\/porudzbina\/hvala\//, { timeout: 30_000 });
    const number = (await page.getByTestId(TEST_IDS.orderNumber).first().textContent())?.trim() ?? "";
    expect(number).toMatch(/^SK-\d{4}-\d{6}$/);
    await expect(page.getByTestId(TEST_IDS.orderTimeline)).toBeVisible();

    const probe = convexRun<{
      status: string;
      paymentMethod: string;
      deliveryMethod: string;
      customerType: string;
      eventTypes: string[];
    } | null>("orderProbe", { number });
    expect(probe).not.toBeNull();
    expect(probe!.status).toBe("nova");
    expect(probe!.paymentMethod).toBe("cod");
    expect(probe!.deliveryMethod).toBe("courier");
    expect(probe!.customerType).toBe("guest");
    expect(probe!.eventTypes).toContain("order.created");

    const tracked = await page.evaluate(() => (window.__skTrack ?? []).map((e) => e.event.name));
    expect(tracked).toContain("purchase");
    expect(errors).toEqual([]);
  });

  test("category filtering by the selected vehicle", async ({ page }, testInfo) => {
    test.skip(!samples.vehicleCategory, "no vehicle/category sample in the seed");
    const errors = collectErrors(page);
    const s = samples.vehicleCategory!;

    await page.goto(`/delovi/${s.categorySlug}`);
    const countText = page.getByRole("status").filter({ hasText: /artik/ }).first();
    await expect(countText).toBeVisible();
    const allCount = Number((await countText.textContent())?.match(/\d+/)?.[0] ?? "0");

    // Pick the vehicle in the shared picker.
    const mobile = testInfo.project.name.startsWith("mobile");
    if (mobile) await page.getByRole("button", { name: /^Filteri/ }).click();
    await page.getByRole("button", { name: "Izaberite vozilo" }).filter({ visible: true }).first().click();
    const picker = page.getByRole("dialog", { name: "Izaberite vozilo" });
    await expect(picker).toBeVisible();
    await picker.getByRole("button", { name: "Volkswagen" }).click();
    await picker.getByRole("button", { name: /^Golf/ }).first().click();
    await picker.getByRole("button", { name: /Golf VII/ }).first().click();
    await picker.getByRole("button", { name: "Ne znam motor" }).click();

    await expect(page).toHaveURL(new RegExp(`generacija=${s.generationSlug}`), { timeout: 20_000 });
    if (mobile) {
      // The filter sheet stays open with the new count; its footer closes it.
      await page.getByRole("button", { name: /^Prikaži \d+ rezultat/ }).click();
      await expect(page.getByRole("dialog", { name: "Filteri" })).toBeHidden();
    }
    const cards = page.getByTestId(TEST_IDS.productCard);
    await expect(cards.first()).toBeVisible();
    const filtered = await cards.count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThanOrEqual(allCount);
    await expect(cards.first()).toContainText("Golf VII");
    // The applied chip removes the vehicle again.
    await page.getByRole("button", { name: /Ukloni filter: Volkswagen Golf VII/ }).click();
    await expect(page).not.toHaveURL(/generacija=/, { timeout: 20_000 });
    expect(errors).toEqual([]);
  });

  test("VIN inquiry with a photo", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/upit");
    await page.getByTestId(TEST_IDS.inquiryVinInput).fill("WVWZZZ1KZ8W123456");
    await expect(page.getByLabel("Marka")).toHaveValue("volkswagen");
    await page.getByLabel("Opis").fill("Turbina za Golf, dizel. Stara duva ulje na izduvnoj strani.");
    await page.getByTestId(TEST_IDS.inquiryPhotoInput).setInputFiles(path.resolve("tests/fixtures/part-photo.jpg"));
    await expect(page.locator('[data-testid="inquiry-photo"][data-status="done"]')).toHaveCount(1, { timeout: 30_000 });
    await page.getByLabel("Ime", { exact: true }).fill("Marko Jovanović");
    await page.getByLabel("Telefon", { exact: true }).fill("065 987 6543");
    await page.getByRole("checkbox", { name: /Slažem se/ }).click();
    await page.waitForTimeout(3200);
    await page.getByTestId(TEST_IDS.inquirySubmit).click();

    await expect(page).toHaveURL(/\/upit\/hvala\//, { timeout: 30_000 });
    const number = (await page.getByTestId("inquiry-number").textContent())?.trim() ?? "";
    expect(number).toMatch(/^UP-\d{4}-\d{6}$/);
    const probe = convexRun<{ status: string; kind: string; vin: string | null; photoCount: number; eventTypes: string[] } | null>(
      "inquiryProbe",
      { number },
    );
    expect(probe).not.toBeNull();
    expect(probe!.status).toBe("nov");
    expect(probe!.kind).toBe("vin");
    expect(probe!.vin).toBe("WVWZZZ1KZ8W123456");
    expect(probe!.photoCount).toBe(1);
    expect(probe!.eventTypes).toContain("inquiry.created");
    expect(errors).toEqual([]);
  });

  test("back-in-stock subscription on an unavailable product", async ({ page }) => {
    test.skip(!samples.outOfStock, "no out-of-stock sample in the seed");
    const errors = collectErrors(page);
    const email = `e2e-bis-${Date.now()}@primer.rs`;
    await page.goto(`/deo/${samples.outOfStock!.slug}`);
    const form = page.getByTestId(TEST_IDS.backInStockForm);
    await expect(form).toBeVisible();
    await form.getByLabel("E-pošta").fill(email);
    await form.getByRole("checkbox").click();
    await form.getByRole("button", { name: "Obavesti me" }).click();
    await expect(page.getByTestId("back-in-stock-done")).toContainText(email);
    const subs = convexRun<{ productSlug: string; status: string }[]>("backInStockProbe", { email });
    expect(subs).toEqual([{ productSlug: samples.outOfStock!.slug, status: "active" }]);
    expect(errors).toEqual([]);
  });
});

test.describe("storefront — accessibility and reveal", () => {
  test("axe: no serious or critical violations on six templates", async ({ page }) => {
    test.skip(!samples.inStock || !samples.vehicleCategory, "seed samples missing");
    const failures: string[] = [];
    const check = async (label: string) => {
      await page.evaluate(() => document.fonts.ready);
      await scrollEndToEnd(page);
      for (const v of await seriousAxe(page)) failures.push(`${label}: ${v}`);
    };
    await page.goto("/");
    await check("home");
    await page.goto(`/delovi/${samples.vehicleCategory!.categorySlug}`);
    await check("category");
    await addFirstToCart(page, samples.inStock!.slug);
    await check("product");
    await page.goto("/korpa");
    await expect(page.getByTestId("cart-line").first()).toBeVisible({ timeout: 20_000 });
    await check("cart");
    await page.goto("/porudzbina");
    await expect(page.getByTestId(TEST_IDS.checkoutStep("contact"))).toBeVisible({ timeout: 20_000 });
    await check("checkout");
    await page.goto("/upit");
    await check("inquiry");
    expect(failures).toEqual([]);
  });

  test("text reveal leaves no copy hidden on home, category and product", async ({ page }) => {
    test.skip(!samples.inStock || !samples.vehicleCategory, "seed samples missing");
    const errors = collectErrors(page);
    for (const url of ["/", `/delovi/${samples.vehicleCategory!.categorySlug}`, `/deo/${samples.inStock!.slug}`]) {
      await page.goto(url);
      await page.evaluate(() => document.fonts.ready);
      await scrollEndToEnd(page);
      expect(await hiddenCopy(page), url).toEqual([]);
      await expect(page.locator('[data-reveal-state="pending"]')).toHaveCount(0);
      await expect(page.locator(".reveal-word")).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
});
