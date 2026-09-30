/**
 * a11y-store: keyboard-only Tab walk per template. For every focus stop records name, role,
 * rect, the focus indicator (outline / box-shadow / ::after outline), the colour behind it,
 * whether the sticky header / cookie banner / sticky bars cover it (2.4.11) and order jumps.
 *   node scripts/qa/audit/a11y-store-tabwalk.mjs <width> <route> [maxTabs] [consent]
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { launch, newContext, watch, shot, BASE } from "./kit.mjs";

const width = Number(process.argv[2] ?? 1440);
const route = process.argv[3] ?? "/";
const maxTabs = Number(process.argv[4] ?? 80);
const consent = process.argv[5] !== "noconsent";
const height = width < 1024 ? 844 : 900;
const OUT = "docs/qa/audit/a11y-store";
mkdirSync(OUT, { recursive: true });
const slug = `${width}${route.replace(/[^a-z0-9]+/gi, "_").slice(0, 40)}${consent ? "" : "_banner"}`;

const browser = await launch();
const ctx = await newContext(browser, { width, height, consent, tag: "a11ytab" });
const page = await ctx.newPage();
const log = watch(page);
await page.goto(BASE + route, { waitUntil: "load", timeout: 180000 }); await page.waitForTimeout(2000);
await page.waitForTimeout(1500);

const stops = [];
const shots = [];
for (let i = 0; i < maxTabs; i++) {
  await page.keyboard.press("Tab");
  await page.waitForTimeout(120);
  const info = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return { body: true };
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    const after = getComputedStyle(el, "::after");
    const name =
      el.getAttribute("aria-label") ||
      (el.getAttribute("aria-labelledby") &&
        el.getAttribute("aria-labelledby").split(" ").map((id) => document.getElementById(id)?.textContent ?? "").join(" ")) ||
      (el.labels && el.labels[0]?.textContent) ||
      el.textContent?.trim() ||
      el.getAttribute("title") ||
      el.getAttribute("placeholder") ||
      "";
    // colour behind: walk up until a non-transparent background
    const bgOf = (node) => {
      let n = node.parentElement;
      while (n) {
        const b = getComputedStyle(n).backgroundColor;
        if (b && b !== "rgba(0, 0, 0, 0)" && b !== "transparent") return b;
        n = n.parentElement;
      }
      return getComputedStyle(document.body).backgroundColor;
    };
    // covering elements at the centre and corners
    const pts = [
      [r.left + r.width / 2, r.top + r.height / 2],
      [r.left + 2, r.top + 2],
      [r.right - 2, r.bottom - 2],
    ];
    const covered = pts.map(([x, y]) => {
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return "offscreen";
      const top = document.elementFromPoint(x, y);
      if (!top) return "none";
      if (top === el || el.contains(top) || top.contains(el)) return "self";
      const cover = top.closest("header,[role=dialog],[data-sticky],.sticky,[class*='sticky'],[class*='fixed'],footer,aside") || top;
      return `${cover.tagName.toLowerCase()}${cover.id ? "#" + cover.id : ""}.${String(cover.className).split(" ").slice(0, 3).join(".")}`;
    });
    return {
      tag: el.tagName.toLowerCase(),
      role: el.getAttribute("role") || "",
      type: el.getAttribute("type") || "",
      href: el.getAttribute("href") || "",
      name: name.replace(/\s+/g, " ").slice(0, 70),
      rect: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)],
      outline: `${cs.outlineStyle} ${cs.outlineWidth} ${cs.outlineColor} off ${cs.outlineOffset}`,
      boxShadow: cs.boxShadow === "none" ? "" : cs.boxShadow.slice(0, 80),
      afterOutline: after.content !== "none" && after.content !== "" ? `${after.outlineStyle} ${after.outlineWidth} ${after.outlineColor}` : "",
      border: `${cs.borderTopWidth} ${cs.borderTopColor}`,
      bg: cs.backgroundColor,
      behind: bgOf(el),
      focusVisible: el.matches(":focus-visible"),
      covered,
      inViewport: r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth,
      scrollY: Math.round(scrollY),
      testid: el.getAttribute("data-testid") || "",
    };
  });
  stops.push({ i: i + 1, ...info });
  if (i < 3 || [10, 20, 30, 40].includes(i)) shots.push(await shot(page, `a11y-store/tab-${slug}-${i + 1}`));
}

// flag problems
const probs = [];
for (const s of stops) {
  if (s.body) continue;
  const noIndicator = /none|0px/.test(s.outline.split(" off")[0]) && !s.boxShadow && !/solid/.test(s.afterOutline);
  if (noIndicator) probs.push(`#${s.i} no outline/box-shadow: ${s.tag} "${s.name}" (${s.outline})`);
  if (!s.inViewport) probs.push(`#${s.i} not in viewport: ${s.tag} "${s.name}" rect ${s.rect}`);
  const cov = s.covered.filter((c) => c !== "self" && c !== "offscreen");
  if (cov.length >= 2) probs.push(`#${s.i} covered by ${cov.join(" | ")}: ${s.tag} "${s.name}" rect ${s.rect}`);
}
const res = { width, route, consent, stops, probs, shots, console: log.console, pageErrors: log.pageErrors };
writeFileSync(`${OUT}/tab-${slug}.json`, JSON.stringify(res, null, 1));
console.log(`stops ${stops.length}; problems ${probs.length}`);
for (const p of probs) console.log("  ", p);
for (const s of stops.slice(0, maxTabs)) console.log(s.i, s.body ? "BODY" : `${s.tag}${s.role ? "[" + s.role + "]" : ""} "${s.name}" ${s.rect} y${s.scrollY} ${s.focusVisible ? "fv" : "NOFV"} ${s.outline.split(" off")[0]}${s.afterOutline ? " after:" + s.afterOutline : ""}`);
await browser.close();
