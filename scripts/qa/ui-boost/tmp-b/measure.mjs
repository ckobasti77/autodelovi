/**
 * Assessment B — measured browser evidence (throw-away script).
 *   node scripts/qa/ui-boost/tmp-b/measure.mjs
 * Writes docs/qa/screens/step-26/critique-b-evidence.json
 */
import { mkdirSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

import { chromium } from "@playwright/test";

const BASE = "http://localhost:3000";
const OUT = path.resolve("scripts/qa/ui-boost/tmp-b/evidence-run.json");
const MAX_ATTEMPTS = 8;
const PAGES = [
  "/",
  "/delovi",
  "/delovi/kocioni-diskovi",
  "/deo/kocioni-disk-prednji-312-25-mm-demo-0007",
  "/pretraga?q=disk",
  "/upit",
  "/za-majstore",
  "/korpa",
  "/kontakt",
  "/prijava",
  "/styleguide",
];
const VIEWPORTS = [
  { tag: "1440", width: 1440, height: 900, mobile: false },
  { tag: "390", width: 390, height: 844, mobile: true },
];
const NAV_TIMEOUT = 120_000;

/** Newest source file: the working tree is being edited by another process while this runs. */
function treeStamp() {
  let max = 0;
  let file = "";
  const walk = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === "node_modules" || e.name.startsWith(".")) continue;
        walk(p);
      } else {
        const m = statSync(p).mtimeMs;
        if (m > max) {
          max = m;
          file = p;
        }
      }
    }
  };
  for (const d of ["app", "components", "constants", "lib", "config"]) walk(d);
  return { ms: Math.round(max), at: new Date(max).toISOString(), file: file.replace(/\\/g, "/") };
}

/* ------------------------------------------------------------------ in-page code */

