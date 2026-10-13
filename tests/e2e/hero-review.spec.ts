/**
 * The 3D hero after the owner's review (docs/3d/HERO-V2.md §18.5, step 32), at 1440 and 390:
 * - every docked part reads on the night field — the five the owner named are measured from the
 *   pixels — with no frame and no background behind it;
 * - the note „Generički kompaktni hečbek…“ never has the car or a part under it, and the car is
 *   never cut by the top of the frame: every stage and every flight, by the scene's own outline;
 * - from 1280 px the navigator shows all ten chips whole, does not scroll and has no edge fade,
 *   whatever the counts read („13/13“ included); a chip never changes width;
 * - the end state ranks its three actions: primary, secondary, quiet;
 * - part ↔ name drift stays within 4 px after a resize, a late font and a dialog or drawer
 *   (HERO-V2 §14, the gap of §18.4);
 * - a slow model download: thumbnails first, then the 3D in their place, with nothing moving
 *   (the other gap of §18.4);
 * - keyboard and touch reach every chip and every slot.
 *
 * Needs a build with test hooks: NEXT_PUBLIC_TEST_HOOKS=1 (set by playwright.config.ts).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type Route, type TestInfo } from "@playwright/test";
import sharp from "sharp";

import { TEST_IDS } from "@/constants/testIds";
import { CAR_IN_POSTER, POSTER_ASPECT, framingFor, posterFrame } from "@/lib/three/framing";
// Brings the `window.__sklop3d` declaration (type only; nothing is imported at runtime).
import type {} from "@/components/three/testHooks";

/** Slots of each page and how many of them are meshes (page 6 has two thumbnail slots). */
const PAGES = [
  { slots: 7, meshes: 7 },
  { slots: 9, meshes: 9 },
  { slots: 8, meshes: 8 },
  { slots: 6, meshes: 6 },
  { slots: 7, meshes: 7 },
  { slots: 7, meshes: 5 },
] as const;
/** Navigator chips in order, with the pages their system sits on. */
const CHIPS = [
  { system: "karoserija", pages: [1] },
  { system: "elektrika-i-svetla", pages: [2] },
  { system: "tockovi", pages: [2] },
  { system: "kocnice", pages: [2] },
  { system: "vesanje-i-upravljanje", pages: [3] },
  { system: "hladjenje-i-klima", pages: [3] },
  { system: "motor-i-usis", pages: [4, 5] },
  { system: "transmisija", pages: [6] },
  { system: "izduvni-sistem", pages: [6] },
  { system: "servis", pages: [6] },
] as const;
/** The parts the owner could not see, by the page they dock on. */
const NAMED: Record<number, string[]> = {
  2: ["akumulator", "kocione-plocice", "kocione-celjusti"],
  3: ["termostat-creva"],
  6: ["ulja-tecnosti"],
};

const PAGE_FIRST = 0.06;
const PAGE_LENGTH = 0.88 / 6;
const pageStart = (page: number) => PAGE_FIRST + (page - 1) * PAGE_LENGTH;

const isMobile = (testInfo: TestInfo) => testInfo.project.name.startsWith("mobile");
/** The tier this device class gets on real hardware (headless WebGL is the software renderer). */
const liveTier = (testInfo: TestInfo) => (isMobile(testInfo) ? "mid" : "high");

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(`pageerror: ${error.message}`));
  return errors;
}

async function startAndWaitFor3d(page: Page) {
  await page.waitForFunction(() => Boolean(window.__sklop3d));
  await page.evaluate(() => window.scrollTo(0, 80));
  await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
  await page.evaluate(() => window.scrollTo(0, 0));
}

const state = (page: Page) => page.evaluate(() => window.__sklop3d!.getState());

/** Parts found at each page's rest (HERO-V2 §4). */
const FOUND = [7, 16, 24, 30, 37, 44] as const;

/**
 * 0 the assembled car · 1 … 6 a page at rest · 7 the end state. The jump is repeated until the
 * store is there: a layout change (a resize, a dialog locking the scroll) refreshes the scroll
 * measurements a moment later and can move the progress under a jump made too early.
 */
async function goToStage(page: Page, stage: number) {
  await expect
    .poll(
      async () => {
        const now = await state(page);
        const there =
          stage === 0
            ? now.page === 0 && now.progress === 0
            : stage === 7
              ? now.ended && now.found === 44
              : now.page === stage && now.found === FOUND[stage - 1] && !now.ended;
        if (!there) {
          await page.evaluate((s) => {
            const hooks = window.__sklop3d!;
            if (s === 0) hooks.explode(0);
            else if (s === 7) hooks.explode(1);
            else hooks.page(s);
          }, stage);
        }
        return there;
      },
      { timeout: 30_000, message: `stage ${stage}` },
    )
    .toBe(true);
}

