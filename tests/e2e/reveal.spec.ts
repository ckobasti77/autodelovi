/**
 * Step 26 — the site-wide reveal rule, on the reveal lab (/styleguide/otkrivanje):
 * - a block below the line is hidden, and scrolling its centre past the line reveals it;
 * - a tall block reveals when its top crosses the line;
 * - a grid reveals row by row, in document order, within the stagger budget;
 * - eager (first-screen) items are never hidden;
 * - content skipped by content-visibility and items added later are revealed;
 * - with reduced motion everything is visible at once, without JavaScript too;
 * - nothing stays hidden after scrolling to the bottom, anchors and jumps included.
 */
import { expect, test, type Locator, type Page } from "@playwright/test";

import { BLOCK_REVEAL, REVEAL_LINE, REVEAL_TALL_RATIO } from "../../constants/revealConfig";

const LAB = "/styleguide/otkrivanje";
const STATE = "data-reveal-state";

/** Wait until the engine has marked the page (it starts in an idle callback after hydration). */
async function engineReady(page: Page) {
  await page.waitForFunction(
    (attr) => document.querySelector(`[data-testid="reveal-solo"]`)?.hasAttribute(attr) === true,
    STATE,
  );
}

async function box(locator: Locator) {
  return locator.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      top: r.top,
      centre: r.top + r.height / 2,
      height: r.height,
      viewport: window.innerHeight,
      opacity: Number(getComputedStyle(el).opacity),
    };
  });
}

/** Scrolls so that `locator`'s centre (or top) sits `offset` px below (+) or above (−) the line. */
async function placeAtLine(page: Page, locator: Locator, offset: number, edge: "centre" | "top") {
  await locator.evaluate(
    (el, { line, offset: by, edge: which }) => {
      const r = el.getBoundingClientRect();
      const point = which === "top" ? r.top : r.top + r.height / 2;
      const lineY = window.innerHeight * (1 - line);
      window.scrollBy(0, point - lineY - by);
    },
    { line: REVEAL_LINE, offset, edge },
  );
  // Two frames: the observer reports after layout, the state is written in its callback.
  await page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );
}

async function hiddenContent(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("*")]
      .filter((e) => e.offsetParent && e.textContent?.trim() && getComputedStyle(e).opacity === "0")
      .map((e) => `${e.tagName.toLowerCase()}: ${e.textContent?.trim().slice(0, 50)}`),
  );
}