function measureAll({ mobile }) {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const vh = window.innerHeight;

  const cvs = document.createElement("canvas");
  cvs.width = cvs.height = 1;
  const ctx = cvs.getContext("2d", { willReadFrequently: true });
  const colorCache = new Map();
  const rgba = (s) => {
    let c = colorCache.get(s);
    if (c) return c;
    const m = /^rgba?\(\s*([\d.]+),\s*([\d.]+),\s*([\d.]+)(?:,\s*([\d.]+))?\s*\)$/.exec(s);
    if (m) c = [+m[1], +m[2], +m[3], m[4] === undefined ? 1 : +m[4]];
    else {
      ctx.clearRect(0, 0, 1, 1);
      ctx.fillStyle = "rgba(0,0,0,0)";
      ctx.fillStyle = s;
      ctx.fillRect(0, 0, 1, 1);
      const d = ctx.getImageData(0, 0, 1, 1).data;
      c = [d[0], d[1], d[2], d[3] / 255];
    }
    colorCache.set(s, c);
    return c;
  };
  const same = (a, b) =>
    Math.abs(a[0] - b[0]) <= 1 && Math.abs(a[1] - b[1]) <= 1 && Math.abs(a[2] - b[2]) <= 1;

  const sig = (el) => {
    const raw = typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
    const cls = raw.trim().split(/\s+/).filter(Boolean).slice(0, 3);
    return el.tagName.toLowerCase() + (cls.length ? "." + cls.join(".") : "");
  };
  const textOf = (el, n = 40) =>
    (
      el.textContent ||
      el.getAttribute("aria-label") ||
      el.getAttribute("alt") ||
      el.getAttribute("placeholder") ||
      el.getAttribute("value") ||
      ""
    )
      .trim()
      .replace(/\s+/g, " ")
      .slice(0, n) ||
    (el.getAttribute("aria-label") || el.getAttribute("alt") || el.getAttribute("placeholder") || "").slice(0, n);
  const zeroRadius = (v) => /^0(px|%)?(\s+0(px|%)?)?$/.test(v);
  const TAG_BOX = new Set(["img", "video", "canvas", "input", "select", "textarea", "button"]);
  const SKIP = new Set(["nextjs-portal", "script", "style", "noscript", "template", "link", "meta"]);

  /** visible elements → { r, cs } */
  const vis = new Map();
  const histAll = {};
  const histBox = {};
  const offenders = new Map();
  const box = { total: 0, square: 0, rounded: 0 };
  const reasons = { border: 0, background: 0, tagOnly: 0 };
  const excluded = { tiny: 0, fullBleed: 0, fixedEdge: 0, fixedOffscreenSubtrees: 0 };
  const radiusBySig = {};
  const tagOnly = { total: 0, inRoundedWrapper: 0, ownPaint: 0, bare: 0 };
  const drawn = { total: 0, clippedByRoundedAncestor: 0 };
  let domCount = 0;

  let baseBg = rgba(getComputedStyle(document.body).backgroundColor);
  if (baseBg[3] <= 0.5) baseBg = rgba(getComputedStyle(de).backgroundColor);
  if (baseBg[3] <= 0.5) baseBg = [255, 255, 255, 1];

  const walk = (el, effBg, chain) => {
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag)) return;
    if (!(el instanceof HTMLElement)) return; // svg internals are not boxes
    domCount++;
    const cs = getComputedStyle(el);
    if (cs.display === "none") return;
    if (parseFloat(cs.opacity) === 0) return; // whole subtree is invisible
    const bg = rgba(cs.backgroundColor);
    const ownEff = bg[3] > 0.5 ? bg : effBg;

    const r = el.getBoundingClientRect();
    const fixed = cs.position === "fixed";
    if (fixed && (r.bottom <= 0 || r.top >= vh || r.right <= 0 || r.left >= vw)) {
      excluded.fixedOffscreenSubtrees++;
      return; // a fixed box outside the viewport can never be scrolled into view
    }
    const visible =
      cs.visibility !== "hidden" &&
      cs.visibility !== "collapse" &&
      (el.offsetParent !== null || fixed) &&
      el.checkVisibility() &&
      r.width > 0 &&
      r.height > 0;

    let link = { rounded: false, box: false, clip: false, radius: "0px" };
    if (visible) {
      const info = { r, cs, bordered: false, box: false };
      vis.set(el, info);
      const radii = [
        cs.borderTopLeftRadius,
        cs.borderTopRightRadius,
        cs.borderBottomRightRadius,
        cs.borderBottomLeftRadius,
      ];
      const square = radii.every(zeroRadius);
      if (!square) histAll[cs.borderRadius] = (histAll[cs.borderRadius] || 0) + 1;

      let sides = 0;
      for (const s of ["Top", "Right", "Bottom", "Left"]) {
        if (parseFloat(cs[`border${s}Width`]) <= 0) continue;
        const st = cs[`border${s}Style`];
        if (st === "none" || st === "hidden") continue;
        const col = rgba(cs[`border${s}Color`]);
        if (col[3] <= 0.02) continue;
        if (same(col, ownEff) && col[3] > 0.98) continue;
        sides++;
      }
      const a = sides >= 3;
      const b = bg[3] > 0.5 && !same(bg, effBg);
      const c = TAG_BOX.has(tag);
      info.bordered = a;
      info.box = a || b;
      link = { rounded: !square, box: a || b, clip: cs.overflowX !== "visible", radius: cs.borderRadius };
      if (a || b || c) {
        const tiny = r.width < 12 || r.height < 12;
        const fullBleed = r.left <= 0.5 && r.right >= vw - 0.5;
        const fixedEdge =
          fixed && (r.left <= 0.5 || r.top <= 0.5 || r.right >= vw - 0.5 || r.bottom >= vh - 0.5);
        if (tiny) excluded.tiny++;
        else if (fullBleed) excluded.fullBleed++;
        else if (fixedEdge) excluded.fixedEdge++;
        else {
          box.total++;
          if (!square) {
            box.rounded++;
            histBox[cs.borderRadius] = (histBox[cs.borderRadius] || 0) + 1;
            const bucket = (radiusBySig[cs.borderRadius] ||= {});
            const k = sig(el);
            bucket[k] = (bucket[k] || 0) + 1;
          } else {
            box.square++;
            const why = (a ? "border" : "") + (b ? (a ? "+bg" : "bg") : "") + (!a && !b ? "tag" : "");
            if (a) reasons.border++;
            else if (b) reasons.background++;
            else reasons.tagOnly++;
            const wrap = chain.find((x) => x.rounded && (x.box || x.clip));
            const paints = sides > 0;
            if (!a && !b) {
              tagOnly.total++;
              if (wrap) tagOnly.inRoundedWrapper++;
              if (paints) tagOnly.ownPaint++;
              if (!wrap && !paints) tagOnly.bare++;
            }
            const key = sig(el);
            let o = offenders.get(key);
            if (!o) {
              o = {
                sig: key,
                n: 0,
                why: {},
                sample: {
                  text: textOf(el),
                  w: Math.round(r.width),
                  h: Math.round(r.height),
                  testid: el.getAttribute("data-testid") || undefined,
                  type: tag === "input" ? el.type : undefined,
                  src: tag === "img" ? (el.currentSrc || el.src || "").replace(location.origin, "").slice(0, 90) : undefined,
                  objectFit: tag === "img" ? cs.objectFit : undefined,
                },
              };
              offenders.set(key, o);
            }
            o.n++;
            if ((a || b) && chain.some((x) => x.rounded && x.clip)) {
              o.clippedByRoundedAncestor = (o.clippedByRoundedAncestor || 0) + 1;
              drawn.clippedByRoundedAncestor++;
            }
            if (a || b) drawn.total++;
            if (!a && !b) {
              if (wrap) {
                o.inRoundedWrapper = (o.inRoundedWrapper || 0) + 1;
                o.sample.wrapperRadius ??= wrap.radius;
              }
              if (paints) o.ownBorderSides = Math.max(o.ownBorderSides || 0, sides);
            }
            o.why[why] = (o.why[why] || 0) + 1;
          }
        }
      }
    }
    const next = [link, ...chain].slice(0, 4);
    for (const ch of el.children) walk(ch, ownEff, next);
  };
  for (const ch of document.body.children) walk(ch, baseBg, []);

  const sharp = {
    count: box.square,
    boxes: box,
    reasons,
    drawn,
    tagOnly,
    excluded,
    distinctSignatures: offenders.size,
    top: [...offenders.values()].sort((x, y) => y.n - x.n).slice(0, 25),
  };

  const result = {
    viewport: { clientWidth: vw, innerWidth: window.innerWidth, innerHeight: vh },
    scrollHeight: de.scrollHeight,
    domElements: domCount,
    visibleElements: vis.size,
    overflowX: de.scrollWidth - de.clientWidth,
    revealPending: document.querySelectorAll('[data-reveal-state="pending"]').length,
    revealWordsLeft: document.querySelectorAll(".reveal-word").length,
    sharp,
    radiusHistAll: histAll,
    radiusHistBoxes: histBox,
    radiusBySig,
    contactLinks: {
      tel: document.querySelectorAll('a[href^="tel:"]').length,
      viber: document.querySelectorAll('a[href^="viber:"]').length,
      mailto: document.querySelectorAll('a[href^="mailto:"]').length,
    },
  };

  if (!mobile) return result;

  /* ---------------- B. touch targets ---------------- */
  const srOnly = (v) =>
    v.r.width <= 1 ||
    v.r.height <= 1 ||
    v.cs.clip === "rect(0px, 0px, 0px, 0px)" ||
    v.cs.clipPath === "inset(50%)";
  const liHasOtherText = (li) => {
    const tw = document.createTreeWalker(li, NodeFilter.SHOW_TEXT);
    for (let n = tw.nextNode(); n; n = tw.nextNode()) {
      if (!n.nodeValue.trim()) continue;
      const host = n.parentElement && n.parentElement.closest("a, button");
      if (!host || !li.contains(host)) return true;
    }
    return false;
  };
  const pseudoRects = (el) => {
    const out = [];
    for (const p of ["::before", "::after"]) {
      const ps = getComputedStyle(el, p);
      if (!ps || ps.content === "none" || ps.content === "normal" || ps.display === "none") continue;
      if (ps.position !== "absolute") continue;
      if (ps.pointerEvents === "none") continue;
      let cb = el;
      while (cb && cb !== de) {
        const c = getComputedStyle(cb);
        if (c.position !== "static" || c.transform !== "none") break;
        cb = cb.parentElement;
      }
      if (!cb) continue;
      const cr = cb.getBoundingClientRect();
      const left = parseFloat(ps.left);
      const top = parseFloat(ps.top);
      const w = parseFloat(ps.width);
      const h = parseFloat(ps.height);
      if ([left, top, w, h].some(Number.isNaN)) continue;
      const x = cr.left + cb.clientLeft + left;
      const y = cr.top + cb.clientTop + top;
      out.push({ left: x, top: y, right: x + w, bottom: y + h });
    }
    return out;
  };

  const tt = new Map();
  const touch = {
    interactiveVisible: 0,
    count: 0,
    countEffective: 0,
    below24: 0,
    below24Effective: 0,
    inlineDisplay: 0,
    excludedInlineLinks: 0,
    excludedVisuallyHidden: 0,
  };
  const SEL =
    "a[href], button, input:not([type=hidden]), select, textarea, [role=button], summary";
  for (const el of document.querySelectorAll(SEL)) {
    const v = vis.get(el);
    if (!v) continue;
    if (srOnly(v)) {
      touch.excludedVisuallyHidden++;
      continue;
    }
    if (el.tagName === "A") {
      const li = el.closest("li");
      if (el.closest("p") || (li && liHasOtherText(li))) {
        touch.excludedInlineLinks++;
        continue;
      }
    }
    touch.interactiveVisible++;
    const r = v.r;
    if (r.width >= 44 && r.height >= 44) continue;
    touch.count++;
    if (r.width < 24 || r.height < 24) touch.below24++;
    if (v.cs.display === "inline") touch.inlineDisplay++;

    // effective hit area: own box ∪ pointer-receiving absolute pseudo-elements ∪ associated labels
    let L = r.left;
    let T = r.top;
    let R = r.right;
    let B = r.bottom;
    const extra = pseudoRects(el);
    if (el.labels) for (const lab of el.labels) if (vis.has(lab)) extra.push(lab.getBoundingClientRect());
    const wrapLabel = el.closest("label");
    if (wrapLabel && vis.has(wrapLabel)) extra.push(wrapLabel.getBoundingClientRect());
    for (const x of extra) {
      L = Math.min(L, x.left);
      T = Math.min(T, x.top);
      R = Math.max(R, x.right);
      B = Math.max(B, x.bottom);
    }
    const ew = R - L;
    const eh = B - T;
    const effSmall = ew < 44 || eh < 44;
    if (effSmall) touch.countEffective++;
    if (ew < 24 || eh < 24) touch.below24Effective++;

    const key = sig(el);
    let o = tt.get(key);
    if (!o) {
      o = {
        sig: key,
        n: 0,
        nEffective: 0,
        minW: Infinity,
        minH: Infinity,
        sample: {
          text: textOf(el),
          w: +r.width.toFixed(1),
          h: +r.height.toFixed(1),
          effW: +ew.toFixed(1),
          effH: +eh.toFixed(1),
          display: v.cs.display,
          testid: el.getAttribute("data-testid") || undefined,
          borderedWrapper: (() => {
            const p = [el.parentElement, el.parentElement && el.parentElement.parentElement].find(
              (x) => x && vis.get(x) && vis.get(x).bordered,
            );
            if (!p) return undefined;
            const pr = vis.get(p).r;
            return +pr.width.toFixed(1) + "x" + +pr.height.toFixed(1);
          })(),
        },
      };
      tt.set(key, o);
    }
    o.n++;
    if (effSmall) o.nEffective++;
    o.minW = Math.min(o.minW, +r.width.toFixed(1));
    o.minH = Math.min(o.minH, +r.height.toFixed(1));
  }
  touch.top = [...tt.values()].sort((x, y) => y.n - x.n).slice(0, 15);
  result.touch = touch;

  /* ---------------- D. type sizes ---------------- */
  const small = new Map();
  const ctl = new Map();
  const f16 = new Map();
  const fsHist = {};
  const type = { textElements: 0, below12: 0, controlsBelow14: 0, fieldsBelow16: 0, fields: 0 };
  const bump = (map, el, fs, r) => {
    const key = sig(el);
    let o = map.get(key);
    if (!o) {
      o = { sig: key, n: 0, fontSize: fs, sample: { text: textOf(el), w: Math.round(r.width), h: Math.round(r.height) } };
      map.set(key, o);
    }
    o.n++;
  };
  const FIELD_TYPES = new Set(["checkbox", "radio", "range", "file", "color", "hidden", "image"]);
  for (const [el, v] of vis) {
    if (srOnly(v)) continue;
    const tag = el.tagName.toLowerCase();
    const fs = parseFloat(v.cs.fontSize);
    if (tag === "input" || tag === "select" || tag === "textarea") {
      if (tag === "input" && FIELD_TYPES.has(el.type)) continue;
      type.fields++;
      if (fs < 16) {
        type.fieldsBelow16++;
        bump(f16, el, fs, v.r);
      }
      if (fs < 14) {
        type.controlsBelow14++;
        bump(ctl, el, fs, v.r);
      }
      continue;
    }
    let hasText = false;
    for (const n of el.childNodes) {
      if (n.nodeType === 3 && n.nodeValue.trim()) {
        hasText = true;
        break;
      }
    }
    if (!hasText) continue;
    type.textElements++;
    const k = `${+fs.toFixed(2)}px`;
    fsHist[k] = (fsHist[k] || 0) + 1;
    if (fs < 12) {
      type.below12++;
      bump(small, el, fs, v.r);
    }
    if (fs < 14 && el.closest("button")) {
      type.controlsBelow14++;
      bump(ctl, el, fs, v.r);
    }
  }
  type.below12Top = [...small.values()].sort((x, y) => y.n - x.n).slice(0, 15);
  type.controlsBelow14Top = [...ctl.values()].sort((x, y) => y.n - x.n).slice(0, 15);
  type.fieldsBelow16Top = [...f16.values()].sort((x, y) => y.n - x.n).slice(0, 10);
  type.fontSizeHist = fsHist;
  result.type = type;
  return result;
}