/** Largest distance between where the scene rests a part and the cell and name the DOM has now. */
const drift = (page: Page) =>
  page.evaluate(() => {
    const canvas = document.querySelector('[data-testid="hero-canvas"]')!.getBoundingClientRect();
    let cell = 0;
    let name = 0;
    let drawn = 0;
    let count = 0;
    for (const slot of window.__sklop3d!.slots()) {
      const box = document
        .querySelector(`[data-page-active] [data-cell="${slot.slug}"]`)
        ?.getBoundingClientRect();
      const label = document
        .querySelector(`[data-page-active] [data-slot="${slot.slug}"] [data-label]`)
        ?.getBoundingClientRect();
      if (!box || !label) continue;
      count += 1;
      const cx = box.left + box.width / 2;
      const cy = box.top + box.height / 2;
      cell = Math.max(cell, Math.hypot(slot.rx + canvas.left - cx, slot.ry + canvas.top - cy));
      name = Math.max(name, Math.abs(slot.rx + canvas.left - (label.left + label.width / 2)));
      drawn = Math.max(drawn, Math.hypot(slot.cx + canvas.left - cx, slot.cy + canvas.top - cy));
    }
    return { cell, name, drawn, count };
  });

/** Polls until the page's meshes are docked on the cells the DOM has now. */
async function expectDocked(page: Page, meshes: number, what: string) {
  await expect
    .poll(
      async () => {
        // Still at the page's rest (see goToStage): otherwise a part is in flight, not adrift.
        const now = await state(page);
        if (now.page >= 1 && now.found !== FOUND[now.page - 1]) {
          await page.evaluate((n) => window.__sklop3d!.page(n), now.page);
          return `page ${now.page} is not at rest`;
        }
        const d = await drift(page);
        if (d.count !== meshes) return `${d.count} docked`;
        // 4 px for the seat (HERO-V2 §14); the float is a ±3 px bob on top of it
        if (d.cell > 4) return `part ${d.cell.toFixed(1)} px from its cell`;
        if (d.name > 4) return `part ${d.name.toFixed(1)} px from its name`;
        if (d.drawn > 8) return `drawn part ${d.drawn.toFixed(1)} px from its cell`;
        return "docked";
      },
      { timeout: 30_000, message: what },
    )
    .toBe("docked");
}

/** The first opaque background above the hero: the field the scene is drawn on. */
const fieldColour = (page: Page) =>
  page.evaluate(() => {
    for (
      let el: Element | null = document.querySelector('[data-testid="hero-track"]');
      el;
      el = el.parentElement
    ) {
      const m = getComputedStyle(el).backgroundColor.match(/[\d.]+/g);
      if (m && (m.length < 4 || Number(m[3]) === 1)) return m.slice(0, 3).map(Number);
    }
    return [13, 15, 17];
  });