async function scrollEndToEnd(page: Page) {
  await page.evaluate(async () => {
    const step = Math.round(window.innerHeight * 0.6);
    for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(1800);
}

test.describe("reveal rule", () => {
  test("a block below the line is hidden; its centre crossing the line reveals it, once", async ({
    page,
  }) => {
    await page.goto(LAB);
    await engineReady(page);
    const solo = page.getByTestId("reveal-solo");

    await expect(solo).toHaveAttribute(STATE, "pending");
    expect((await box(solo)).opacity).toBe(0);

    // Top already above the line, centre still 24 px below it: stays hidden.
    await placeAtLine(page, solo, 24, "centre");
    const before = await box(solo);
    expect(before.top).toBeLessThan(before.viewport * (1 - REVEAL_LINE));
    await expect(solo).toHaveAttribute(STATE, "pending");
    expect(before.opacity).toBe(0);

    // Centre 6 px above the line: revealed.
    await placeAtLine(page, solo, -6, "centre");
    await expect(solo).toHaveAttribute(STATE, /running|done/);
    await expect(solo).toHaveAttribute(STATE, "done", { timeout: 3000 });
    expect((await box(solo)).opacity).toBe(1);
    await expect(solo).not.toHaveAttribute("data-reveal-mode");

    // Scrolling back up does not reverse it.
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(300);
    await expect(solo).toHaveAttribute(STATE, "done");
    expect((await box(solo)).opacity).toBe(1);
  });

  test("a block taller than the tall ratio reveals when its top crosses the line", async ({
    page,
  }) => {
    await page.goto(LAB);
    await engineReady(page);
    const tall = page.getByTestId("reveal-tall");
    const measured = await box(tall);
    expect(measured.height).toBeGreaterThan(measured.viewport * REVEAL_TALL_RATIO);

    await placeAtLine(page, tall, 30, "top");
    await expect(tall).toHaveAttribute(STATE, "pending");

    await placeAtLine(page, tall, -8, "top");
    await expect(tall).toHaveAttribute(STATE, /running|done/);
    // Its centre is still far below the line.
    const now = await box(tall);
    expect(now.centre).toBeGreaterThan(now.viewport * (1 - REVEAL_LINE));
  });

  test("a grid reveals row by row in document order, inside the stagger budget", async ({
    page,
  }) => {
    await page.goto(LAB);
    await engineReady(page);
    await page.evaluate((delayVar) => {
      const log: { index: number; delay: number; time: number }[] = [];
      (window as unknown as { __grid: typeof log }).__grid = log;
      const grid = document.querySelector('[data-testid="reveal-grid"]');
      if (!grid) return;
      const items = [...grid.children];
      new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          const el = mutation.target as HTMLElement;
          if (el.getAttribute("data-reveal-state") !== "running") continue;
          log.push({
            index: items.indexOf(el),
            delay: Number.parseInt(el.style.getPropertyValue(delayVar) || "0", 10),
            time: performance.now(),
          });
        }
      }).observe(grid, { attributes: true, attributeFilter: ["data-reveal-state"], subtree: true });
    }, BLOCK_REVEAL.delayVar);

    const items = page.getByTestId("reveal-grid").locator("> li");
    await expect(items).toHaveCount(12);
    for (let i = 0; i < 12; i++) await expect(items.nth(i)).toHaveAttribute(STATE, "pending");

    // Columns of the grid, measured while nothing moves (a running item is lifted).
    const perRow = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="reveal-grid"]');
      const tops = [...(grid?.children ?? [])].map((el) => Math.round(el.getBoundingClientRect().top));
      return tops.filter((top) => top === tops[0]).length;
    });
    expect(perRow).toBeGreaterThan(1);

    // Bring the first row's centre just past the line: only that row starts.
    await placeAtLine(page, items.first(), -6, "centre");
    await expect(items.first()).toHaveAttribute(STATE, /running|done/);
    for (let i = 0; i < perRow; i++) await expect(items.nth(i)).toHaveAttribute(STATE, /running|done/);
    await expect(items.nth(perRow)).toHaveAttribute(STATE, "pending");

    // Then the rest, a row at a time.
    for (let row = 1; row * perRow < 12; row++) {
      await placeAtLine(page, items.nth(row * perRow), -6, "centre");
      await expect(items.nth(row * perRow)).toHaveAttribute(STATE, /running|done/);
    }
    await page.waitForTimeout(1200);

    const log = await page.evaluate(
      () => (window as unknown as { __grid: { index: number; delay: number; time: number }[] }).__grid,
    );
    expect(log.map((entry) => entry.index)).toEqual([...Array(12).keys()]);
    const { stepMs, budgetMs, durationMs } = BLOCK_REVEAL.default;
    for (const entry of log) {
      // Position within its row × the step: card by card, left to right.
      expect(entry.delay).toBe(Math.min((entry.index % perRow) * stepMs, budgetMs));
      expect(entry.delay + durationMs).toBeLessThanOrEqual(700);
    }
    for (let i = 0; i < 12; i++) await expect(items.nth(i)).toHaveAttribute(STATE, "done");
  });

  test("first-screen items are never hidden", async ({ page }) => {
    // Before any script runs: the server HTML of the eager group is visible.
    await page.route("**/*.js", (route) => route.abort());
    await page.goto(LAB, { waitUntil: "domcontentloaded" });
    const eager = page.getByTestId("reveal-eager").locator("> li");
    await expect(eager).toHaveCount(4);
    for (let i = 0; i < 4; i++) {
      await expect(eager.nth(i)).toHaveAttribute(BLOCK_REVEAL.attrs.eager, "");
      await expect(eager.nth(i)).not.toHaveAttribute(STATE);
      const opacity = await eager.nth(i).evaluate((el) => Number(getComputedStyle(el).opacity));
      expect(opacity).toBeGreaterThanOrEqual(BLOCK_REVEAL.eager.fromOpacity);
    }
  });

  test("content-visibility sections, late items and the end of the page all reveal", async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on("console", (message) => message.type() === "error" && errors.push(message.text()));
    page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
    await page.goto(LAB);
    await engineReady(page);

    // Skipped by content-visibility: pending, not silently marked done.
    const cvItems = page.getByTestId("reveal-cv").locator("> li");
    await expect(cvItems.first()).toHaveAttribute(STATE, "pending");

    await scrollEndToEnd(page);
    for (let i = 0; i < 3; i++) await expect(cvItems.nth(i)).toHaveAttribute(STATE, "done");

    // „Prikaži još“ appends items after load: they are picked up and revealed.
    const more = page.getByTestId("reveal-more").locator("> li");
    const beforeCount = await more.count();
    await page.getByTestId("reveal-more-button").scrollIntoViewIfNeeded();
    await page.getByTestId("reveal-more-button").click();
    await expect(more).toHaveCount(5);
    expect(beforeCount).toBeLessThan(5);
    await expect(more.last()).toHaveAttribute(STATE, /pending|running|done/);

    await scrollEndToEnd(page);
    await expect(page.locator(`[${STATE}="pending"]`)).toHaveCount(0);
    await expect(page.locator(`[${STATE}="running"]`)).toHaveCount(0);
    await expect(page.locator(".reveal-word")).toHaveCount(0);
    expect(await hiddenContent(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("a jump past content shows what was skipped; an anchor lands on visible content", async ({
    page,
  }) => {
    await page.goto(`${LAB}#lab-tall`);
    await engineReady(page);
    await page.waitForTimeout(600);
    // Everything above the anchor was never on screen: shown at once, not left pending.
    await expect(page.getByTestId("reveal-solo")).toHaveAttribute(STATE, "done");
    await expect(page.getByTestId("reveal-grid").locator("> li").first()).toHaveAttribute(
      STATE,
      "done",
    );
    await expect(page.getByTestId("reveal-tall")).toHaveAttribute(STATE, /running|done/);

    await page.keyboard.press("End");
    await page.waitForTimeout(1800);
    await expect(page.locator(`[${STATE}="pending"]`)).toHaveCount(0);
    expect(await hiddenContent(page)).toEqual([]);
  });
});

test.describe("reveal without motion or JavaScript", () => {
  test("reduced motion: everything is visible at once, nothing animates", async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: "reduce" });
    const page = await context.newPage();
    await page.goto(LAB);
    await engineReady(page);
    // No scrolling at all: nothing on the page may be hidden or waiting.
    expect(await hiddenContent(page)).toEqual([]);
    await expect(page.locator(`[${STATE}="pending"]`)).toHaveCount(0);
    await expect(page.locator(`[${STATE}="running"]`)).toHaveCount(0);
    const animated = await page.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("[data-reveal-eager], [data-reveal-state]")].filter(
        (el) => getComputedStyle(el).animationName !== "none",
      ).length,
    );
    expect(animated).toBe(0);
    await context.close();
  });

  test("no JavaScript: nothing is hidden", async ({ browser }) => {
    const context = await browser.newContext({ javaScriptEnabled: false });
    const page = await context.newPage();
    await page.goto(LAB);
    for (const id of ["reveal-solo", "reveal-tall", "reveal-grid", "reveal-cv"]) {
      const target = page.getByTestId(id);
      const first = id === "reveal-solo" || id === "reveal-tall" ? target : target.locator("> li").first();
      expect(await first.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
    }
    await context.close();
  });
});