function headerMetrics() {
  const h = document.querySelector("[data-sticky-header]") || document.querySelector("body header");
  if (!h) return null;
  const cs = getComputedStyle(h);
  const r = h.getBoundingClientRect();
  const sig = (el) => {
    const raw = typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
    const cls = raw.trim().split(/\s+/).filter(Boolean).slice(0, 3);
    return el.tagName.toLowerCase() + (cls.length ? "." + cls.join(".") : "");
  };
  const rr = (e) => {
    const b = e.getBoundingClientRect();
    return { w: +b.width.toFixed(1), h: +b.height.toFixed(1), x: Math.round(b.left), y: Math.round(b.top) };
  };
  const visible = (e) =>
    e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) &&
    e.getBoundingClientRect().width > 0;
  const depth = (e) => {
    let d = 0;
    for (let n = e; n && n !== h; n = n.parentElement) d++;
    return d;
  };
  const logo = h.querySelector('a[href="/"]');
  const art = logo ? [...logo.querySelectorAll("img, svg")].filter(visible)[0] : null;
  const inner = h.firstElementChild;
  const interactive = [
    ...h.querySelectorAll("a[href], button, input:not([type=hidden]), select, [role=button], [role=combobox]"),
  ]
    .filter(visible)
    .map((e) => ({
      sig: sig(e),
      label: (e.getAttribute("aria-label") || e.textContent || e.getAttribute("placeholder") || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, 40),
      depth: depth(e),
      ...rr(e),
    }));
  return {
    scrollY: Math.round(window.scrollY),
    tag: sig(h),
    position: cs.position,
    top: cs.top,
    zIndex: cs.zIndex,
    height: +r.height.toFixed(1),
    rectTop: +r.top.toFixed(1),
    rectBottom: +r.bottom.toFixed(1),
    innerRowHeight: inner ? +inner.getBoundingClientRect().height.toFixed(1) : null,
    paddingInline: inner ? getComputedStyle(inner).paddingLeft : null,
    backgroundColor: cs.backgroundColor,
    backdropFilter: cs.backdropFilter || cs.webkitBackdropFilter || "none",
    borderBottom: `${cs.borderBottomWidth} ${cs.borderBottomStyle} ${cs.borderBottomColor}`,
    boxShadow: cs.boxShadow,
    transform: cs.transform,
    opacity: cs.opacity,
    logoLink: logo ? { ...rr(logo), label: logo.getAttribute("aria-label") || logo.textContent.trim().slice(0, 40) } : null,
    logoArt: art ? { tag: art.tagName.toLowerCase(), ...rr(art) } : null,
    interactive,
  };
}

