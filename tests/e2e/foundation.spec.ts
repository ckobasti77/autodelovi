/**
 * Step 04 foundation checks on /styleguide (and the home placeholder):
 * - no console errors or page errors;
 * - the text reveal leaves nothing hidden after scrolling end to end (skill check snippet)
 *   and no element stays `data-reveal-state="pending"`;
 * - every keyboard tab stop shows a visible focus indicator;
 * - reduced motion and no-JS never hide copy.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
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
  // Longest reveal: ≈ 1.14 s per element; give the last ones time to finish.
  await page.waitForTimeout(1800);
}

/** The text-reveal skill's acceptance snippet, returning short descriptions of offenders. */
async function hiddenCopy(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    [...document.querySelectorAll<HTMLElement>("*")]
      .filter((e) => e.offsetParent && e.textContent?.trim() && getComputedStyle(e).opacity === "0")
      .map((e) => `${e.tagName.toLowerCase()}: ${e.textContent?.trim().slice(0, 60)}`),
  );
}

test.describe("styleguide", () => {
  test("loads without console errors and reveals all copy", async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/styleguide");
    await page.evaluate(() => document.fonts.ready);
    await expect(page.getByRole("heading", { level: 1, name: "Stilski vodič" })).toBeVisible();

    await scrollEndToEnd(page);
    expect(await hiddenCopy(page)).toEqual([]);
    await expect(page.locator('[data-reveal-state="pending"]')).toHaveCount(0);
    await expect(page.locator(".reveal-word")).toHaveCount(0);

    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({ path: testInfo.outputPath("styleguide-full.png"), fullPage: true });
    expect(errors).toEqual([]);
  });

  test("every tab stop has a visible focus indicator", async ({ page }) => {
    await page.goto("/styleguide");
    await page.evaluate(() => document.fonts.ready);
    const failures: string[] = [];
    let stops = 0;
    for (let i = 0; i < 400; i++) {
      await page.keyboard.press("Tab");
      const info = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return null;
        // Next.js dev tools (development server only).
        if (el.tagName === "NEXTJS-PORTAL")
          return { visible: true, label: "dev tools", isSkip: false };
        const ring = (node: Element | null) => {
          if (!node) return false;
          const style = getComputedStyle(node);
          const outline = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) >= 2;
          const shadow = style.boxShadow !== "none" && style.boxShadow !== "";
          return outline || shadow;
        };
        const visible =
          ring(el) || ring(el.parentElement) || ring(el.parentElement?.parentElement ?? null);
        const label =
          el.getAttribute("aria-label") ??
          el.textContent?.trim().slice(0, 40) ??
          el.tagName.toLowerCase();
        return {
          visible,
          label: `${el.tagName.toLowerCase()} "${label}"`,
          isSkip: el.dataset.testid === "skip-link",
        };
      });
      if (!info) break;
      if (info.isSkip && stops > 0) break; // wrapped around
      stops += 1;
      if (!info.visible) failures.push(info.label);
    }
    expect(stops).toBeGreaterThan(40);
    expect(failures).toEqual([]);
  });

  test("reduced motion shows all copy immediately", async ({ browser }) => {
    const context = await browser.newContext({
      reducedMotion: "reduce",
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/styleguide");
    await page.waitForTimeout(600);
    expect(await hiddenCopy(page)).toEqual([]);
    await context.close();
  });

  test("without JavaScript nothing is hidden", async ({ browser }) => {
    const context = await browser.newContext({
      javaScriptEnabled: false,
      viewport: { width: 1440, height: 900 },
    });
    const page = await context.newPage();
    await page.goto("/styleguide");
    expect(await hiddenCopy(page)).toEqual([]);
    await context.close();
  });
});

test.describe("home placeholder", () => {
  test("renders the statement and search without errors", async ({ page }) => {
    const errors = collectErrors(page);
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toContainText("Rasklopi");
    await expect(page.getByRole("combobox", { name: "Broj dela ili naziv" })).toBeVisible();
    await scrollEndToEnd(page);
    expect(await hiddenCopy(page)).toEqual([]);
    expect(errors).toEqual([]);
  });

  test("the old concept route redirects to the styleguide", async ({ page }) => {
    await page.goto("/lab/koncept");
    await expect(page).toHaveURL(/\/styleguide$/);
  });

  test("unknown routes render the branded 404", async ({ page }) => {
    const response = await page.goto("/ovo-ne-postoji");
    expect(response?.status()).toBe(404);
    await expect(
      page.getByRole("heading", { level: 1, name: "Stranica nije pronađena" }),
    ).toBeVisible();
  });
});

test.describe("accessibility (axe, WCAG 2.2 AA)", () => {
  for (const path of ["/", "/styleguide", "/ovo-ne-postoji"]) {
    test(`no violations on ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.evaluate(() => document.fonts.ready);
      await scrollEndToEnd(page);
      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        // Next.js dev tools overlay (development server only).
        .exclude("nextjs-portal")
        .analyze();
      const summary = results.violations.map(
        (v) =>
          `${v.id} (${v.impact}): ${v.nodes
            .slice(0, 3)
            .map((n) => n.target.join(" "))
            .join(" | ")}`,
      );
      expect(summary).toEqual([]);
    });
  }
});
