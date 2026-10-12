/**
 * Step 28 — the reveal system on the real pages (reveal.spec.ts proves the rule on the lab):
 * - a block on a real page stays hidden until its vertical centre crosses the trigger line
 *   (`REVEAL_LINE`, 18 % of the viewport height above the bottom edge), then reveals;
 * - the items of real grids start one after another, in document order;
 * - every main route, opened directly: what the rule says should show is showing right after
 *   load (no scroll, no failsafe), and scrolling to the bottom leaves nothing hidden, pending
 *   or split;
 * - with reduced motion every main route shows everything at once, without scrolling;
 * - before any script runs a deep link already shows its heading and first-screen blocks, an
 *   anchor lands on visible content, and going back shows the content at the restored
 *   position without waiting.
 */
import { expect, test, type Page } from "@playwright/test";

import { BLOCK_REVEAL, REVEAL_LINE, REVEAL_TALL_RATIO } from "../../constants/revealConfig";
import {
  CATEGORY_PATH,
  PRODUCT_PATH,
  engineReady,
  missingCredentials,
  openRoute,
  revealContract,
  routesFor,
  scrollEndToEnd,
  settle,
  signInAs,
  unrevealedAboveLine,
  type Role,
} from "./helpers/uiBoost";

const STATE = "data-reveal-state";
const ROLES = [
  ["visitor", "storefront"],
  ["mechanic", "mechanics portal"],
  ["customer", "account"],
  ["admin", "admin"],
] as const;
/** Everything the rule owes must be showing this long after the engine has started. */
const PROMPT_MS = 2500;

const twoFrames = (page: Page) =>
  page.evaluate(
    () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve))),
  );

