/**
 * The 3D hero, v2 — „radni sto“ (docs/3d/HERO-V2.md, docs/3D-CONTRACT.md §F6–F9), at 1440 and 390:
 * - the SSR poster is the first paint; the canvas mounts only after intent and crossfades in;
 * - the grid fills page by page (six pages, 44 slots) and the navigator counts with it;
 * - scrolling back takes every part back to the car and leaves nothing behind in the DOM;
 * - the keyboard walks the navigator (one tab stop) and then the page's slots, which are links;
 * - the mirrored lists, the live region and the skip link; axe clean;
 * - the accessible parts list, the test hook and `?deo=` deep links open the part panel;
 * - reduced motion (no track, chips cut between pages of thumbnails), no WebGL (the poster makes
 *   room and the grid shows thumbnails), a software renderer and context loss.
 *
 * Needs a build with test hooks: NEXT_PUBLIC_TEST_HOOKS=1 (set by playwright.config.ts).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

import { TEST_IDS } from "@/constants/testIds";
// Brings the `window.__sklop3d` declaration (type only; nothing is imported at runtime).
import type {} from "@/components/three/testHooks";

/** The six pages as designed (HERO-V2 §4): slots on the page, parts found at its rest. */
const PAGES = [
  { slots: 7, meshes: 7, found: 7, list: "Karoserija", chip: "karoserija" },
  { slots: 9, meshes: 9, found: 16, list: "Elektrika i svetla, Točkovi, Kočnice", chip: "elektrika-i-svetla" },
  { slots: 8, meshes: 8, found: 24, list: "Vešanje i upravljanje, Hlađenje i klima", chip: "vesanje-i-upravljanje" },
  { slots: 6, meshes: 6, found: 30, list: "Motor i usis, 1. deo", chip: "motor-i-usis" },
  { slots: 7, meshes: 7, found: 37, list: "Motor i usis, 2. deo", chip: "motor-i-usis" },
  // Filters and fluids are not in the car: two thumbnail slots among the seven.
  { slots: 7, meshes: 5, found: 44, list: /Transmisija, Izduvni sistem, Servis/, chip: "transmisija" },
] as const;
const TOTAL = 44;

/** Progress of a page's rest point (lib/three/pages.ts: first 0.06, last 0.94, rest at 0.8). */
const rest = (page: number) => 0.06 + (page - 0.2) * (0.88 / 6);

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

/**
 * Headless Chromium renders WebGL through SwiftShader, which the tier probe rightly classifies as
 * low (PERF-23, D243). Tests of the live 3D force the tier this device class gets on real
 * hardware with the `?3d=` test hook: high at 1440, mid on the 390 phone.
 */
function liveTier(testInfo: TestInfo): "high" | "mid" {
  return testInfo.project.name.startsWith("mobile") ? "mid" : "high";
}

/** First intent (scroll past 40 px) starts the 3D; wait until the first frame is on screen. */
async function startAndWaitFor3d(page: Page) {
  await page.waitForFunction(() => Boolean(window.__sklop3d));
  await page.evaluate(() => window.scrollTo(0, 80));
  await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
}

async function state(page: Page) {
  return page.evaluate(() => window.__sklop3d!.getState());
}

/** Real scrolling (scroll events, the scene's catch-up) to a progress of the hero track. */
async function scrollToProgress(page: Page, progress: number, steps = 8) {
  await page.evaluate(
    async ([target, count]) => {
      const track = document.querySelector('[data-testid="hero-track"]');
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const header =
        Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 64;
      const start = rect.top + window.scrollY - header;
      const end = rect.bottom + window.scrollY - window.innerHeight;
      const to = Math.floor(start + target * (end - start));
      const from = window.scrollY;
      for (let i = 1; i <= count; i += 1) {
        window.scrollTo({ top: from + ((to - from) * i) / count, behavior: "instant" });
        await new Promise((resolve) => setTimeout(resolve, 60));
      }
    },
    [progress, steps] as const,
  );
  await expect
    .poll(async () => Math.abs((await state(page)).progress - progress), { timeout: 30_000 })
    .toBeLessThan(0.004);
}

const seatedSlugs = (page: Page) =>
  page
    .locator("[data-page-active] [data-slot][data-seated]")
    .evaluateAll((links) => links.map((link) => link.getAttribute("data-slot")));

