/**
 * Step 10 — the 3D hero (docs/3D-CONTRACT.md §F7–F8), at 1440 and 390:
 * - the SSR poster is the first paint; the canvas mounts only after intent and crossfades in;
 * - the accessible parts list and the test hook both open the part panel with Convex products;
 * - `?deo=` deep links open the right panel, unknown slugs are ignored;
 * - reduced motion (no track, cuts), the low tier (posters only) and WebGL context loss;
 * - no console errors, visible focus, axe clean with the panel open.
 *
 * Needs a build with test hooks: NEXT_PUBLIC_TEST_HOOKS=1 (set by playwright.config.ts).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { TEST_IDS } from "@/constants/testIds";
// Brings the `window.__sklop3d` declaration (type only; nothing is imported at runtime).
import type {} from "@/components/three/testHooks";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/** First intent (scroll past 40 px) starts the 3D; wait until the first frame is on screen. */
async function startAndWaitFor3d(page: Page) {
  await page.waitForFunction(() => Boolean(window.__sklop3d));
  await page.evaluate(() => window.scrollTo(0, 80));
  await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
}

async function state(page: Page) {
  return page.evaluate(() => window.__sklop3d!.getState());
}

test.describe("3D hero", () => {
  test("poster first, live 3D after intent, crossfade, no console errors", async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/");
    const poster = page.getByTestId("hero-poster-image").locator("img").first();
    await expect(poster).toHaveAttribute("fetchpriority", "high");
    await expect(poster).toHaveJSProperty("complete", true);
    // Nothing 3D before intent: no canvas element, no model request.
    await expect(page.getByTestId(TEST_IDS.heroCanvas).locator("canvas")).toHaveCount(0);
    expect((await state(page)).status).toBe("idle");

    await startAndWaitFor3d(page);
    await expect(page.getByTestId(TEST_IDS.heroCanvas).locator("canvas")).toHaveCount(1);
    await expect(page.getByTestId(TEST_IDS.heroCanvas)).toHaveCSS("opacity", "1", { timeout: 5_000 });
    await expect(page.getByTestId(TEST_IDS.heroPoster)).toHaveCSS("opacity", "0");
    const s = await state(page);
    expect(["high", "mid"]).toContain(s.tier);
    expect(s.tier).toBe(testInfo.project.name.startsWith("mobile") ? "mid" : "high");

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("hero-assembled.png") });
    expect(errors).toEqual([]);
  });

  test("the parts list selects a category and opens the panel with products", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await page.getByTestId(TEST_IDS.partsListTrigger).click();
    const dialog = page.getByRole("dialog", { name: "Lista delova po sistemima" });
    await expect(dialog).toBeVisible();
    await dialog.getByRole("button", { name: /^Kočioni diskovi/ }).click();
    await expect(dialog).toBeHidden();

    const panel = page.getByTestId(TEST_IDS.partPanel);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Kočioni diskovi" })).toBeVisible();
    await expect(panel.getByTestId(TEST_IDS.partPanelProduct).first()).toBeVisible({ timeout: 20_000 });
    expect(await panel.getByTestId(TEST_IDS.partPanelProduct).count()).toBeGreaterThan(0);
    await expect(panel).toContainText("RSD");
    await expect(page).toHaveURL(/[?&]deo=kocioni-diskovi/);
    expect((await state(page)).selected).toBe("kocioni-diskovi");

    // Esc closes, the URL forgets the part and focus returns to the trigger.
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(page).not.toHaveURL(/deo=/);
    await expect(page.getByTestId(TEST_IDS.partsListTrigger)).toBeFocused();
    expect(errors).toEqual([]);
  });

  test("the test hook explodes the car and selects a part", async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await startAndWaitFor3d(page);

    await page.evaluate(() => window.__sklop3d!.explode(1));
    await expect.poll(async () => (await state(page)).progress).toBeGreaterThan(0.99);
    expect((await state(page)).stage).toBe(7);
    await page.waitForTimeout(600);
    await page.screenshot({ path: testInfo.outputPath("hero-exploded.png") });

    expect(await page.evaluate(() => window.__sklop3d!.selectPart("turbina"))).toBe(true);
    const panel = page.getByTestId(TEST_IDS.partPanel);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Turbina (turbopunjač)" })).toBeVisible();
    await expect(panel.getByTestId(TEST_IDS.partPanelProduct).first()).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/[?&]deo=turbina/);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: testInfo.outputPath("hero-selected.png") });

    // An unknown slug is refused.
    expect(await page.evaluate(() => window.__sklop3d!.selectPart("ne-postoji"))).toBe(false);
    expect(errors).toEqual([]);
  });

  test("a deep link opens the right panel", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/?deo=akumulator");
    const panel = page.getByTestId(TEST_IDS.partPanel);
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByRole("heading", { name: "Akumulator" })).toBeVisible();
    await expect(panel.getByTestId(TEST_IDS.partPanelProduct).first()).toBeVisible({ timeout: 20_000 });
    const s = await state(page);
    expect(s.selected).toBe("akumulator");
    // Explodes to the end of the battery's stage (4).
    await expect.poll(async () => (await state(page)).stage).toBeGreaterThanOrEqual(4);
    expect(errors).toEqual([]);
  });

  test("an unknown deep link is ignored", async ({ page }) => {
    await page.goto("/?deo=nepostojeci-deo");
    await page.waitForTimeout(1000);
    await expect(page.getByTestId(TEST_IDS.partPanel)).toHaveCount(0);
    expect((await state(page)).selected).toBeNull();
  });

  test("the panel is accessible (axe) and every hero control shows focus", async ({ page }) => {
    await page.goto("/?deo=kocione-plocice");
    await expect(page.getByTestId(TEST_IDS.partPanelProduct).first()).toBeVisible({ timeout: 20_000 });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude("nextjs-portal")
      .analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
    ).toEqual([]);

    await page.keyboard.press("Escape");
    // Keyboard only: Tab through the hero until the explode toggle, checking every stop.
    const toggle = page.getByTestId(TEST_IDS.explodeToggle);
    const unfocusedRing: string[] = [];
    for (let i = 0; i < 80; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body || el.tagName === "NEXTJS-PORTAL") return null;
        const s = getComputedStyle(el);
        return {
          ring: s.outlineStyle !== "none" && parseFloat(s.outlineWidth) >= 2,
          label: el.getAttribute("aria-label") ?? el.textContent?.trim().slice(0, 40) ?? el.tagName,
          toggle: el.dataset.testid === "explode-toggle",
        };
      });
      if (!info) continue;
      if (!info.ring) unfocusedRing.push(info.label);
      if (info.toggle) break;
    }
    await expect(toggle).toBeFocused();
    expect(unfocusedRing).toEqual([]);
  });
});