const linear = (channel: number) => {
  const v = channel / 255;
  return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (r: number, g: number, b: number) =>
  0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

test.describe("3D hero — owner review", () => {
  test("docked parts read on the night field, with no frame or background", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    const errors = collectErrors(page);
    await page.goto(`/?3d=${liveTier(testInfo)}`);
    await startAndWaitFor3d(page);
    const field = await fieldColour(page);
    const fieldLum = luminance(field[0], field[1], field[2]);
    const differs = (data: Buffer, i: number, by: number) =>
      Math.max(
        Math.abs(data[i] - field[0]),
        Math.abs(data[i + 1] - field[1]),
        Math.abs(data[i + 2] - field[2]),
      ) > by;

    for (const [number, slugs] of Object.entries(NAMED)) {
      const stage = Number(number);
      await goToStage(page, stage);
      await expectDocked(page, PAGES[stage - 1].meshes, `page ${stage}`);
      // The names arrive over 300 ms; a thumbnail slot waits for its picture.
      await expect
        .poll(() =>
          page
            .locator("[data-page-active] [data-cell] img")
            .evaluateAll((images) =>
              images.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0),
            ),
        )
        .toBe(true);
      await page.waitForTimeout(600);
      for (const slug of slugs) {
        const cell = page.locator(`[data-page-active] [data-cell="${slug}"]`);
        const { data, info } = await sharp(await cell.screenshot())
          .raw()
          .toBuffer({ resolveWithObject: true });
        const lums: number[] = [];
        let edge = 0;
        let edgeLit = 0;
        for (let y = 0; y < info.height; y += 1) {
          for (let x = 0; x < info.width; x += 1) {
            const i = (y * info.width + x) * info.channels;
            if (differs(data, i, 8)) lums.push(luminance(data[i], data[i + 1], data[i + 2]));
            if (x === 0 || y === 0 || x === info.width - 1 || y === info.height - 1) {
              edge += 1;
              if (differs(data, i, 6)) edgeLit += 1;
            }
          }
        }
        lums.sort((a, b) => a - b);
        const share = lums.length / (info.width * info.height);
        const median = lums[Math.floor(lums.length / 2)] ?? 0;
        const contrast = (median + 0.05) / (fieldLum + 0.05);
        // The part is there and large…
        expect(share, `${slug} fills its cell`).toBeGreaterThan(0.12);
        // …the middle of its tones stands 3:1 off the field (WCAG 1.4.11 for a graphic)…
        expect(contrast, `${slug} against the field`).toBeGreaterThanOrEqual(3);
        // …and the cell has no frame and no background: its own edge is the field.
        expect(edgeLit / edge, `${slug} has no box around it`).toBeLessThan(0.02);
      }
      await page.screenshot({ path: testInfo.outputPath(`hero-dark-parts-${stage}.png`) });
    }
    expect(errors).toEqual([]);
  });

  test("the note never lies on the car or a part, and the car is never cut at the top", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    const errors = collectErrors(page);
    const mobile = isMobile(testInfo);
    await page.goto(`/?3d=${liveTier(testInfo)}`);
    await startAndWaitFor3d(page);

    const look = () =>
      page.evaluate(() => {
        const canvas = document.querySelector('[data-testid="hero-canvas"]')!.getBoundingClientRect();
        const shown = (el: Element | null) => {
          if (!el) return false;
          const r = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          return r.width > 0 && r.height > 0 && style.visibility !== "hidden";
        };
        const notes = [...document.querySelectorAll("[data-hero-honesty]")].filter(shown).map((el) => {
          // The text itself: the paragraph's own box is the full row.
          const range = document.createRange();
          range.selectNodeContents(el);
          const r = range.getBoundingClientRect();
          return {
            left: r.left - canvas.left,
            top: r.top - canvas.top,
            right: r.right - canvas.left,
            bottom: r.bottom - canvas.top,
          };
        });
        return {
          notes,
          titleBlock: shown(document.querySelector("[data-hero-title-block]")),
          outline: window.__sklop3d!.car(),
          height: canvas.height,
        };
      });
    type Box = { left: number; top: number; right: number; bottom: number };
    const meet = (a: Box, b: Box) =>
      a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

    // Every stage at rest, and every page's flight at eight points.
    const points: { name: string; progress: number | null; stage: number }[] = [];
    for (let stage = 0; stage <= 7; stage += 1) points.push({ name: `stage ${stage}`, progress: null, stage });
    for (let p = 1; p <= 6; p += 1) {
      for (const u of [0.05, 0.14, 0.2, 0.26, 0.32, 0.4, 0.48, 0.56]) {
        points.push({ name: `page ${p} at ${u}`, progress: pageStart(p) + u * PAGE_LENGTH, stage: p });
      }
    }
    // …and the car backing into its band.
    for (const progress of [0.015, 0.03, 0.045, 0.058]) {
      points.push({ name: `dock ${progress}`, progress, stage: 0 });
    }

    for (const point of points) {
      if (point.progress === null) await goToStage(page, point.stage);
      else {
        await page.evaluate((p) => window.__sklop3d!.explode(p), point.progress);
        await expect
          .poll(async () => Math.abs((await state(page)).progress - point.progress!))
          .toBeLessThan(0.002);
      }
      // One note on screen (from 1440 px the assembled car carries it in its title block, which
      // takes 200 ms to hand over).
      await expect
        .poll(async () => {
          const now = await look();
          return now.notes.length + (now.titleBlock ? 1 : 0);
        }, { message: `${point.name}: one note` })
        .toBe(1);
      const seen = await look();
      const { outline } = seen;
      expect(outline, point.name).not.toBeNull();
      // Not cut: what is on the car, and what is leaving it, stays under the frame's top edge.
      if (outline!.car) expect(outline!.car.top, `${point.name}: the car's top`).toBeGreaterThanOrEqual(1);
      if (outline!.flight) {
        expect(outline!.flight.top, `${point.name}: a part in flight`).toBeGreaterThanOrEqual(0);
      }
      for (const note of seen.notes) {
        if (outline!.car) expect(meet(note, outline!.car), `${point.name}: the note on the car`).toBe(false);
        if (outline!.flight) {
          expect(meet(note, outline!.flight), `${point.name}: the note on a part`).toBe(false);
        }
        if (mobile && point.stage > 0 && outline!.car) {
          // Docked on a phone: the note has the line above the car.
          expect(note.bottom, `${point.name}: the note is above the car`).toBeLessThanOrEqual(outline!.car.top);
        }
      }
    }
    expect(errors).toEqual([]);
  });

  test("the navigator shows every chip whole from 1280 px: no scroll, no fade, steady widths", async ({
    page,
  }, testInfo) => {
    test.setTimeout(240_000);
    const mobile = isMobile(testInfo);
    // No canvas needed: the row is DOM, and without one a stage is there at once.
    await page.goto("/?3d=low");
    await page.waitForFunction(() => Boolean(window.__sklop3d));
    const row = () =>
      page.evaluate(() => {
        const list = document.querySelector<HTMLElement>('[data-testid="hero-nav"] nav ol')!;
        const box = list.getBoundingClientRect();
        const chips = [...list.querySelectorAll<HTMLElement>("button[data-system]")].map((chip) => {
          const r = chip.getBoundingClientRect();
          return { system: chip.dataset.system!, text: chip.innerText.replace(/\s+/g, " ").trim(), left: r.left, right: r.right, width: r.width, height: r.height };
        });
        return {
          over: list.scrollWidth - list.clientWidth,
          scrollLeft: list.scrollLeft,
          fade: list.dataset.fade,
          mask: getComputedStyle(list).maskImage,
          left: box.left,
          right: box.right,
          chips,
        };
      });

    if (mobile) {
      // A phone's row scrolls; an edge fades only where chips are hidden behind it.
      await goToStage(page, 0);
      const start = await row();
      expect(start.over).toBeGreaterThan(0);
      expect(start.fade).toBe("end");
      expect(start.chips[0].left).toBeGreaterThanOrEqual(start.left - 0.5);
      // A cluster wider than the row starts at the row's start: its first chip is whole.
      for (const [stage, first] of [
        [2, "elektrika-i-svetla"],
        [3, "vesanje-i-upravljanje"],
        [7, "transmisija"],
      ] as const) {
        await goToStage(page, stage);
        await expect
          .poll(
            async () => {
              const now = await row();
              const chip = now.chips.find((c) => c.system === first)!;
              return chip.left >= now.left - 0.5 && chip.right <= now.right + 0.5 && now.fade !== "none" && now.fade !== "end";
            },
            { timeout: 10_000, message: `stage ${stage}: ${first} is whole and the row has moved` },
          )
          .toBe(true);
      }
      for (const chip of (await row()).chips) expect(chip.height, chip.system).toBeGreaterThanOrEqual(44);
      return;
    }

    for (const [width, height] of [
      [1280, 720],
      [1280, 800],
      [1366, 768],
      [1440, 900],
      [1920, 1080],
    ]) {
      await page.setViewportSize({ width, height });
      let widths: number[] | null = null;
      for (let stage = 0; stage <= 7; stage += 1) {
        await goToStage(page, stage);
        const now = await row();
        const at = `${width}×${height}, stage ${stage}`;
        expect(now.chips, at).toHaveLength(10);
        expect(now.over, `${at}: the row does not scroll`).toBeLessThanOrEqual(0);
        expect(now.fade, `${at}: no edge fade`).toBe("none");
        expect(now.mask, `${at}: no mask`).toBe("none");
        for (const [index, chip] of now.chips.entries()) {
          expect(chip.left, `${at}: ${chip.system} starts inside the row`).toBeGreaterThanOrEqual(now.left - 0.5);
          expect(chip.right, `${at}: ${chip.system} ends inside the row`).toBeLessThanOrEqual(now.right + 0.5);
          if (index > 0) expect(chip.left, `${at}: ${chip.system} clear of its neighbour`).toBeGreaterThanOrEqual(now.chips[index - 1].right);
        }
        // A chip keeps its width whatever its count reads, so the row is laid out once.
        const current = now.chips.map((chip) => chip.width);
        if (widths) {
          for (const [index, value] of current.entries()) {
            expect(Math.abs(value - widths[index]), `${at}: ${now.chips[index].system} keeps its width`).toBeLessThan(0.1);
          }
        }
        widths = current;
        const text = (system: string) => now.chips.find((chip) => chip.system === system)?.text ?? "";
        if (stage === 2) {
          expect(text("elektrika-i-svetla")).toContain("4/4");
          expect(text("tockovi")).toContain("1/1");
          expect(text("kocnice")).toContain("4/4");
        }
        if (stage === 4) expect(text("motor-i-usis")).toContain("6/13");
        if (stage === 5) expect(text("motor-i-usis")).toContain("13/13");
        if (stage === 6) expect(text("transmisija")).toContain("3/3");
      }
    }
  });

  test("the end state ranks its actions: primary, secondary, quiet", async ({ page }, testInfo) => {
    const errors = collectErrors(page);
    await page.goto("/?3d=low");
    await page.waitForFunction(() => Boolean(window.__sklop3d));
    await goToStage(page, 7);
    const end = page.getByTestId(TEST_IDS.heroEnd);
    await expect(end).toBeVisible();
    await expect(end).toContainText("Ceo auto rastavljen");

    const vehicle = end.getByRole("button", { name: "Izaberite vozilo" });
    const all = end.getByRole("link", { name: "Svi delovi" });
    const assemble = end.getByRole("button", { name: "Sklopi auto" });
    await expect(vehicle).toBeVisible();
    await expect(all).toHaveAttribute("href", "/delovi");
    await expect(assemble).toHaveAttribute("data-testid", TEST_IDS.heroAssemble);

    const look = (locator: typeof vehicle) =>
      locator.evaluate((el) => {
        const style = getComputedStyle(el);
        const box = el.getBoundingClientRect();
        return { bg: style.backgroundColor, border: style.borderTopWidth, x: box.left, w: box.width, h: box.height, classes: el.className };
      });
    const [primary, secondary, quiet] = await Promise.all([look(vehicle), look(all), look(assemble)]);
    // Primary: the accent fill (the search button of the same hero is the reference).
    const accent = await page
      .getByTestId("home-hero")
      .getByRole("button", { name: "Pretraži" })
      .first()
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(primary.bg).toBe(accent);
    expect(primary.classes).toContain("bg-accent");
    // Secondary: an outline on the field. Quiet: a filled surface.
    expect(secondary.bg).toBe("rgba(0, 0, 0, 0)");
    expect(secondary.border).toBe("1px");
    expect(secondary.classes).toContain("border-control");
    expect(quiet.classes).toContain("bg-surface-3");
    expect(quiet.bg).not.toBe("rgba(0, 0, 0, 0)");
    expect(quiet.bg).not.toBe(accent);
    // In that order, each a full touch target.
    expect(primary.x).toBeLessThan(secondary.x);
    expect(secondary.x).toBeLessThan(quiet.x);
    for (const button of [primary, secondary, quiet]) {
      expect(button.h).toBeGreaterThanOrEqual(44);
      expect(button.w).toBeGreaterThanOrEqual(44);
    }
    if (!isMobile(testInfo)) await expect(assemble).toContainText("Sklopi auto");

    const results = await new AxeBuilder({ page })
      .include('[data-testid="home-hero"]')
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
    ).toEqual([]);

    // The primary opens the vehicle picker; the quiet one puts the car back together.
    await vehicle.click();
    await expect(page.getByRole("dialog").first()).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toHaveCount(0);
    await assemble.click();
    await expect.poll(async () => (await state(page)).progress, { timeout: 30_000 }).toBeLessThan(0.001);
    expect(errors).toEqual([]);
  });

  test("part ↔ name drift stays within 4 px after a resize, a late font and a drawer", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    const errors = collectErrors(page);
    const mobile = isMobile(testInfo);
    // The web fonts are held back: the page lays out with the fallback faces first.
    const held: Route[] = [];
    let holding = true;
    await page.route(/\.woff2(\?.*)?$/, (route) => {
      if (holding) held.push(route);
      else void route.continue();
    });
    // The font preloads keep `load` waiting, so do not wait for it.
    await page.goto(`/?3d=${liveTier(testInfo)}`, { waitUntil: "domcontentloaded" });
    await startAndWaitFor3d(page);
    expect(held.length, "font requests are held").toBeGreaterThan(0);
    // next/font also declares metric-matched fallback faces from local fonts; those are there.
    const webFontsLoaded = () =>
      page.evaluate(
        () =>
          [...document.fonts].filter((face) => face.status === "loaded" && !/fallback/i.test(face.family)).length,
      );
    expect(await webFontsLoaded()).toBe(0);

    await goToStage(page, 2);
    await expectDocked(page, 9, "page 2 with the fallback fonts");

    // A resize (the same layout class, another size) and back.
    // (The track's length follows the viewport: ScrollTrigger measures again 200 ms after the
    // resize, and the page is asked for once that has happened.)
    const original = page.viewportSize()!;
    await page.setViewportSize(mobile ? { width: 430, height: 932 } : { width: 1280, height: 800 });
    await page.waitForTimeout(600);
    await goToStage(page, 2);
    await expectDocked(page, 9, "after a resize");
    await page.setViewportSize(original);
    await page.waitForTimeout(600);
    await goToStage(page, 2);
    await expectDocked(page, 9, "after the resize back");

    // The fonts arrive late.
    holding = false;
    await Promise.all(held.map((route) => route.continue()));
    await expect.poll(webFontsLoaded, { timeout: 30_000 }).toBeGreaterThan(0);
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    await expectDocked(page, 9, "after the fonts loaded");

    // A modal dialog over the grid: the parts stay on their cells behind it.
    await page.getByTestId(TEST_IDS.partsListTrigger).click();
    const dialog = page.getByRole("dialog", { name: "Lista delova po sistemima" });
    await expect(dialog).toBeVisible();
    await expectDocked(page, 9, "with the parts list open");
    await page.keyboard.press("Escape");
    await expect(dialog).toBeHidden();
    await expectDocked(page, 9, "after the parts list closed");

    // The part panel (a drawer from 1024 px, a sheet on phones) opens and closes; the page that
    // comes back is on its cells again.
    expect(await page.evaluate(() => window.__sklop3d!.selectPart("kocioni-diskovi"))).toBe(true);
    const panel = page.getByTestId(TEST_IDS.partPanel);
    await expect(panel).toBeVisible();
    await page.waitForTimeout(700);
    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await goToStage(page, 2);
    await expectDocked(page, 9, "after the part panel closed");
    await goToStage(page, 3);
    await expectDocked(page, 8, "the next page after all of it");
    expect(errors).toEqual([]);
  });

  test("a slow model download: thumbnails first, then the 3D in their place, nothing moves", async ({
    page,
  }, testInfo) => {
    test.setTimeout(300_000);
    const errors = collectErrors(page);
    const mobile = isMobile(testInfo);
    // The model waits for us; everything else loads as usual.
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    await page.route(/\/models\/car(-lite)?\.glb(\?.*)?$/, async (route) => {
      await gate;
      await route.continue();
    });
    await page.addInitScript(() => {
      const shifts: { value: number; time: number }[] = [];
      (window as unknown as { __shifts: typeof shifts }).__shifts = shifts;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
          if (!entry.hadRecentInput) shifts.push({ value: entry.value, time: entry.startTime });
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    const thumbnails: string[] = [];
    page.on("request", (request) => {
      if (decodeURIComponent(request.url()).includes("/images/parts/")) thumbnails.push(request.url());
    });

    await page.goto(`/?3d=${liveTier(testInfo)}`);
    await page.waitForFunction(() => Boolean(window.__sklop3d));
    await page.evaluate(() => window.scrollTo(0, 80));
    await expect.poll(async () => (await state(page)).status).toBe("loading");

    // ------------------------------------------------ the car, while the poster stands in
    // Page 1 before its first part leaves: the car is in its band, whole — the one moment the
    // poster and the scene show the same thing.
    const reveal = pageStart(1) + 0.1 * PAGE_LENGTH;
    await page.evaluate((p) => window.__sklop3d!.explode(p), reveal);
    await expect.poll(async () => (await state(page)).page).toBe(1);
    expect(await state(page)).toMatchObject({ status: "loading", slotMode: "image", found: 0 });
    const poster = page.getByTestId(TEST_IDS.heroPoster);
    await expect(poster).toHaveCSS("opacity", "1");
    await expect(page.getByTestId(TEST_IDS.heroCanvas)).toHaveCSS("opacity", "0");
    // Where the poster has the car's bounding box (canvas px): its frame in the stage box, the
    // box inside that frame, through the transform that docks the poster.
    const posterCar = async () => {
      const geometry = await page.evaluate(() => {
        const el = document.querySelector<HTMLElement>('[data-testid="hero-poster"]')!;
        const canvas = document.querySelector('[data-testid="hero-canvas"]')!.getBoundingClientRect();
        const r = el.getBoundingClientRect();
        return { w: el.offsetWidth, h: el.offsetHeight, left: r.left - canvas.left, top: r.top - canvas.top, scale: r.width / el.offsetWidth };
      });
      const framing = framingFor(mobile, !mobile);
      const frame = posterFrame(POSTER_ASPECT[framing.crop], geometry.w, geometry.h, framing);
      const car = CAR_IN_POSTER[framing.crop];
      const x = (f: number) => geometry.left + geometry.scale * (frame.offsetX + f * frame.imageWidth);
      const y = (f: number) => geometry.top + geometry.scale * (frame.offsetY + f * frame.imageHeight);
      return { left: x(car.left), right: x(car.right), top: y(car.top), bottom: y(car.bottom) };
    };
    await expect.poll(async () => (await posterCar()).right - (await posterCar()).left).toBeGreaterThan(50);
    const before = await posterCar();

    // ------------------------------------------------ thumbnails first
    await goToStage(page, 2);
    const active = page.locator("[data-page-active]");
    await expect(active.locator("[data-slot][data-seated]")).toHaveCount(9);
    await expect(active.locator("[data-cell] img")).toHaveCount(9);
    await expect
      .poll(
        () =>
          active
            .locator("[data-cell] img")
            .evaluateAll((images) =>
              images.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0),
            ),
        { timeout: 30_000 },
      )
      .toBe(true);
    expect(await state(page)).toMatchObject({ status: "loading", slotMode: "image", page: 2, found: 16 });
    await expect(page.getByTestId(TEST_IDS.heroCanvas).locator("canvas")).toHaveCount(1);
    expect(thumbnails.length).toBeGreaterThanOrEqual(9);
    const rects = () =>
      page.evaluate(() =>
        [...document.querySelectorAll("[data-page-active] [data-cell], [data-page-active] [data-label], [data-hero-band], [data-hero-honesty]")].map((el) => {
          const r = el.getBoundingClientRect();
          return [r.left, r.top, r.width, r.height].map((v) => Math.round(v * 10) / 10);
        }),
      );
    await page.waitForTimeout(500);
    const rectsBefore = await rects();
    await page.screenshot({ path: testInfo.outputPath("hero-slow-model-thumbnails.png") });
    const swapFrom = await page.evaluate(() => performance.now());
    const thumbnailsBefore = thumbnails.length;

    // ------------------------------------------------ then the 3D
    release();
    await page.waitForFunction(() => window.__sklop3d?.ready === true, null, { timeout: 120_000 });
    await expect(page.getByTestId(TEST_IDS.heroCanvas)).toHaveCSS("opacity", "1", { timeout: 20_000 });
    await expect(poster).toHaveCSS("opacity", "0");
    expect(await state(page)).toMatchObject({ slotMode: "mesh", page: 2, found: 16 });
    // The meshes are where the thumbnails were, and the thumbnails are gone.
    await expect(active.locator("[data-cell] img")).toHaveCount(0);
    await expectDocked(page, 9, "meshes in the thumbnails' cells");
    const sizes = await page.evaluate(() => {
      const cell = document.querySelector("[data-page-active] [data-cell]")!.getBoundingClientRect();
      return { cell: cell.width, slots: window.__sklop3d!.slots().map((slot) => Math.max(slot.w, slot.h)) };
    });
    for (const size of sizes.slots) {
      expect(size).toBeGreaterThan(sizes.cell * 0.5);
      expect(size).toBeLessThanOrEqual(sizes.cell + 6);
    }
    // Nothing in the layout moved: the same boxes, and not one layout shift since the swap began.
    expect(await rects()).toEqual(rectsBefore);
    const shifted = await page.evaluate(
      (from) =>
        (window as unknown as { __shifts: { value: number; time: number }[] }).__shifts
          .filter((shift) => shift.time >= from)
          .reduce((sum, shift) => sum + shift.value, 0),
      swapFrom,
    );
    expect(shifted).toBe(0);
    await page.screenshot({ path: testInfo.outputPath("hero-slow-model-3d.png") });

    // With the 3D running the grid asks for no more thumbnails of its meshes.
    await goToStage(page, 3);
    await expectDocked(page, 8, "page 3");
    await page.waitForTimeout(500);
    expect(thumbnails.length).toBe(thumbnailsBefore);

    // ------------------------------------------------ and the car did not jump
    // Back at the same point of the track: the camera frames the car's box where the poster had it.
    await page.evaluate((p) => window.__sklop3d!.explode(p), reveal);
    await expect.poll(async () => Math.abs((await state(page)).progress - reveal)).toBeLessThan(0.002);
    const after = (await page.evaluate(() => window.__sklop3d!.car()))!.box;
    testInfo.annotations.push({ type: "car box, poster → scene", description: JSON.stringify({ before, after }) });
    expect(Math.abs((after.left + after.right) / 2 - (before.left + before.right) / 2)).toBeLessThan(3);
    expect(Math.abs((after.top + after.bottom) / 2 - (before.top + before.bottom) / 2)).toBeLessThan(3);
    // Both are fitted into the band by the side that binds (within 3 %). The other side may
    // differ by the change of lens: the docked camera is longer than the poster's (24° against
    // 28°), and a picture cannot change its perspective.
    const dw = Math.abs(after.right - after.left - (before.right - before.left)) / (before.right - before.left);
    const dh = Math.abs(after.bottom - after.top - (before.bottom - before.top)) / (before.bottom - before.top);
    expect(Math.min(dw, dh)).toBeLessThan(0.03);
    expect(Math.max(dw, dh)).toBeLessThan(0.08);
    expect(errors).toEqual([]);
  });

  test("keyboard and touch reach every chip and every slot", async ({ page }, testInfo) => {
    test.setTimeout(300_000);
    const errors = collectErrors(page);
    const mobile = isMobile(testInfo);
    // The grid and the navigator are DOM: the tier without a canvas answers at once.
    await page.goto("/?3d=low");
    await page.waitForFunction(() => Boolean(window.__sklop3d));
    await page.evaluate(() => window.scrollTo(0, 80));
    const nav = page.getByTestId(TEST_IDS.heroNav);
    const focused = () =>
      page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        const style = el ? getComputedStyle(el) : null;
        return {
          system: el?.dataset.system ?? null,
          slot: el?.dataset.slot ?? null,
          ring: Boolean(style && style.outlineStyle !== "none" && Number.parseFloat(style.outlineWidth) >= 2),
        };
      });
    const settle = async (target: number) => {
      await expect.poll(async () => (await state(page)).page, { timeout: 30_000 }).toBe(target);
      await expect
        .poll(async () => Math.abs((await state(page)).progress - (pageStart(target) + 0.8 * PAGE_LENGTH)), { timeout: 30_000 })
        .toBeLessThan(0.004);
    };
    const slotsOfPage = () =>
      page.locator("[data-page-active] [data-slot]").evaluateAll((links) =>
        links.map((link) => {
          const el = link as HTMLAnchorElement;
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return {
            slug: el.dataset.slot!,
            href: el.getAttribute("href"),
            w: r.width,
            h: r.height,
            // The link itself answers at its centre: nothing lies over it.
            reachable: hit?.closest("[data-slot]") === el,
            name: el.getAttribute("aria-label"),
          };
        }),
      );

    // ---------------------------------------------------------------- keyboard
    await goToStage(page, 1);
    await nav.locator('button[data-system][tabindex="0"]').focus();
    await page.keyboard.press("Home");
    const visited = new Set<string>();
    for (const [index, chip] of CHIPS.entries()) {
      if (index > 0) await page.keyboard.press("ArrowRight");
      const at = await focused();
      expect(at.system, `arrow keys reach chip ${index + 1}`).toBe(chip.system);
      expect(at.ring, `${chip.system} shows focus`).toBe(true);
      for (const target of chip.pages) {
        // A system on two pages steps from its first to its second.
        await page.keyboard.press("Enter");
        await settle(target);
        expect((await focused()).system, "focus stays on the chip").toBe(chip.system);
        if (visited.has(String(target))) continue;
        visited.add(String(target));
        // Tab: the parts list, then every slot of the page in reading order.
        await page.keyboard.press("Tab");
        await expect(page.getByTestId(TEST_IDS.partsListTrigger)).toBeFocused();
        const slots = await slotsOfPage();
        expect(slots).toHaveLength(PAGES[target - 1].slots);
        for (const slot of slots) {
          await page.keyboard.press("Tab");
          const now = await focused();
          expect(now.slot, `Tab reaches ${slot.slug}`).toBe(slot.slug);
          expect(now.ring, `${slot.slug} shows focus`).toBe(true);
          expect(slot.href).toBe(`/delovi/${slot.slug}`);
          expect(slot.name, `${slot.slug} has a name`).toBeTruthy();
        }
        // Back to the chip for the next one.
        await nav.locator(`button[data-system="${chip.system}"]`).focus();
      }
    }
    expect(visited.size).toBe(6);

    // ---------------------------------------------------------------- pointer / touch
    await goToStage(page, 0);
    const press = (locator: ReturnType<Page["locator"]>) => (mobile ? locator.tap() : locator.click());
    const seen = new Set<number>();
    for (const chip of CHIPS) {
      const button = nav.locator(`button[data-system="${chip.system}"]`);
      for (const target of chip.pages) {
        await press(button);
        await settle(target);
        if (seen.has(target)) continue;
        seen.add(target);
        for (const slot of await slotsOfPage()) {
          expect(slot.w, `${slot.slug} is a touch target`).toBeGreaterThanOrEqual(44);
          expect(slot.h, `${slot.slug} is a touch target`).toBeGreaterThanOrEqual(44);
          expect(slot.reachable, `${slot.slug} answers at its centre`).toBe(true);
        }
      }
      const box = await button.boundingBox();
      expect(box?.height ?? 0, `${chip.system} chip height`).toBeGreaterThanOrEqual(mobile ? 44 : 40);
    }
    expect(seen.size).toBe(6);
    // A slot is a link: one press opens its category.
    await press(page.locator('[data-page-active] [data-slot="dpf-katalizator"]'));
    await expect(page).toHaveURL(/\/delovi\/dpf-katalizator$/, { timeout: 30_000 });
    expect(errors).toEqual([]);
  });
});
