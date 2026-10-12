/**
 * Sharp-corner audit (steps 26–27, owner requirement 1: no visible box has 90° corners).
 *   node scripts/qa/ui-boost/corners.mjs [--base=http://localhost:3000] [--only=home,admin] [--json=file] [--check]
 *
 * On every page of kit.mjs, at 390 and 1440, lists the elements that draw a visible box with
 * all four corner radii at 0 px. A visible box is:
 *   - a border on at least three sides (visible colour, different from its own fill), or
 *   - an opaque-enough fill that differs from what is behind it, or
 *   - an image, video, canvas or form control.
 * Not counted (the documented exceptions): edges that meet the viewport (full-bleed bands,
 * fixed bars and drawers docked to an edge), hairline rules (a border on one or two sides),
 * boxes clipped by a rounded ancestor (the ancestor draws the corner), table cells and rows
 * (the table container is the box), elements smaller than 12 px, drawings (corner ticks, SVG).
 *
 * Also prints which radius values are in use. `--check` exits 1 when anything is listed.
 */
import { writeFileSync } from "node:fs";

import { forEachPage, launch, parseArgs, renderEverything, scrollThrough } from "./kit.mjs";

const args = parseArgs();

function audit() {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const rgba = (value) => {
    const m = value.match(/rgba?\(([^)]+)\)/);
    if (!m) return [0, 0, 0, 0];
    const p = m[1]
      .split(/[\s,/]+/)
      .filter(Boolean)
      .map(Number);
    return [p[0], p[1], p[2], p[3] ?? 1];
  };
  const same = (a, b) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) < 6;
  /** The colour painted behind `el` (first opaque ancestor fill). */
  const backdrop = (el) => {
    for (let node = el.parentElement; node; node = node.parentElement) {
      const c = rgba(getComputedStyle(node).backgroundColor);
      if (c[3] > 0.5) return c;
    }
    return rgba(getComputedStyle(document.documentElement).backgroundColor);
  };
  const radii = (style) =>
    [
      style.borderTopLeftRadius,
      style.borderTopRightRadius,
      style.borderBottomRightRadius,
      style.borderBottomLeftRadius,
    ].map((v) => Number.parseFloat(v) || 0);
  /** True when a rounded ancestor clips `el` and their boxes share the corners. */
  const clippedByRounded = (el, rect) => {
    for (let node = el.parentElement; node && node !== document.body; node = node.parentElement) {
      const style = getComputedStyle(node);
      if (style.overflow === "visible" && style.overflowX === "visible") continue;
      if (radii(style).every((r) => r === 0)) continue;
      const outer = node.getBoundingClientRect();
      const inset = Math.max(
        Math.abs(outer.left - rect.left),
        Math.abs(outer.right - rect.right),
        Math.abs(outer.top - rect.top),
        Math.abs(outer.bottom - rect.bottom),
      );
      // Flush on every side, or flush on the sides it touches (an image at the top of a card).
      const touches =
        Math.abs(outer.left - rect.left) < 2 ||
        Math.abs(outer.right - rect.right) < 2 ||
        Math.abs(outer.top - rect.top) < 2 ||
        Math.abs(outer.bottom - rect.bottom) < 2;
      if (inset < 2 || touches) return true;
    }
    return false;
  };

  const histogram = {};
  const sharp = [];
  for (const el of document.querySelectorAll("body *")) {
    if (el.closest("nextjs-portal, svg, [data-corner-audit='skip']")) continue;
    const tag = el.tagName.toLowerCase();
    if (
      [
        "script",
        "style",
        "template",
        "noscript",
        "br",
        "option",
        "tr",
        "td",
        "th",
        "thead",
        "tbody",
        "col",
        "colgroup",
      ].includes(tag)
    )
      continue;
    const style = getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden" || Number(style.opacity) === 0)
      continue;
    const rect = el.getBoundingClientRect();
    if (rect.width < 12 || rect.height < 12) continue;

    const r = radii(style);
    for (const value of r) if (value > 0) histogram[value] = (histogram[value] ?? 0) + 1;
    if (r.some((value) => value > 0)) continue;

    const fill = rgba(style.backgroundColor);
    const sides = ["Top", "Right", "Bottom", "Left"].filter((side) => {
      const width = Number.parseFloat(style[`border${side}Width`]) || 0;
      const colour = rgba(style[`border${side}Color`]);
      return width > 0 && style[`border${side}Style`] !== "none" && colour[3] > 0.15;
    });
    const control = [
      "img",
      "video",
      "canvas",
      "input",
      "select",
      "textarea",
      "button",
      "iframe",
    ].includes(tag);
    const filled = fill[3] > 0.5 && !same(fill, backdrop(el));
    // A gradient that runs to transparent is a fade (scroll hint, ground glow), not a box.
    const image = style.backgroundImage;
    const gradient =
      image !== "none" && !image.includes("rgba(0, 0, 0, 0)") && !image.includes("transparent");
    const bordered = sides.length >= 3;
    if (!(control || filled || bordered || (gradient && !el.classList.contains("corner-ticks"))))
      continue;
    if (el.classList.contains("corner-ticks")) continue;
    if (
      control &&
      (tag === "input" || tag === "button" || tag === "select" || tag === "textarea")
    ) {
      // A control without its own paint (the frame around it draws the box).
      if (!filled && !bordered && style.backgroundImage === "none") continue;
    }
    if (
      ["checkbox", "radio", "file", "hidden"].includes(el.getAttribute("type") ?? "") &&
      rect.width < 2
    )
      continue;

    // Edges that meet the viewport: full-bleed bands, docked bars, and columns whose four
    // corners all lie on the edges of the document (a sidebar from top to bottom).
    const docTop = rect.top + window.scrollY;
    const docBottom = rect.bottom + window.scrollY;
    const docHeight = document.documentElement.scrollHeight;
    const onSide = (x) => x <= 1 || x >= vw - 1;
    const onEnd = (y) => y <= 1 || y >= docHeight - 1;
    const corner = (x, y) => onSide(x) || onEnd(y);
    const allOnEdges =
      corner(rect.left, docTop) &&
      corner(rect.right, docTop) &&
      corner(rect.left, docBottom) &&
      corner(rect.right, docBottom);
    if (allOnEdges) continue;
    const fullBleed = rect.left <= 1 && rect.right >= vw - 1;
    const docked =
      (style.position === "fixed" || style.position === "sticky") &&
      (rect.left <= 1 || rect.right >= vw - 1 || rect.top <= 1 || rect.bottom >= vh - 1);
    if (fullBleed || docked) continue;
    // Inside a fixed bar/drawer docked to an edge and flush with it.
    if (clippedByRounded(el, rect)) continue;

    sharp.push({
      sig: `${tag}.${[...el.classList].slice(0, 4).join(".")}`,
      why: control ? tag : bordered ? `border×${sides.length}` : gradient ? "gradient" : "fill",
      size: `${Math.round(rect.width)}×${Math.round(rect.height)}`,
      text: (el.textContent ?? "").trim().replace(/\s+/g, " ").slice(0, 36),
      testid: el.closest("[data-testid]")?.getAttribute("data-testid") ?? "",
    });
  }
  return { sharp, histogram };
}