test.describe("3D hero — fallbacks", () => {
  test("reduced motion: no scroll track, „Rasklopi“ cuts to the exploded state", async ({ browser }, testInfo) => {
    const mobile = testInfo.project.name.startsWith("mobile");
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      isMobile: mobile,
      hasTouch: mobile,
    });
    const page = await context.newPage();
    const errors = collectErrors(page);
    await page.goto("/");
    const track = page.getByTestId("hero-track");
    const heights = await track.evaluate((el) => ({
      track: el.getBoundingClientRect().height,
      frame: (el.firstElementChild as HTMLElement).getBoundingClientRect().height,
    }));
    expect(Math.abs(heights.track - heights.frame)).toBeLessThan(2);

    const toggle = page.getByTestId(TEST_IDS.explodeToggle);
    await expect(toggle).toHaveText(/Rasklopi/);
    await toggle.click();
    await expect.poll(async () => (await state(page)).progress).toBe(1);
    await expect(toggle).toHaveText(/Sklopi/);
    await toggle.click();
    await expect.poll(async () => (await state(page)).progress).toBe(0);
    expect(errors).toEqual([]);
    await context.close();
  });

  test("low tier: posters only, the exploded poster follows the explode", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/?3d=low");
    await page.waitForFunction(() => window.__sklop3d?.tier === "low");
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(500);
    await expect(page.getByTestId(TEST_IDS.heroCanvas).locator("canvas")).toHaveCount(0);
    await page.evaluate(() => window.__sklop3d!.explode(1));
    const exploded = page.getByTestId(TEST_IDS.heroPoster).locator("picture").nth(1);
    await expect.poll(async () =>
      Number(await exploded.evaluate((el) => getComputedStyle(el.parentElement!).opacity)),
    ).toBeGreaterThan(0.95);
    // The panel still works without 3D.
    await page.evaluate(() => window.__sklop3d!.selectPart("farovi"));
    await expect(page.getByTestId(TEST_IDS.partPanel)).toBeVisible();
    expect(errors).toEqual([]);
  });

  test("WebGL context loss hands the stage back to the posters", async ({ page }) => {
    await page.goto("/");
    await startAndWaitFor3d(page);
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="hero-canvas"] canvas');
      const gl = canvas?.getContext("webgl2");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    });
    await expect.poll(async () => (await state(page)).status).toBe("lost");
    await expect(page.getByTestId(TEST_IDS.heroPoster)).toHaveCSS("opacity", "1", { timeout: 5_000 });
  });
});