function fixedElements() {
  const vh = window.innerHeight;
  const sig = (el) => {
    const raw = typeof el.className === "string" ? el.className : el.getAttribute("class") || "";
    const cls = raw.trim().split(/\s+/).filter(Boolean).slice(0, 3);
    return el.tagName.toLowerCase() + (cls.length ? "." + cls.join(".") : "");
  };
  const out = [];
  for (const el of document.querySelectorAll("body *")) {
    if (!(el instanceof HTMLElement)) continue;
    if (el.closest("nextjs-portal")) continue;
    const cs = getComputedStyle(el);
    if (cs.position !== "fixed" && cs.position !== "sticky") continue;
    const r = el.getBoundingClientRect();
    if (cs.position === "sticky" && !(cs.bottom !== "auto" && r.bottom >= vh - 2 && r.top >= vh / 2)) continue;
    const shown =
      cs.display !== "none" &&
      cs.visibility !== "hidden" &&
      parseFloat(cs.opacity) > 0 &&
      r.width > 0 &&
      r.height > 0 &&
      r.top < vh &&
      r.bottom > 0;
    out.push({
      sig: sig(el),
      position: cs.position,
      visibility: cs.visibility,
      testid: el.getAttribute("data-testid") || undefined,
      w: Math.round(r.width),
      h: Math.round(r.height),
      top: Math.round(r.top),
      bottom: Math.round(r.bottom),
      shownInViewport: shown,
      atBottom: shown && r.bottom >= vh - 2 && r.top >= vh / 2,
      opacity: cs.opacity,
      transform: cs.transform,
      inert: el.inert,
      text: (el.textContent || "").trim().replace(/\s+/g, " ").slice(0, 80),
    });
  }
  return { scrollY: Math.round(window.scrollY), innerHeight: vh, fixed: out };
}