/** What the grid may not keep after a reveal: split words, inline styles on the ticks. */
const leftovers = (page: Page) =>
  page.evaluate(() => ({
    words: document.querySelectorAll("[data-hero-grid] .reveal-word").length,
    ticks: Array.from(document.querySelectorAll("[data-hero-grid] [data-tick]")).filter((tick) =>
      tick.getAttribute("style"),
    ).length,
  }));

const focusRing = (page: Page) =>
  page.evaluate(() => {
    const style = getComputedStyle(document.activeElement as HTMLElement);
    return style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 2;
  });

const pad = (n: number) => String(n).padStart(2, "0");

test.describe("3D hero", () => {
  test("poster first, live 3D after intent, crossfade, no console errors", async ({
    page,
  }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto(`/?3d=${liveTier(testInfo)}`);
    const poster = page.getByTestId("hero-poster-image").locator("img").first();
    await expect(poster).toHaveAttribute("loading", "eager");
    // High priority only where the poster is the LCP element (≥ 768 px): one preload per crop,
    // each scoped to its media query — the centred tablet poster and the 16:9 desktop poster
    // (MOT-01, D240). Phones get none (the headline is their LCP).
    const preloads = page.locator('head link[rel="preload"][as="image"][fetchpriority="high"]');
    await expect(preloads).toHaveCount(2);
    const scoped = Object.fromEntries(
      await preloads.evaluateAll((links) =>
        links.map((link) => [
          link.getAttribute("media") ?? "",
          link.getAttribute("imagesrcset") ?? "",
        ]),
      ),
    );
    expect(Object.keys(scoped).sort()).toEqual([
      "(min-width: 48rem) and (max-width: 63.999rem)",
      "(min-width: 64rem)",
    ]);
    expect(scoped["(min-width: 48rem) and (max-width: 63.999rem)"]).toContain(
      "/images/hero/car-assembled-t-1080.avif",
    );
    expect(scoped["(min-width: 64rem)"]).toContain("/images/hero/car-assembled-1440.avif");
    await expect(poster).toHaveJSProperty("complete", true);
    // Nothing 3D before intent: no canvas element, no model request, no thumbnail in the grid.
    await expect(page.getByTestId(TEST_IDS.heroCanvas).locator("canvas")).toHaveCount(0);
    await expect(page.getByTestId(TEST_IDS.heroGrid).locator("img")).toHaveCount(0);
    // The hooks install after hydration; the poster (SSR) can be complete before that.
    await page.waitForFunction(() => Boolean(window.__sklop3d));
    const before = await state(page);
    expect(before.status).toBe("idle");
    expect(before.page).toBe(0);

    await startAndWaitFor3d(page);
    await expect(page.getByTestId(TEST_IDS.heroCanvas).locator("canvas")).toHaveCount(1);
    await expect(page.getByTestId(TEST_IDS.heroCanvas)).toHaveCSS("opacity", "1", {
      timeout: 5_000,
    });
    await expect(page.getByTestId(TEST_IDS.heroPoster)).toHaveCSS("opacity", "0");
    const after = await state(page);
    expect(after.tier).toBe(liveTier(testInfo));
    expect(after.slotMode).toBe("mesh");

    await page.screenshot({ path: testInfo.outputPath("hero-assembled.png") });
    expect(errors).toEqual([]);
  });

  test("the grid fills page by page: slots, names and the counter after each page", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    const errors = collectErrors(page);
    await page.goto(`/?3d=${liveTier(testInfo)}`);
    await startAndWaitFor3d(page);
    const grid = page.getByTestId(TEST_IDS.heroGrid);
    const nav = page.getByTestId(TEST_IDS.heroNav);

    // The assembled car: an empty bench.
    expect((await state(page)).found).toBe(0);
    await expect(grid.locator("[data-page-active]")).toHaveCount(0);
    await expect(nav.locator("[data-hero-counter]")).toContainText(new RegExp(`00\\s*/\\s*${TOTAL}`));

    for (const [index, expected] of PAGES.entries()) {
      const number = index + 1;
      await page.evaluate((n) => window.__sklop3d!.page(n), number);
      await expect.poll(async () => (await state(page)).page).toBe(number);
      expect((await state(page)).found).toBe(expected.found);

      // One list is the grid; it holds the page's slots and every one of them is seated.
      const active = grid.locator("[data-page-active]");
      await expect(active).toHaveCount(1);
      await expect(active).toHaveAttribute("data-page", String(number));
      await expect(active).toHaveAccessibleName(expected.list);
      await expect(active.locator("[data-slot]")).toHaveCount(expected.slots);
      await expect(active.locator("[data-slot][data-seated]")).toHaveCount(expected.slots);
      // A seated slot shows its name (it is in the accessibility tree from the start).
      await expect(active.locator("[data-label].sr-only")).toHaveCount(0);

      // The navigator counts with the grid and marks the page's cluster.
      await expect(nav.locator("[data-hero-counter]")).toContainText(
        new RegExp(`${pad(expected.found)}\\s*/\\s*${TOTAL}`),
      );
      await expect(
        nav.locator(`li[aria-current="step"] button[data-system="${expected.chip}"]`),
      ).toHaveAttribute("data-state", "active");

      // The scene docks a part into every mesh slot, on its cell (once it has drawn the page:
      // the software renderer of this run needs a moment for a frame).
      await expect
        .poll(
          async () => {
            const slots = await page.evaluate(() => window.__sklop3d!.slots());
            if (slots.length !== expected.meshes) return `${slots.length} slots`;
            const off = slots.filter((slot) => Math.hypot(slot.dx, slot.dy) >= 8);
            return off.length ? `off its cell: ${off.map((slot) => slot.slug).join(", ")}` : "docked";
          },
          { timeout: 30_000 },
        )
        .toBe("docked");
      for (const slot of await page.evaluate(() => window.__sklop3d!.slots())) {
        expect(Math.max(slot.w, slot.h), `${slot.slug} is large enough to read`).toBeGreaterThan(40);
      }
      // The two slots without a mesh show their thumbnail.
      await expect(active.locator("img")).toHaveCount(expected.slots - expected.meshes);
    }
    await page.screenshot({ path: testInfo.outputPath("hero-page-6.png") });

    // The end of the track: the whole car is on the bench.
    await page.evaluate(() => window.__sklop3d!.explode(1));
    await expect.poll(async () => (await state(page)).ended).toBe(true);
    const end = page.getByTestId(TEST_IDS.heroEnd);
    await expect(end).toBeVisible();
    await expect(end).toContainText("Ceo auto rastavljen");
    await expect(end.getByRole("link", { name: "Svi delovi" })).toHaveAttribute("href", "/delovi");
    await expect(nav.locator('button[data-system][data-state="done"]')).toHaveCount(10);

    // „Sklopi auto“ scrolls back to the assembled car.
    await page.getByTestId(TEST_IDS.heroAssemble).click();
    await expect.poll(async () => (await state(page)).progress, { timeout: 30_000 }).toBeLessThan(0.001);
    expect((await state(page)).found).toBe(0);
    await expect(end).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test("scrolling back puts every part back and leaves nothing behind", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    const errors = collectErrors(page);
    await page.goto(`/?3d=${liveTier(testInfo)}`);
    await startAndWaitFor3d(page);
    const docked = () =>
      page.evaluate(() =>
        window
          .__sklop3d!.slots()
          .map((slot) => slot.slug)
          .sort(),
      );

    await scrollToProgress(page, rest(2));
    expect(await state(page)).toMatchObject({ page: 2, found: 16 });
    await expect(page.locator("[data-page-active] [data-slot][data-seated]")).toHaveCount(9);
    const seatedForward = await seatedSlugs(page);
    await expect.poll(async () => (await docked()).length, { timeout: 30_000 }).toBe(9);
    const dockedForward = await docked();

    await scrollToProgress(page, rest(4));
    expect(await state(page)).toMatchObject({ page: 4, found: 30 });

    // Back to the same point: the same page, the same count, the same parts in the same slots.
    await scrollToProgress(page, rest(2));
    expect(await state(page)).toMatchObject({ page: 2, found: 16 });
    await expect(page.locator("[data-page-active] [data-slot][data-seated]")).toHaveCount(9);
    expect(await seatedSlugs(page)).toEqual(seatedForward);
    await expect.poll(docked, { timeout: 30_000 }).toEqual(dockedForward);

    // Half-way through a flight on the way back: fewer parts found than at the rest.
    await scrollToProgress(page, 0.06 + 1.2 * (0.88 / 6));
    const midway = await state(page);
    expect(midway.page).toBe(2);
    expect(midway.found).toBeGreaterThanOrEqual(7);
    expect(midway.found).toBeLessThan(16);

    // Back at the top: the assembled car, an empty bench, a clean DOM.
    await scrollToProgress(page, 0);
    expect(await state(page)).toMatchObject({ page: 0, found: 0, ended: false });
    await expect(page.locator("[data-hero-grid] [data-page-active]")).toHaveCount(0);
    await expect(page.locator("[data-hero-grid] [data-seated]")).toHaveCount(0);
    await expect.poll(docked, { timeout: 30_000 }).toEqual([]);
    await expect.poll(() => leftovers(page)).toEqual({ words: 0, ticks: 0 });
    await expect(page.locator("[data-hero-intro]")).toBeVisible();
    await expect(page.getByTestId(TEST_IDS.heroCanvas)).toHaveCSS("opacity", "1");
    expect(errors).toEqual([]);
  });

  test("keyboard: the navigator is one tab stop, then the page's slots, which are links", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    const errors = collectErrors(page);
    await page.goto(`/?3d=${liveTier(testInfo)}`);
    await startAndWaitFor3d(page);
    await page.evaluate(() => window.__sklop3d!.page(2));
    await expect.poll(async () => (await state(page)).page).toBe(2);
    const focusedSystem = () =>
      page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.system ?? null);
    const focusedSlot = () =>
      page.evaluate(() => (document.activeElement as HTMLElement | null)?.dataset.slot ?? null);

    // A roving tabindex: one chip is in the tab order, arrows move between all ten.
    const stop = page.locator('button[data-system][tabindex="0"]');
    await expect(stop).toHaveCount(1);
    await expect(stop).toHaveAttribute("data-system", "elektrika-i-svetla");
    await stop.focus();
    await page.keyboard.press("ArrowRight");
    expect(await focusedSystem()).toBe("tockovi");
    expect(await focusRing(page)).toBe(true);
    await page.keyboard.press("End");
    expect(await focusedSystem()).toBe("servis");
    await page.keyboard.press("Home");
    expect(await focusedSystem()).toBe("karoserija");
    await page.keyboard.press("ArrowLeft");
    expect(await focusedSystem()).toBe("servis");

    // Enter jumps to the system's page; its chip becomes the tab stop.
    await page.locator('button[data-system="vesanje-i-upravljanje"]').focus();
    await page.keyboard.press("Enter");
    await expect.poll(async () => (await state(page)).page, { timeout: 30_000 }).toBe(3);
    await expect
      .poll(async () => Math.abs((await state(page)).progress - rest(3)), { timeout: 30_000 })
      .toBeLessThan(0.004);
    await expect(page.locator('button[data-system][tabindex="0"]')).toHaveAttribute(
      "data-system",
      "vesanje-i-upravljanje",
    );
    await expect(page.locator('li[aria-current="step"] button[data-system]')).toHaveCount(2);

    // Tab: „Lista delova“, then the eight slots of the page in reading order, each with a ring
    // and its origin lit on the car.
    await page.keyboard.press("Tab");
    await expect(page.getByTestId(TEST_IDS.partsListTrigger)).toBeFocused();
    const slugs = await page
      .locator("[data-page-active] [data-slot]")
      .evaluateAll((links) => links.map((link) => link.getAttribute("data-slot")));
    expect(slugs).toHaveLength(8);
    for (const slug of slugs) {
      await page.keyboard.press("Tab");
      expect(await focusedSlot()).toBe(slug);
      expect(await focusRing(page), `${slug} shows focus`).toBe(true);
      expect((await state(page)).focusedSlot).toBe(slug);
    }
    const last = page.locator(`[data-slot="${slugs[slugs.length - 1]}"]`);
    await expect(last).toHaveAttribute("href", `/delovi/${slugs[slugs.length - 1]}`);
    // The next stop is outside the grid (the other pages' links are not in the tab order).
    await page.keyboard.press("Tab");
    expect(
      await page.evaluate(() => Boolean(document.activeElement?.closest("[data-hero-grid]"))),
    ).toBe(false);
    expect((await state(page)).focusedSlot).toBeNull();

    // Focus left the frame and the browser scrolled after it; back to a page of the grid.
    await page.evaluate(() => window.__sklop3d!.page(3));
    await expect.poll(async () => (await state(page)).page).toBe(3);

    // A link of another page takes focus (a screen reader's virtual cursor): its page comes up.
    await page.locator('[data-slot="menjac"]').focus();
    await expect.poll(async () => (await state(page)).page, { timeout: 30_000 }).toBe(6);
    await expect(page.locator('[data-page-active] [data-slot="menjac"]')).toBeFocused();

    // A slot is a link to its category.
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/delovi\/menjac(\?|$)/, { timeout: 30_000 });
    expect(errors).toEqual([]);
  });

  test("the lists mirror the grid, pages are announced once still, the skip link, axe", async ({
    page,
  }, testInfo) => {
    await page.goto(`/?3d=${liveTier(testInfo)}`);
    await startAndWaitFor3d(page);

    // Six lists with all 44 categories as links, whatever the scroll position.
    const region = page.getByRole("region", { name: "Delovi automobila po sistemima" });
    await expect(region.getByRole("list")).toHaveCount(6);
    await expect(region.getByRole("link")).toHaveCount(TOTAL);
    await expect(region.getByRole("list", { name: "Motor i usis, 2. deo" })).toHaveCount(1);
    await expect(region.getByRole("link", { name: "Kočioni diskovi", exact: true })).toHaveAttribute(
      "href",
      "/delovi/kocioni-diskovi",
    );
    await expect(page.getByRole("navigation", { name: "Sistemi vozila" })).toBeVisible();

    // One polite sentence per page, after the progress has been still for a moment.
    const live = page.getByTestId("home-hero").locator('[role="status"]');
    await page.evaluate(() => window.__sklop3d!.page(2));
    await expect(live).toHaveText(/Kočnice — 9 kategorija/, { timeout: 10_000 });

    const results = await new AxeBuilder({ page })
      .include('[data-testid="home-hero"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
      ),
    ).toEqual([]);

    // The skip link is the first stop of the stage and lands past the whole track.
    await page.evaluate(() => window.scrollTo(0, 0));
    const skip = page.getByTestId(TEST_IDS.heroSkip);
    await skip.focus();
    await expect(skip).toBeInViewport();
    await expect(skip).toHaveText("Preskoči 3D prikaz");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/#systems-title$/);
    await expect(page.locator("#systems-title")).toBeInViewport();
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
    await expect(panel.getByTestId(TEST_IDS.partPanelProduct).first()).toBeVisible({
      timeout: 20_000,
    });
    expect(await panel.getByTestId(TEST_IDS.partPanelProduct).count()).toBeGreaterThan(0);
    await expect(panel).toContainText("RSD");
    await expect(page).toHaveURL(/[?&]deo=kocioni-diskovi/);
    expect((await state(page)).selected).toBe("kocioni-diskovi");
    // The grid waits behind the panel: not reachable, not clickable.
    await expect(page.getByTestId(TEST_IDS.heroGrid)).toHaveAttribute("inert", "");

    // Esc closes, the URL forgets the part and focus returns to the trigger.
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(page).not.toHaveURL(/deo=/);
    await expect(page.getByTestId(TEST_IDS.partsListTrigger)).toBeFocused();
    await expect(page.getByTestId(TEST_IDS.heroGrid)).not.toHaveAttribute("inert", "");
    expect(errors).toEqual([]);
  });

  test("the test hook selects a part: its page comes up with the part still on the car", async ({
    page,
  }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto(`/?3d=${liveTier(testInfo)}`);
    await startAndWaitFor3d(page);

    expect(await page.evaluate(() => window.__sklop3d!.selectPart("turbina"))).toBe(true);
    const panel = page.getByTestId(TEST_IDS.partPanel);
    await expect(panel).toBeVisible();
    await expect(panel.getByRole("heading", { name: "Turbina (turbopunjač)" })).toBeVisible();
    await expect(panel.getByTestId(TEST_IDS.partPanelProduct).first()).toBeVisible({
      timeout: 20_000,
    });
    await expect(page).toHaveURL(/[?&]deo=turbina/);
    // The turbo is on the fifth page: the four before it are found, its own page has not left.
    await expect.poll(async () => (await state(page)).page, { timeout: 30_000 }).toBe(5);
    expect((await state(page)).found).toBe(30);
    await page.waitForTimeout(1200);
    await page.screenshot({ path: testInfo.outputPath("hero-selected.png") });

    // An unknown slug is refused.
    expect(await page.evaluate(() => window.__sklop3d!.selectPart("ne-postoji"))).toBe(false);
    expect(errors).toEqual([]);
  });

  test("a deep link opens the right panel", async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/?deo=akumulator");
    const panel = page.getByTestId(TEST_IDS.partPanel);
    await expect(panel).toBeVisible({ timeout: 20_000 });
    await expect(panel.getByRole("heading", { name: "Akumulator" })).toBeVisible();
    await expect(panel.getByTestId(TEST_IDS.partPanelProduct).first()).toBeVisible({
      timeout: 20_000,
    });
    expect((await state(page)).selected).toBe("akumulator");
    // The track scrolls to the battery's page and stops before its parts leave the car — a
    // whole pixel, rounded down, so it never names the next page (MOT-03).
    await expect.poll(async () => (await state(page)).page, { timeout: 10_000 }).toBe(2);
    expect((await state(page)).found).toBe(7);
    if (!testInfo.project.name.startsWith("mobile")) {
      // The drawer is non-modal: the navigator reflows left of it (MOT-04).
      await page.waitForTimeout(800);
      const drawerLeft = (await panel.boundingBox())?.x ?? 0;
      const strip = page.getByTestId(TEST_IDS.heroNav);
      const edges = await Promise.all(
        [strip.locator("nav ol"), page.getByTestId(TEST_IDS.partsListTrigger)].map(async (el) => {
          const box = await el.boundingBox();
          return box ? box.x + box.width : 0;
        }),
      );
      for (const right of edges) {
        expect(right).toBeGreaterThan(0);
        expect(right).toBeLessThanOrEqual(drawerLeft + 1);
      }
    }
    expect(errors).toEqual([]);
  });

  test("the stage keeps the poster's aspect below 1024 px, so the car fills it", async ({
    page,
  }, testInfo) => {
    await page.goto("/");
    const stage = page
      .getByTestId("hero-track")
      .getByRole("img", { name: /Interaktivni 3D prikaz/ });
    const box = await stage.boundingBox();
    const poster = page.getByTestId("hero-poster-image").locator("img").first();
    await expect
      .poll(() => poster.evaluate((img: HTMLImageElement) => img.currentSrc))
      .not.toBe("");
    const src = await poster.evaluate((img: HTMLImageElement) => img.currentSrc);
    const frame = await page.getByTestId("hero-track").locator(".hero-frame").boundingBox();
    expect(box && frame).toBeTruthy();
    if (!box || !frame) return;
    if (testInfo.project.name.startsWith("mobile")) {
      // MOT-01, D279: a 4:5 stage for the 4:5 phone poster (shorter only when the screen
      // is), never a screen-tall box with the car floating in its middle.
      expect(src).toContain("/images/hero/car-assembled-m-");
      expect(box.width).toBeCloseTo(frame.width, 0);
      expect(box.height).toBeLessThanOrEqual(box.width * 1.25 + 1);
      expect(box.height).toBeGreaterThan(box.width * 1.1);
      // The navigator stays docked at the bottom of the sticky frame.
      const strip = await page.getByTestId(TEST_IDS.heroNav).boundingBox();
      expect(
        strip && Math.abs(strip.y + strip.height - (frame.y + frame.height)),
      ).toBeLessThanOrEqual(1);
    } else {
      // ≥ 1024 px the stage is the whole frame; the copy column sits over its left part.
      expect(src).toContain("/images/hero/car-assembled-");
      expect(box.height).toBeCloseTo(frame.height, 0);
    }
  });

  test("an unknown deep link is ignored", async ({ page }) => {
    await page.goto("/?deo=nepostojeci-deo");
    await page.waitForTimeout(1000);
    await expect(page.getByTestId(TEST_IDS.partPanel)).toHaveCount(0);
    expect((await state(page)).selected).toBeNull();
  });

  test("the panel is accessible (axe) and every hero control shows focus", async ({ page }) => {
    await page.goto("/?deo=kocione-plocice");
    await expect(page.getByTestId(TEST_IDS.partPanelProduct).first()).toBeVisible({
      timeout: 20_000,
    });
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .exclude("nextjs-portal")
      .analyze();
    expect(
      results.violations.map(
        (v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`,
      ),
    ).toEqual([]);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId(TEST_IDS.partPanel)).toBeHidden();
    // Focus went back to the stage (deep-link source) — with a visible ring for the keyboard.
    await expect(page.getByRole("img", { name: /Interaktivni 3D prikaz/ })).toBeFocused();
    expect(await focusRing(page)).toBe(true);
    // Keyboard only: Tab through the hero until the last slot of the page, checking every stop.
    const lastSlot = page.locator("[data-page-active] [data-slot]").last();
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
          last:
            el.matches("[data-page-active] [data-slot]") &&
            el.parentElement?.nextElementSibling === null,
        };
      });
      if (!info) continue;
      if (!info.ring) unfocusedRing.push(info.label);
      if (info.last) break;
    }
    await expect(lastSlot).toBeFocused();
    expect(unfocusedRing).toEqual([]);
  });
});

test.describe("3D hero — fallbacks", () => {
  test("reduced motion: no track, chips cut between pages of thumbnails, nothing floats", async ({
    browser,
  }, testInfo) => {
    test.setTimeout(240_000);
    const mobile = testInfo.project.name.startsWith("mobile");
    const context = await browser.newContext({
      reducedMotion: "reduce",
      storageState: ".playwright/consent-state.json",
      locale: "sr-Latn-RS",
      viewport: mobile ? { width: 390, height: 844 } : { width: 1440, height: 900 },
      deviceScaleFactor: mobile ? 2 : 1,
      isMobile: mobile,
      hasTouch: mobile,
    });
    // Counts what the canvas draws (the float must not run).
    await context.addInitScript(() => {
      const counter = { draws: 0 };
      (window as unknown as { __draws: typeof counter }).__draws = counter;
      const proto = WebGL2RenderingContext.prototype;
      const drawElements = proto.drawElements;
      proto.drawElements = function (...args) {
        counter.draws += 1;
        return drawElements.apply(this, args);
      };
    });
    const page = await context.newPage();
    const errors = collectErrors(page);
    await page.goto(`/?3d=${liveTier(testInfo)}`);
    const track = page.getByTestId("hero-track");
    const heights = await track.evaluate((el) => ({
      track: el.getBoundingClientRect().height,
      frame: (el.firstElementChild as HTMLElement).getBoundingClientRect().height,
    }));
    expect(Math.abs(heights.track - heights.frame)).toBeLessThan(2);

    await startAndWaitFor3d(page);
    expect(await state(page)).toMatchObject({ reducedMotion: true, slotMode: "image", page: 0 });
    await expect(page.locator("[data-hero-intro]")).toContainText("Izaberite sistem ispod");

    // A chip cuts to its page: thumbnails and names are simply there.
    await page.locator('button[data-system="kocnice"]').click();
    await expect.poll(async () => (await state(page)).page).toBe(2);
    expect((await state(page)).found).toBe(16);
    const active = page.locator("[data-page-active]");
    await expect(active.locator("[data-slot][data-seated]")).toHaveCount(9);
    await expect(active.locator("img")).toHaveCount(9);
    await expect
      .poll(
        () =>
          active
            .locator("img")
            .evaluateAll((images) =>
              images.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0),
            ),
        { timeout: 30_000 },
      )
      .toBe(true);
    await expect(active.locator("[data-label].sr-only")).toHaveCount(0);
    expect(await leftovers(page)).toEqual({ words: 0, ticks: 0 });
    // The whole frame is on screen after the jump: the car's band, the grid and the navigator.
    const frame = await track.evaluate((el) => {
      const rect = el.getBoundingClientRect();
      const header =
        Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--header-h")) || 64;
      return { top: rect.top - header, bottom: rect.bottom - window.innerHeight };
    });
    expect(frame.top).toBeGreaterThanOrEqual(-1);
    expect(frame.bottom).toBeLessThanOrEqual(1);

    // At rest the canvas draws nothing: no idle float under reduced motion.
    await page.waitForTimeout(1500);
    await page.evaluate(() => ((window as unknown as { __draws: { draws: number } }).__draws.draws = 0));
    await page.waitForTimeout(1500);
    expect(
      await page.evaluate(() => (window as unknown as { __draws: { draws: number } }).__draws.draws),
    ).toBe(0);

    // The last chip is also the way to the end state; „Sklopi auto“ puts the car back.
    await page.locator('button[data-system="servis"]').click();
    await expect.poll(async () => (await state(page)).ended).toBe(true);
    expect(await state(page)).toMatchObject({ page: 6, found: 44, progress: 1 });
    await expect(page.getByTestId(TEST_IDS.heroEnd)).toBeVisible();
    await page.getByTestId(TEST_IDS.heroAssemble).click();
    await expect.poll(async () => (await state(page)).progress).toBe(0);
    await expect(page.locator("[data-hero-grid] [data-page-active]")).toHaveCount(0);
    expect(errors).toEqual([]);
    await context.close();
  });

  test("no WebGL: the poster makes room and the grid is a page of thumbnails", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    const errors = collectErrors(page);
    // A browser without WebGL at all (blocked driver, disabled in settings).
    await page.addInitScript(() => {
      const getContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
        if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") return null;
        return (getContext as (...args: unknown[]) => unknown).call(this, type, ...rest);
      } as typeof getContext;
    });
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.__sklop3d));
    await page.evaluate(() => window.scrollTo(0, 80));
    await page.waitForFunction(() => window.__sklop3d?.tier === "low");
    await expect(page.getByTestId(TEST_IDS.heroCanvas).locator("canvas")).toHaveCount(0);
    expect((await state(page)).slotMode).toBe("image");

    // Scrolling fills the same grid with the categories' pictures.
    await scrollToProgress(page, rest(2));
    expect(await state(page)).toMatchObject({ page: 2, found: 16, status: "idle" });
    const active = page.locator("[data-page-active]");
    await expect(active.locator("[data-slot][data-seated]")).toHaveCount(9);
    await expect(active.locator("img")).toHaveCount(9);
    await expect
      .poll(
        () =>
          active
            .locator("img")
            .evaluateAll((images) =>
              images.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0),
            ),
        { timeout: 30_000 },
      )
      .toBe(true);
    expect(
      await active.locator("img").evaluateAll((images) =>
        images.every((img) => decodeURIComponent((img as HTMLImageElement).currentSrc).includes("/images/parts/")),
      ),
    ).toBe(true);
    await expect(active.locator("[data-label].sr-only")).toHaveCount(0);
    for (const href of await active
      .locator("a[data-slot]")
      .evaluateAll((links) => links.map((link) => link.getAttribute("href") ?? ""))) {
      expect(href).toMatch(/^\/delovi\/[a-z0-9-]+$/);
    }
    // The poster is still the car: it moves into its band and dims as parts are taken off.
    const poster = page.getByTestId(TEST_IDS.heroPoster);
    await expect(poster).toHaveCSS("opacity", "1");
    expect(await poster.evaluate((el) => (el as HTMLElement).style.transform)).toMatch(/scale\(0?\.\d+\)/);
    expect(
      Number(await poster.evaluate((el) => getComputedStyle(el.firstElementChild as HTMLElement).opacity)),
    ).toBeLessThan(0.95);
    await page.screenshot({ path: testInfo.outputPath("hero-no-webgl.png") });

    // The panel works without 3D, and so does the end of the track.
    await page.evaluate(() => window.__sklop3d!.selectPart("farovi"));
    await expect(page.getByTestId(TEST_IDS.partPanel)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByTestId(TEST_IDS.partPanel)).toBeHidden();
    await scrollToProgress(page, 1);
    await expect(page.getByTestId(TEST_IDS.heroEnd)).toBeVisible();
    expect((await state(page)).found).toBe(TOTAL);

    // A slot is a link to its category, with or without a canvas.
    await page.locator('[data-page-active] [data-slot="menjac"]').click();
    await expect(page).toHaveURL(/\/delovi\/menjac$/);
    expect(errors).toEqual([]);
  });

  test("a software WebGL renderer gets the posters only", async ({ page }) => {
    const errors = collectErrors(page);
    // No `?3d=` override: the probe sees SwiftShader and keeps the posters (PERF-23).
    await page.goto("/");
    await page.waitForFunction(() => Boolean(window.__sklop3d));
    await page.evaluate(() => window.scrollTo(0, 80));
    await page.waitForFunction(() => window.__sklop3d?.tier === "low");
    await page.waitForTimeout(500);
    await expect(page.getByTestId(TEST_IDS.heroCanvas).locator("canvas")).toHaveCount(0);
    expect(await state(page)).toMatchObject({ status: "idle", slotMode: "image" });
    await expect(page.getByTestId(TEST_IDS.heroPoster)).toHaveCSS("opacity", "1");
    expect(errors).toEqual([]);
  });

  test("WebGL context loss hands the stage back to the poster and the thumbnails", async ({
    page,
  }, testInfo) => {
    await page.goto(`/?3d=${liveTier(testInfo)}`);
    await startAndWaitFor3d(page);
    await page.evaluate(() => window.__sklop3d!.page(2));
    await expect.poll(async () => (await state(page)).slotMode).toBe("mesh");
    await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-testid="hero-canvas"] canvas',
      );
      const gl = canvas?.getContext("webgl2");
      gl?.getExtension("WEBGL_lose_context")?.loseContext();
    });
    await expect.poll(async () => (await state(page)).status).toBe("lost");
    await expect(page.getByTestId(TEST_IDS.heroPoster)).toHaveCSS("opacity", "1", {
      timeout: 5_000,
    });
    // The page of the grid stays: its slots show thumbnails instead of meshes.
    expect(await state(page)).toMatchObject({ slotMode: "image", page: 2, found: 16 });
    await expect(page.locator("[data-page-active] img")).toHaveCount(9);
  });
});