test.describe("reveal rule on real pages", () => {
  for (const path of ["/", "/delovi", CATEGORY_PATH]) {
    test(`a block on ${path} reveals only after its centre crosses the line`, async ({ page }) => {
      await page.goto(path, { waitUntil: "load" });
      await settle(page);
      await engineReady(page);

      // The first pending block that is below the fold, not tall, and far enough from the end
      // of the page to reach the line by scrolling.
      const index = await page.evaluate(
        ({ attr, tall, line }) => {
          const blocks = [...document.querySelectorAll<HTMLElement>(`[${attr}="pending"]`)];
          const viewport = window.innerHeight;
          const end = document.documentElement.scrollHeight;
          const pick = blocks.findIndex((el) => {
            if (!el.matches('[data-reveal="block"], [data-reveal="item"]')) return false;
            const rect = el.getBoundingClientRect();
            const centre = rect.top + window.scrollY + rect.height / 2;
            return (
              rect.height > 0 &&
              rect.height < viewport * tall &&
              rect.top > viewport &&
              centre < end - viewport * (1 - line) - 80
            );
          });
          if (pick >= 0) blocks[pick]?.setAttribute("data-e2e-reveal-probe", "");
          return pick;
        },
        { attr: STATE, tall: REVEAL_TALL_RATIO, line: REVEAL_LINE },
      );
      expect(index, "a pending block below the fold exists").toBeGreaterThanOrEqual(0);
      const probe = page.locator("[data-e2e-reveal-probe]");

      // Layout position (offsetTop chain): a running block is lifted by a transform, which
      // the trigger rule does not look at.
      const measure = () =>
        probe.evaluate((el, line) => {
          let top = 0;
          for (let node: HTMLElement | null = el as HTMLElement; node;) {
            top += node.offsetTop;
            node = node.offsetParent as HTMLElement | null;
          }
          const height = (el as HTMLElement).offsetHeight;
          return {
            top: top - window.scrollY,
            centre: top - window.scrollY + height / 2,
            lineY: window.innerHeight * (1 - line),
            opacity: Number(getComputedStyle(el).opacity),
          };
        }, REVEAL_LINE);
      /** Scrolls until the block's centre sits `offset` px below (+) or above (−) the line. */
      const place = async (offset: number) => {
        for (let attempt = 0; attempt < 4; attempt++) {
          const now = await measure();
          const delta = now.centre - now.lineY - offset;
          if (Math.abs(delta) < 1) break;
          await page.evaluate((by) => window.scrollBy({ top: by, behavior: "instant" }), delta);
          await twoFrames(page);
        }
        await twoFrames(page);
      };

      // On screen, top above the line, centre 24 px below it: still hidden.
      await place(24);
      const before = await measure();
      expect(before.top).toBeLessThan(before.lineY);
      expect(before.centre).toBeGreaterThan(before.lineY);
      await expect(probe).toHaveAttribute(STATE, "pending");
      expect(before.opacity).toBe(0);

      // Centre 6 px above the line: it starts, and ends fully visible.
      await place(-6);
      const after = await measure();
      expect(after.centre).toBeLessThan(after.lineY);
      await expect(probe).toHaveAttribute(STATE, /running|done/);
      await expect(probe).toHaveAttribute(STATE, "done", { timeout: 3000 });
      expect((await measure()).opacity).toBe(1);
      console.log(
        `reveal line ${path}: hidden with the centre ${Math.round(before.centre - before.lineY)} px below the line (${Math.round(before.lineY)} px of ${page.viewportSize()?.height}), started ${Math.round(after.lineY - after.centre)} px above it`,
      );
    });
  }

  for (const path of ["/delovi", CATEGORY_PATH, "/"]) {
    test(`grid items on ${path} start one after another, in document order`, async ({ page }) => {
      await page.goto(path, { waitUntil: "load" });
      await settle(page);
      await engineReady(page);
      const groups = await page.evaluate(
        ({ attr, delayVar, groupAttr }) => {
          type Entry = { group: number; index: number; delay: number };
          const log: Entry[] = [];
          (window as unknown as { __starts: Entry[] }).__starts = log;
          const all = [...document.querySelectorAll<HTMLElement>(`[${groupAttr}]`)];
          new MutationObserver((mutations) => {
            for (const mutation of mutations) {
              const el = mutation.target as HTMLElement;
              if (el.getAttribute(attr) !== "running") continue;
              const parent = el.parentElement;
              if (!parent || !el.matches('[data-reveal="item"]')) continue;
              log.push({
                group: all.indexOf(parent),
                index: [...parent.children].indexOf(el),
                delay: Number.parseInt(el.style.getPropertyValue(delayVar) || "0", 10),
              });
            }
          }).observe(document.body, { attributes: true, attributeFilter: [attr], subtree: true });
          // A regular grid: every item the same height, laid out in rows (not CSS columns,
          // where document order runs down each column, and not mixed heights, where centres
          // cross the line at different moments).
          return all.map((group) => {
            const heights = [...group.children].map((child) => (child as HTMLElement).offsetHeight);
            const pending = group.querySelectorAll(`:scope > [${attr}="pending"]`).length;
            const display = getComputedStyle(group).display;
            return {
              regular:
                (display === "grid" || display === "flex") &&
                heights.length > 1 &&
                heights.every((height) => Math.abs(height - (heights[0] ?? 0)) <= 2),
              pending,
            };
          });
        },
        { attr: STATE, delayVar: BLOCK_REVEAL.delayVar, groupAttr: BLOCK_REVEAL.attrs.group },
      );

      // A steady scroll, a fifth of the screen at a time.
      await page.evaluate(async () => {
        const step = Math.round(window.innerHeight / 5);
        for (let y = 0; y <= document.documentElement.scrollHeight; y += step) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 90));
        }
      });
      await page.waitForTimeout(900);

      const log = await page.evaluate(
        () =>
          (window as unknown as { __starts: { group: number; index: number; delay: number }[] })
            .__starts,
      );
      const byGroup = new Map<number, typeof log>();
      for (const entry of log)
        byGroup.set(entry.group, [...(byGroup.get(entry.group) ?? []), entry]);
      let regularGrids = 0;
      let staggered = 0;
      for (const [group, entries] of byGroup) {
        const order = entries.map((entry) => entry.index);
        expect(new Set(order).size, `group ${group}: each item starts once`).toBe(order.length);
        // A batch (the items that crossed the line together) starts with a delay of 0; inside
        // it every later item is later in the document and waits longer, within the budget.
        for (let i = 1; i < entries.length; i++) {
          const previous = entries[i - 1];
          const current = entries[i];
          if (!previous || !current || current.delay === 0) continue;
          expect(current.index, `group ${group}: document order inside a batch`).toBeGreaterThan(
            previous.index,
          );
          expect(current.delay, `group ${group}: stagger inside a batch`).toBeGreaterThan(
            previous.delay,
          );
          expect(current.delay).toBeLessThanOrEqual(BLOCK_REVEAL.default.budgetMs);
          staggered += 1;
        }
        // A regular grid starts in document order from the first card to the last.
        if (groups[group]?.regular && entries.length >= 2) {
          expect(order, `regular grid ${group} starts in document order`).toEqual(
            [...order].sort((a, b) => a - b),
          );
          regularGrids += 1;
        }
      }
      expect(regularGrids, "a regular grid revealed in document order").toBeGreaterThan(0);
      console.log(
        `reveal order ${path}: ${log.length} items in ${byGroup.size} groups; ${regularGrids} regular grids in full document order, ${staggered} staggered starts inside batches`,
      );
    });
  }
});