const browser = await launch();
const report = {};
const totals = {};
let total = 0;
await forEachPage(browser, args, async (page, name, _spec, viewport) => {
  await scrollThrough(page);
  await renderEverything(page);
  const result = await page.evaluate(audit);
  report[`${name}@${viewport.tag}`] = result.sharp;
  for (const [value, count] of Object.entries(result.histogram)) {
    totals[viewport.tag] ??= {};
    totals[viewport.tag][value] = (totals[viewport.tag][value] ?? 0) + count;
  }
  total += result.sharp.length;
  const grouped = new Map();
  for (const item of result.sharp) {
    const entry = grouped.get(item.sig) ?? { ...item, n: 0 };
    entry.n += 1;
    grouped.set(item.sig, entry);
  }
  const top = [...grouped.values()].sort((a, b) => b.n - a.n).slice(0, 14);
  console.log(`\n${name}@${viewport.tag}: ${result.sharp.length} sharp`);
  for (const item of top) {
    console.log(
      `  ${String(item.n).padStart(3)} × ${item.sig.slice(0, 70).padEnd(70)} ${item.why.padEnd(9)} ${item.size.padEnd(10)} ${item.testid ? `[${item.testid}] ` : ""}${item.text}`,
    );
  }
});
await browser.close();

console.log("\nRadius values in use (px → corners):");
for (const [tag, values] of Object.entries(totals)) {
  const line = Object.entries(values)
    .sort((a, b) => Number(a[0]) - Number(b[0]))
    .map(([value, count]) => `${value}: ${count}`)
    .join(" · ");
  console.log(`  ${tag}: ${line}`);
}
console.log(`\nTOTAL sharp boxes: ${total}`);
const out = args.flag("json");
if (out) writeFileSync(out, JSON.stringify({ total, totals, report }, null, 1));
if (args.has("check") && total > 0) process.exit(1);
