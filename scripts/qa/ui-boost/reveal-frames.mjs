/**
 * Where on the screen do reveals start? (steps 26–27, docs/design/UI-BOOST.md §4)
 *   node scripts/qa/ui-boost/reveal-frames.mjs [path] [--base=http://localhost:3000] [--out=dir] [--line=0.18]
 *
 * Scrolls the page at a steady reading speed at 390 × 844 and 1440 × 900, records for every
 * element the moment its `data-reveal-state` turns `running` (top and centre as a share of the
 * viewport height), and saves a frame 90 ms after the first card of each grid batch started, so
 * the entrance can be looked at. `--line` overrides REVEAL_LINE in the page for comparison (the
 * observer margin is rewritten before the engine starts).
 */
import { mkdirSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const flag = (name) =>
  args
    .find((a) => a.startsWith(`--${name}=`))
    ?.split("=")
    .slice(1)
    .join("=");
const target = args.find((a) => !a.startsWith("--")) ?? "/styleguide/otkrivanje";
const base = flag("base") ?? "http://localhost:3000";
const outDir = path.resolve(flag("out") ?? "docs/qa/screens/step-26/reveal");
const line = flag("line") ? Number(flag("line")) : null;
mkdirSync(outDir, { recursive: true });

const VIEWPORTS = [
  { tag: "390", width: 390, height: 844, mobile: true },
  { tag: "1440", width: 1440, height: 900, mobile: false },
];

const browser = await chromium.launch();
for (const v of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: v.width, height: v.height },
    isMobile: v.mobile,
    hasTouch: v.mobile,
    locale: "sr-Latn-RS",
  });
  await context.addCookies([
    {
      name: "sk_consent",
      value: encodeURIComponent(
        JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "uiboost-0002" }),
      ),
      domain: new URL(base).hostname,
      path: "/",
    },
  ]);
  const page = await context.newPage();
  await page.addInitScript((override) => {
    // Optional line override: rewrite the observer's bottom margin.
    if (override !== null) {
      const Native = window.IntersectionObserver;
      window.IntersectionObserver = class extends Native {
        constructor(callback, options = {}) {
          const margin = options.rootMargin ?? "";
          const patched = /^0px 0px -\d+% 0px$/.test(margin)
            ? `0px 0px -${Math.round(override * 100)}% 0px`
            : margin;
          super(callback, { ...options, rootMargin: patched });
        }
      };
    }
    window.__reveals = [];
    const record = (el) => {
      const r = el.getBoundingClientRect();
      const h = window.innerHeight;
      window.__reveals.push({
        t: Math.round(performance.now()),
        id:
          el.getAttribute("data-testid") ??
          `${el.parentElement?.getAttribute("data-testid") ?? el.tagName.toLowerCase()}>${[...(el.parentElement?.children ?? [])].indexOf(el)}`,
        kind: el.getAttribute("data-reveal-mode") ?? "words",
        top: +(r.top / h).toFixed(3),
        centre: +((r.top + r.height / 2) / h).toFixed(3),
        height: Math.round(r.height),
        delay: el.style.getPropertyValue("--rv-d") || "0ms",
        scrollY: Math.round(window.scrollY),
      });
    };
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.target.getAttribute?.("data-reveal-state") === "running" && m.oldValue !== "running")
          record(m.target);
      }
    }).observe(document, {
      attributes: true,
      attributeFilter: ["data-reveal-state"],
      attributeOldValue: true,
      subtree: true,
    });
  }, line);

  await page.goto(`${base}${target}`, { waitUntil: "networkidle", timeout: 120_000 });
  await page.waitForTimeout(1500);

  // Steady scroll: 14 px per frame ≈ 840 px/s (a calm read on a phone, a wheel on desktop).
  const frames = [];
  let seen = 0;
  const max = await page.evaluate(() => document.documentElement.scrollHeight - window.innerHeight);
  for (let y = 0; y <= max; y += 14) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(16);
    const count = await page.evaluate(() => window.__reveals.length);
    if (count > seen) {
      const fresh = await page.evaluate((from) => window.__reveals.slice(from), seen);
      seen = count;
      const block = fresh.find((r) => r.kind === "rise" && frames.length < 8);
      if (block) {
        await page.waitForTimeout(90);
        const file = path.join(
          outDir,
          `${v.tag}-${String(frames.length + 1).padStart(2, "0")}-${block.id.replace(/[^a-z0-9]+/gi, "_")}.png`,
        );
        await page.screenshot({ path: file });
        frames.push(path.basename(file));
      }
    }
  }
  // The 14 px steps can stop short of the end: finish there, as a reader would.
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.waitForTimeout(1500);
  const reveals = await page.evaluate(() => window.__reveals);
  const left = await page.evaluate(() => ({
    pending: document.querySelectorAll('[data-reveal-state="pending"]').length,
    hidden: [...document.querySelectorAll("*")].filter(
      (e) => e.offsetParent && e.textContent.trim() && getComputedStyle(e).opacity === "0",
    ).length,
  }));
  console.log(
    `\n== ${target} @ ${v.tag} (line ${line ?? "config"}) — ${reveals.length} reveals, pending ${left.pending}, hidden ${left.hidden}`,
  );
  const blocks = reveals.filter((r) => r.kind === "rise" || r.kind === "fade");
  for (const r of blocks.slice(0, 40)) {
    console.log(
      `  ${r.id.padEnd(22)} ${r.kind.padEnd(5)} top ${String(r.top).padEnd(6)} centre ${String(r.centre).padEnd(6)} h ${String(r.height).padEnd(5)} delay ${r.delay.padEnd(6)} scrollY ${r.scrollY}`,
    );
  }
  const words = reveals.filter((r) => r.kind === "words" || r.kind === "block");
  if (words.length) {
    const centres = words.filter((r) => r.scrollY > 0).map((r) => r.centre);
    console.log(
      `  copy: ${words.length} elements, centre at start min ${Math.min(...centres)} max ${Math.max(...centres)}`,
    );
  }
  console.log(`  frames: ${frames.join(", ")}`);
  await context.close();
}
await browser.close();