test.describe("reveal on every main route", () => {
  test.setTimeout(15 * 60_000);

  for (const [role, title] of ROLES) {
    test(`${title}: a direct visit shows its first screen at once, the bottom leaves nothing hidden`, async ({
      page,
    }, testInfo) => {
      test.skip(missingCredentials(role) !== null, missingCredentials(role) ?? "");
      const width = testInfo.project.use.viewport?.width;
      await signInAs(page, role as Role);
      const state = { cartReady: false };
      const problems: string[] = [];
      for (const route of routesFor(role)) {
        await openRoute(page, route, state);
        // Opened directly (a deep link): everything whose centre is above the line is showing
        // as soon as the engine has started — nothing waits for a scroll or for the failsafe.
        const started = Date.now();
        let owed: string[] = [];
        await expect
          .poll(async () => (owed = await unrevealedAboveLine(page)).length, {
            timeout: PROMPT_MS,
            intervals: [50, 100, 150],
          })
          .toBe(0)
          .catch(() => undefined);
        const prompt = Date.now() - started;
        const first = await revealContract(page);

        await scrollEndToEnd(page);
        const contract = await revealContract(page);
        console.log(
          `reveal ${route.name}@${width}: first screen owed ${owed.length} (${prompt} ms after the engine started, failsafe ${first.failsafe ? "fired" : "no"}) · after scrolling to the bottom: hidden ${contract.hidden.length} · pending ${contract.pending} · running ${contract.running} · leftover words ${contract.words}`,
        );
        if (owed.length || first.failsafe) {
          problems.push(
            `${route.name} first screen: ${owed.join(" | ")} failsafe=${first.failsafe}`,
          );
        }
        if (contract.hidden.length || contract.pending || contract.running || contract.words) {
          problems.push(`${route.name} bottom: ${JSON.stringify(contract)}`);
        }
      }
      expect(problems).toEqual([]);
    });

    test(`${title}: reduced motion shows everything at once`, async ({ page }, testInfo) => {
      test.skip(missingCredentials(role) !== null, missingCredentials(role) ?? "");
      const width = testInfo.project.use.viewport?.width;
      await page.emulateMedia({ reducedMotion: "reduce" });
      await signInAs(page, role as Role);
      const state = { cartReady: false };
      const problems: string[] = [];
      for (const route of routesFor(role)) {
        await openRoute(page, route, state);
        // No scrolling at all: nothing on the page may be hidden, waiting or moving.
        const contract = await revealContract(page);
        const animated = await page.evaluate(
          () =>
            [
              ...document.querySelectorAll<HTMLElement>("[data-reveal-eager], [data-reveal-state]"),
            ].filter((el) => getComputedStyle(el).animationName !== "none").length,
        );
        console.log(
          `reveal reduced motion ${route.name}@${width}: hidden ${contract.hidden.length} · pending ${contract.pending} · running ${contract.running} · animated ${animated}`,
        );
        if (contract.hidden.length || contract.pending || contract.running || animated) {
          problems.push(`${route.name}: ${JSON.stringify({ ...contract, animated })}`);
        }
      }
      expect(problems).toEqual([]);
    });
  }
});