/* ------------------------------------------------------------------ driver */

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = window.innerHeight * 0.6;
    let guard = 0;
    for (let y = 0; y < document.documentElement.scrollHeight && guard < 600; y += step, guard++) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 150));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
  });
  await page.waitForTimeout(1000);
}

async function downThenUp(page) {
  await page.evaluate(async () => {
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 200));
    for (let i = 1; i <= 4; i++) {
      window.scrollTo(0, i * 300);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  await page.waitForTimeout(700);
  const down = await page.evaluate(headerMetrics);
  await page.evaluate(async () => {
    for (let i = 1; i <= 3; i++) {
      window.scrollBy(0, -100);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  // the contact bar module is loaded on its first show — give the dev server time to compile it
  await page
    .waitForFunction(
      () => {
        const el = document.querySelector('[data-testid="sticky-contact-bar"], [data-testid="sticky-buy-bar"]');
        return el && getComputedStyle(el).visibility !== "hidden" && el.getBoundingClientRect().top < window.innerHeight - 4;
      },
      undefined,
      { timeout: 5000 },
    )
    .catch(() => {});
  await page.waitForTimeout(900);
  const up = await page.evaluate(headerMetrics);
  const fixed = await page.evaluate(fixedElements);
  return { afterDown1200: down, afterUp300: up, fixedAfterUp300: fixed };
}

const startedAt = new Date().toISOString();
const treeAtStart = treeStamp();
const evidence = {
  meta: {
    assessment: "impeccable critique — Assessment B (measured browser evidence)",
    startedAt,
    base: BASE,
    viewports: VIEWPORTS,
    pages: PAGES,
    method: {
      navigation: "goto(waitUntil: networkidle, 120 s) → scroll to the bottom in steps of 60 % of the viewport, 150 ms apart → wait 1 s → inject *{content-visibility:visible!important} → measure at the bottom scroll position",
      visitor: "anonymous, consent cookie sk_consent preset (no banner), empty cart",
      sharpCorners:
        "visible box = (a) border on ≥ 3 sides, width > 0, non-transparent, different from the element's own effective background, OR (b) background-color alpha > 0.5 differing from the nearest ancestor's effective background, OR (c) img/video/canvas/input/select/textarea/button. Excluded: < 12 px in either dimension, boxes touching both viewport edges, html/body, nextjs-portal subtree, position:fixed touching a viewport edge, invisible (offsetParent null [fixed elements are measured], opacity 0 on self or ancestor, visibility hidden, display none, closed details). Square = all four computed corner radii are 0.",
      tagOnly:
        "tagOnly = square elements counted only by criterion (c). inRoundedWrapper = an ancestor within 4 levels has a non-zero radius and either draws a box (a/b) or clips (overflow ≠ visible); ownPaint = the element paints 1–2 border sides itself; bare = neither.",
      fixedOffscreen: "a position:fixed element lying completely outside the viewport (skip link before focus, parked bars) is treated as invisible together with its subtree",
      sharpWhy: "why: border = criterion (a), bg = criterion (b) only, tag = criterion (c) only (element type, nothing drawn by border/background)",
      touch:
        "390 only. a[href], button, input:not([type=hidden]), select, textarea, [role=button], summary; visible; < 44 px in either dimension. Excluded: links inside <p>, links inside <li> that has text outside links/buttons, visually hidden (≤ 1 px / clip). count = the element's own box (as specified). countEffective = own box ∪ pointer-receiving absolutely positioned ::before/::after ∪ associated <label>.",
      type: "390 only. Text elements = visible elements with a non-empty direct text node. controlsBelow14 = input/select/textarea with font-size < 14 px plus text elements inside <button> < 14 px. fieldsBelow16 = text inputs/select/textarea under 16 px (iOS focus zoom threshold).",
      header:
        "on / only: fresh load, measured at scrollY 0, after scrolling down to 1200 px (4 × 300) and after scrolling up 300 px (3 × 100); fixed elements listed after the up-scroll. fixedCheck on the other pages repeats the down/up scroll after the main measurement.",
    },
  },
  header: {},
  pages: {},
  radiusHistogram: {},
};

const browser = await chromium.launch({
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
});

for (const vp of VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.mobile,
    hasTouch: vp.mobile,
    locale: "sr-Latn-RS",
    timezoneId: "Europe/Belgrade",
  });
  await context.addCookies([
    {
      name: "sk_consent",
      value: encodeURIComponent(
        JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "critique-b-0001" }),
      ),
      domain: "localhost",
      path: "/",
    },
  ]);
  const page = await context.newPage();
  page.setDefaultNavigationTimeout(NAV_TIMEOUT);
  const errors = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text().slice(0, 240)));
  page.on("pageerror", (e) => errors.push(`pageerror: ${String(e).slice(0, 240)}`));

  const go = async (p) => {
    const t0 = Date.now();
    let note;
    let status = 0;
    try {
      const res = await page.goto(`${BASE}${p}`, { waitUntil: "networkidle", timeout: NAV_TIMEOUT });
      status = res ? res.status() : 0;
      note = `status ${status}`;
    } catch (error) {
      note = `networkidle not reached: ${String(error).slice(0, 160)}`;
    }
    return { note, status, ms: Date.now() - t0, at: new Date().toISOString() };
  };

  /* E. header / chrome on "/" */
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const nav = await go("/");
      await page.waitForTimeout(800);
      const atTop = await page.evaluate(headerMetrics);
      if ((nav.status >= 400 || !atTop) && attempt < MAX_ATTEMPTS) {
        console.log(`[${vp.tag}] header: ${nav.note}, no header — the app is broken right now, retry ${attempt}`);
        await page.waitForTimeout(15000);
        continue;
      }
      const rest = await downThenUp(page);
      evidence.header[vp.tag] = { nav, atTop, ...rest, treeNewest: treeStamp().at, attempts: attempt };
      console.log(`[${vp.tag}] header: ${atTop ? atTop.height : "none"} px, ${atTop ? atTop.position : ""}`);
      break;
    } catch (error) {
      evidence.header[vp.tag] = { error: String(error).slice(0, 300) };
      console.log(`[${vp.tag}] header FAILED ${String(error).slice(0, 200)}`);
    }
  }

  evidence.pages[vp.tag] = {};
  const histAll = {};
  const histBox = {};
  const bySig = {};
  for (const p of PAGES) {
   for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    errors.length = 0;
    const stampBefore = treeStamp();
    try {
      const nav = await go(p);
      if (nav.status >= 400 && attempt < MAX_ATTEMPTS) {
        console.log(`[${vp.tag}] ${p}: ${nav.note} — the app is broken right now (${errors[0] ? errors[0].slice(0, 120).split("\n").join(" ") : "no console error"}), retry ${attempt}`);
        await page.waitForTimeout(15000);
        continue;
      }
      await page.waitForTimeout(500);
      await scrollThrough(page);
      await page.evaluate(() => {
        document.head.appendChild(
          Object.assign(document.createElement("style"), {
            textContent: "*{content-visibility:visible!important}",
          }),
        );
      });
      await page.waitForTimeout(150);
      const data = await page.evaluate(measureAll, { mobile: vp.mobile });
      const fixedAtPageBottom = (await page.evaluate(fixedElements)).fixed.filter((x) => x.shownInViewport);
      const stampAfter = treeStamp();
      if (stampAfter.ms !== stampBefore.ms && attempt < MAX_ATTEMPTS) {
        console.log(`[${vp.tag}] ${p}: source changed during the measurement (${stampAfter.file}) — retry ${attempt}`);
        await page.waitForTimeout(5000);
        continue;
      }
      for (const [k, n] of Object.entries(data.radiusHistAll)) histAll[k] = (histAll[k] || 0) + n;
      for (const [k, n] of Object.entries(data.radiusHistBoxes)) histBox[k] = (histBox[k] || 0) + n;
      for (const [radius, sigs] of Object.entries(data.radiusBySig)) {
        const bucket = (bySig[radius] ||= {});
        for (const [k, n] of Object.entries(sigs)) bucket[k] = (bucket[k] || 0) + n;
      }
      delete data.radiusBySig;
      let buyBar = null;
      if (p.startsWith("/deo/")) {
        buyBar = await page.evaluate(async () => {
          const box = document.getElementById("buy-box");
          const bar = document.querySelector('[data-testid="sticky-buy-bar"]');
          if (!box || !bar) return { buyBox: !!box, bar: !!bar };
          const top = box.getBoundingClientRect().bottom + window.scrollY;
          window.scrollTo(0, top + 200);
          await new Promise((r) => setTimeout(r, 1500));
          const cs = getComputedStyle(bar);
          const r = bar.getBoundingClientRect();
          const btn = bar.querySelector("button");
          const br = btn ? btn.getBoundingClientRect() : null;
          return {
            scrollY: Math.round(window.scrollY),
            buyBoxBottomAtDocY: Math.round(top),
            display: cs.display,
            visibility: cs.visibility,
            top: Math.round(r.top),
            bottom: Math.round(r.bottom),
            w: Math.round(r.width),
            h: Math.round(r.height),
            shown: cs.display !== "none" && cs.visibility !== "hidden" && r.top < window.innerHeight && r.height > 0,
            background: cs.backgroundColor,
            borderTop: cs.borderTopWidth + " " + cs.borderTopColor,
            button: br ? { w: Math.round(br.width), h: Math.round(br.height), radius: getComputedStyle(btn).borderRadius, text: btn.textContent.trim().slice(0, 40) } : null,
            text: bar.textContent.trim().replace(/\s+/g, " ").slice(0, 80),
          };
        });
      }
      let fixedCheck = null;
      if (p !== "/") {
        const f = await downThenUp(page);
        fixedCheck = {
          scrollY: f.fixedAfterUp300.scrollY,
          atBottom: f.fixedAfterUp300.fixed.filter((x) => x.atBottom),
          all: f.fixedAfterUp300.fixed,
          headerRectTopAfterDown: f.afterDown1200 ? f.afterDown1200.rectTop : null,
          headerRectTopAfterUp: f.afterUp300 ? f.afterUp300.rectTop : null,
        };
      }
      evidence.pages[vp.tag][p] = {
        nav,
        httpStatus: nav.status,
        url: page.url().replace(BASE, ""),
        title: await page.title(),
        consoleErrors: errors.slice(0, 5),
        consoleErrorCount: errors.length,
        ...data,
        fixedAtPageBottom,
        buyBar,
        fixedCheck,
        tree: { before: stampBefore.at, after: stampAfter.at, newestFile: stampAfter.file, attempts: attempt, changedDuringMeasure: stampAfter.ms !== stampBefore.ms },
      };
      console.log(
        `[${vp.tag}] ${p}: sharp=${data.sharp.count}/${data.sharp.boxes.total} overflowX=${data.overflowX}` +
          (data.touch ? ` touch<44=${data.touch.count} (eff ${data.touch.countEffective}) fs<12=${data.type.below12} ctl<14=${data.type.controlsBelow14}` : "") +
          ` errors=${errors.length} (${nav.ms} ms, ${nav.note})`,
      );
      break;
    } catch (error) {
      evidence.pages[vp.tag][p] = { error: String(error).slice(0, 400) };
      console.log(`[${vp.tag}] ${p}: FAILED ${String(error).slice(0, 300)}`);
      if (attempt === MAX_ATTEMPTS) break;
      await page.waitForTimeout(5000);
    }
   }
  }
  const sort = (h) => Object.fromEntries(Object.entries(h).sort((a, b) => b[1] - a[1]));
  evidence.radiusHistogram[vp.tag] = {
    allVisibleElements: sort(histAll),
    visibleBoxes: sort(histBox),
    visibleBoxesTopSignatures: Object.fromEntries(
      Object.entries(bySig).map(([radius, sigs]) => [
        radius,
        Object.entries(sigs)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 10)
          .map(([k, n]) => ({ sig: k, n })),
      ]),
    ),
  };
  await context.close();
}
await browser.close();

evidence.meta.finishedAt = new Date().toISOString();
evidence.meta.tree = { atStart: treeAtStart, atEnd: treeStamp() };
mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, JSON.stringify(evidence, null, 1));
console.log(`saved ${OUT}`);