test.describe("deep links and back navigation", () => {
  test.setTimeout(10 * 60_000);

  test("before any script runs a deep link shows its heading and first-screen blocks", async ({
    page,
  }, testInfo) => {
    const width = testInfo.project.use.viewport?.width;
    // No external script ever arrives: only the server HTML, the inline stylesheet and the
    // inline boot script. The heading (RevealText) and the eager blocks start from a visible
    // frame; the rest of the copy is the engine's to reveal.
    await page.route("**/*.js", (route) => route.abort());
    const problems: string[] = [];
    for (const route of routesFor("visitor").filter((r) => !r.cart)) {
      await page.goto(route.path, { waitUntil: "domcontentloaded" });
      const seen = await page.evaluate(() => {
        const opacity = (el: Element) => {
          for (let node: Element | null = el; node; node = node.parentElement) {
            if (Number(getComputedStyle(node).opacity) === 0) return 0;
          }
          return 1;
        };
        const inView = (el: Element) => {
          const rect = el.getBoundingClientRect();
          return rect.bottom > 0 && rect.top < window.innerHeight && rect.width > 0;
        };
        const heading = document.querySelector("main h1");
        const eager = [...document.querySelectorAll("[data-reveal-eager]")].filter(inView);
        return {
          heading: heading ? opacity(heading) : -1,
          eager: eager.length,
          eagerHidden: eager.filter((el) => opacity(el) === 0).length,
          failsafe: document.documentElement.classList.contains("tr-failsafe"),
        };
      });
      console.log(
        `reveal no-script ${route.name}@${width}: h1 ${seen.heading === 1 ? "visible" : seen.heading === 0 ? "HIDDEN" : "missing"} · eager blocks on the first screen ${seen.eager}, hidden ${seen.eagerHidden}${seen.failsafe ? " (failsafe already fired)" : ""}`,
      );
      if (seen.heading !== 1 || seen.eagerHidden > 0) {
        problems.push(`${route.name}: ${JSON.stringify(seen)}`);
      }
    }
    expect(problems).toEqual([]);
  });

  for (const [path, id] of [
    ["/", "faq-title"],
    ["/delovi", "sys-kocnice"],
    [PRODUCT_PATH, "related-title"],
  ] as const) {
    test(`an anchor deep into ${path} lands on visible content`, async ({ page }) => {
      const started = Date.now();
      await page.goto(`${path}#${id}`, { waitUntil: "load" });
      await engineReady(page);
      await expect
        .poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5000 })
        .toBeGreaterThan(200);
      await expect
        .poll(() => unrevealedAboveLine(page), { timeout: PROMPT_MS, intervals: [50, 100, 150] })
        .toEqual([]);
      const elapsed = Date.now() - started;
      const contract = await revealContract(page);
      expect(contract.failsafe, "shown by the engine, not by the 3.5 s failsafe").toBe(false);
      // The target itself is on screen and readable.
      const target = page.locator(`#${id}`);
      await expect(target).toBeInViewport();
      expect(await target.evaluate((el) => getComputedStyle(el).opacity)).toBe("1");
      const scrolled = await page.evaluate(() => Math.round(window.scrollY));
      console.log(
        `reveal anchor ${path}#${id}: landed at ${scrolled} px, everything above the line visible ${elapsed} ms after the navigation started`,
      );
    });
  }

  test("going back shows the content at the restored position without waiting", async ({
    page,
  }) => {
    for (const path of ["/", CATEGORY_PATH]) {
      await page.goto(path, { waitUntil: "load" });
      await settle(page);
      await engineReady(page);
      // Half way down, so there is content above and below the restored position.
      await page.evaluate(async () => {
        const target = Math.round(
          (document.documentElement.scrollHeight - window.innerHeight) * 0.5,
        );
        for (let y = 0; y <= target; y += Math.round(window.innerHeight * 0.6)) {
          window.scrollTo(0, y);
          await new Promise((resolve) => setTimeout(resolve, 120));
        }
        window.scrollTo(0, target);
      });
      await page.waitForTimeout(900);
      const left = await page.evaluate(() => Math.round(window.scrollY));

      // A product or category link that is on screen now.
      const href = await page.evaluate(() => {
        const link = [...document.querySelectorAll<HTMLAnchorElement>("main a[href^='/de']")].find(
          (a) => {
            const rect = a.getBoundingClientRect();
            return rect.top > 80 && rect.bottom < window.innerHeight - 100 && rect.width > 0;
          },
        );
        return link?.getAttribute("href") ?? null;
      });
      expect(href, `a catalog link is on screen half way down ${path}`).not.toBeNull();
      await page.locator(`main a[href="${href}"]`).first().click();
      await page.waitForURL((url) => url.pathname === new URL(href ?? "/", url).pathname);
      await settle(page);

      const started = Date.now();
      await page.goBack({ waitUntil: "commit" });
      await page.waitForURL((url) => url.pathname === new URL(path, url).pathname);
      await expect
        .poll(() => page.evaluate(() => Math.round(window.scrollY)), { timeout: 5000 })
        .toBeGreaterThan(0);
      await expect
        .poll(() => unrevealedAboveLine(page), { timeout: PROMPT_MS, intervals: [50, 100, 150] })
        .toEqual([]);
      const elapsed = Date.now() - started;
      const contract = await revealContract(page);
      expect(contract.failsafe, "shown by the engine, not by the 3.5 s failsafe").toBe(false);
      const restored = await page.evaluate(() => Math.round(window.scrollY));
      console.log(
        `reveal back ${path}: left at ${left} px, restored at ${restored} px, everything above the line visible ${elapsed} ms after going back`,
      );
    }
  });

  test("going back in the admin shows the list without waiting", async ({ page }) => {
    test.skip(missingCredentials("admin") !== null, missingCredentials("admin") ?? "");
    await signInAs(page, "admin");
    await openRoute(
      page,
      { name: "orders", path: "/admin/porudzbine", role: "admin" },
      { cartReady: false },
    );
    const row = page.locator("tr[data-row]").first();
    await row.waitFor({ timeout: 30_000 });
    await row.focus();
    await page.keyboard.press("Enter");
    await page.waitForURL((url) => /^\/admin\/porudzbine\/.+/.test(url.pathname), {
      waitUntil: "commit",
    });
    await settle(page);

    const started = Date.now();
    await page.goBack({ waitUntil: "commit" });
    await page.waitForURL((url) => url.pathname === "/admin/porudzbine");
    await page.locator("tr[data-row]").first().waitFor({ timeout: 30_000 });
    await expect
      .poll(() => unrevealedAboveLine(page), { timeout: PROMPT_MS, intervals: [50, 100, 150] })
      .toEqual([]);
    const contract = await revealContract(page);
    expect(contract.failsafe).toBe(false);
    console.log(
      `reveal back /admin/porudzbine: rows visible ${Date.now() - started} ms after going back`,
    );
  });
});
