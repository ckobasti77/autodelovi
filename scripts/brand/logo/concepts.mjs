// Step 24 — concept exploration for the „Euromotors Plus by OEM Parts“ logo.
// Builds seven concept directions as SVG (a primary lockup and a compact mark each, on night and on
// paper), renders them to PNG (lockups at 1200 px; marks at 16 / 32 / 64 / 256 px) and composes one
// contact sheet per concept from those PNG files.
//
// Usage: node scripts/brand/logo/concepts.mjs [k1 k2 …]
// Output: docs/brand/concepts/<id>-<slug>-{primary,mark}-{night,paper}.svg
//         docs/brand/concepts/renders/<id>-<slug>-…png, docs/brand/concepts/sheets/<id>-<slug>.png
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import {
  difference,
  expandStroke,
  plus,
  polar,
  rect,
  ring,
  rotate,
  simplify,
  star,
  translate,
  union,
  poly,
} from "./lib/geo.mjs";
import {
  FACE,
  THEMES,
  endorsement,
  fill,
  liftedPlus,
  slantedRule,
  svgDoc,
  word,
  wordAt,
} from "./lib/parts.mjs";
import { svgToPng } from "./lib/render.mjs";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUT = path.join(ROOT, "docs/brand/concepts");
const MARK_BOX = 240;

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

/** Text set on a circle. `at` = centre angle (maths degrees, 90 = top). `flip` sets it on the lower arc. */
function arcText(text, face, cap, cx, cy, radius, at, { tracking = 0.1, flip = false } = {}) {
  const probe = word(text, face, cap, { tracking });
  const pitch = flip ? radius - cap / 2 : radius + cap / 2;
  const total = (probe.advance / pitch) * (180 / Math.PI);
  let d = "";
  for (const g of probe.glyphs) {
    if (!g.d) continue;
    const mid = g.x + g.advance / 2;
    const offsetDeg = (mid / pitch) * (180 / Math.PI);
    const theta = flip ? at - total / 2 + offsetDeg : at + total / 2 - offsetDeg;
    const [px, py] = polar(cx, cy, radius, theta);
    const centred = translate(simplify(g.d), -mid, 0);
    d += translate(rotate(centred, flip ? 270 - theta : 90 - theta), px, py);
  }
  return { d, sweep: total };
}

/** The known OEM Parts composition: solid „OEM“, hairline, outlined „Parts“ to the right below it. */
function oemStack({ cap, cx, top }) {
  const probe = word("OEM", FACE.oem, cap);
  const w = probe.bbox.x2 - probe.bbox.x1;
  const o = wordAt("OEM", FACE.oem, cap, cx - w / 2, top + cap);
  const ruleH = Math.max(cap * 0.045, 2);
  const ruleY = top + cap + cap * 0.2;
  const x1 = o.bbox.x1 - w * 0.07;
  const x2 = o.bbox.x2 + w * 0.05;
  const pCap = cap * 0.46;
  const stroke = pCap * 0.09;
  const pProbe = word("Parts", FACE.parts, pCap, { tracking: 0.045 });
  const pw = pProbe.bbox.x2 - pProbe.bbox.x1;
  const p = wordAt(
    "Parts",
    FACE.parts,
    pCap,
    x2 - pw - stroke / 2,
    ruleY + ruleH + cap * 0.17 + pCap,
    { tracking: 0.045 },
  );
  return {
    solid: o.d + rect(x1, ruleY, x2 - x1, ruleH),
    outlined: expandStroke(p.d, stroke, { miterLimit: 3 }),
    bottom: ruleY + ruleH + cap * 0.17 + pCap,
    x1,
    x2,
  };
}

const CONCEPTS = [];
const concept = (c) => CONCEPTS.push(c);

// ---------------------------------------------------------------------------------------------
// K1 — Orbita: the ring of stars becomes a crescent of plus signs
// ---------------------------------------------------------------------------------------------
function crescent(cx, cy, radius, sizes, step) {
  const half = (sizes.length - 1) / 2;
  let ink = "";
  let accent = "";
  sizes.forEach((s, i) => {
    const [x, y] = polar(cx, cy, radius, 180 + (i - half) * step);
    const d = plus(x, y, s, s * 0.3);
    if (i === half) accent += d;
    else ink += d;
  });
  return { ink, accent };
}

concept({
  id: "k1",
  slug: "orbita",
  title: "Orbita",
  idea: "The partial ring of stars from the current logo, redrawn: every star is a plus, sized on one curve, the largest in orange.",
  primary(t) {
    const c = crescent(220, 220, 170, [30, 44, 60, 80, 60, 44, 30], 36);
    const euro = wordAt("EUROMOTORS", FACE.display, 100, 140, 222, { tracking: 0.02 });
    const right = euro.bbox.x2;
    const plusWord = wordAt("PLUS", FACE.display, 46, 140, 292, { tracking: 0.12 });
    const rule = rect(plusWord.bbox.x2 + 22, 292 - 23 - 2.5, right - plusWord.bbox.x2 - 22, 5);
    const e = endorsement({ cap: 40, x: right, y: 356, anchor: "end" });
    return {
      w: Math.ceil(right + 40),
      h: 440,
      body:
        fill(c.ink + euro.d + plusWord.d + rule + e.solid + e.outlined, t.ink) +
        fill(c.accent, t.accent),
    };
  },
  mark(t) {
    const c = crescent(132, 120, 88, [22, 32, 44, 62, 44, 32, 22], 36);
    return { w: MARK_BOX, h: MARK_BOX, body: fill(c.ink, t.ink) + fill(c.accent, t.accent) };
  },
});

// ---------------------------------------------------------------------------------------------
// K2 — E-plus: an E whose middle arm is the plus (a part seated in its bracket)
// ---------------------------------------------------------------------------------------------
function ePlus(x, y, h) {
  const k = h / 200;
  const s = 40 * k;
  const w = 166 * k;
  const gap = 14 * k;
  const span = 92 * k;
  const bracket = union(rect(x, y, s, h), rect(x, y, w, s), rect(x, y + h - s, w, s));
  const sign = plus(x + s + gap + span / 2, y + h / 2, span, 32 * k);
  return { bracket, sign, w };
}

concept({
  id: "k2",
  slug: "e-plus",
  title: "E-plus",
  idea: "A monogram: the E of Euromotors is a bracket, its middle arm is the orange plus — a part seated in its housing.",
  primary(t) {
    const m = ePlus(40, 40, 160);
    const x0 = 40 + m.w + 44;
    const euro = wordAt("EUROMOTORS PLUS", FACE.display, 72, x0, 112, { tracking: 0.02 });
    const right = euro.bbox.x2;
    const rule = rect(x0, 136, right - x0, 5);
    const e = endorsement({ cap: 36, x: right, y: 200, anchor: "end" });
    return {
      w: Math.ceil(right + 40),
      h: 240,
      body: fill(m.bracket + euro.d + rule + e.solid + e.outlined, t.ink) + fill(m.sign, t.accent),
    };
  },
  mark(t) {
    const m = ePlus(37, 20, 200);
    return { w: MARK_BOX, h: MARK_BOX, body: fill(m.bracket, t.ink) + fill(m.sign, t.accent) };
  },
});

// ---------------------------------------------------------------------------------------------
// K3 — Kurziv: the whole name takes the grammar of the OEM Parts logo
// ---------------------------------------------------------------------------------------------
concept({
  id: "k3",
  slug: "kurziv",
  title: "Kurziv",
  idea: "Wordmark only, in the voice of the OEM Parts logo: solid bold italic, a hairline that overshoots to the left, outlined „Parts“ right-aligned below.",
  primary(t) {
    const x0 = 110;
    const euro = wordAt("EUROMOTORS", FACE.oem, 100, x0, 140, { tracking: 0.005 });
    const plusWord = wordAt("PLUS", FACE.oem, 100, euro.bbox.x2 + 44, 140, { tracking: 0.005 });
    const right = plusWord.bbox.x2;
    const rule = slantedRule(x0 - 70, right + 8, 164, 5, 12);
    const e = endorsement({ cap: 46, x: right + 2, y: 240, anchor: "end" });
    return {
      w: Math.ceil(right + 50),
      h: 290,
      body: fill(euro.d + rule + e.solid + e.outlined, t.ink) + fill(plusWord.d, t.accent),
    };
  },
  mark(t) {
    const eL = wordAt("E", FACE.oem, 108, 22, 146);
    const stroke = 10;
    const pL = wordAt("P", FACE.parts, 108, eL.bbox.x2 + 10 + stroke / 2, 146);
    const pOut = expandStroke(pL.d, stroke, { miterLimit: 3 });
    const rule = slantedRule(8, 230, 170, 9, 12);
    return { w: MARK_BOX, h: MARK_BOX, body: fill(eL.d + pOut, t.ink) + fill(rule, t.accent) };
  },
});

// ---------------------------------------------------------------------------------------------
// K4 — Vijak: a bolt head with the twelve-point (triple-square) drive every VAG mechanic owns a bit for
// ---------------------------------------------------------------------------------------------
function boltHead(cx, cy, r) {
  const head = ring(cx, cy, r, r * 0.78);
  const drive = star(cx, cy, r * 0.6, r * 0.6 * 0.7321, 12, 15);
  return { head, drive };
}

concept({
  id: "k4",
  slug: "vijak",
  title: "Vijak",
  idea: "A part silhouette: a bolt head seen from above, with the twelve-point triple-square drive used all over VAG cars. The old stars become one precise star.",
  primary(t) {
    const b = boltHead(120, 120, 80);
    const x0 = 244;
    const euro = wordAt("EUROMOTORS PLUS", FACE.display, 72, x0, 116, { tracking: 0.02 });
    const e = endorsement({ cap: 38, x: x0, y: 190 });
    return {
      w: Math.ceil(euro.bbox.x2 + 40),
      h: 240,
      body: fill(b.head + euro.d + e.solid + e.outlined, t.ink) + fill(b.drive, t.accent),
    };
  },
  mark(t) {
    const b = boltHead(120, 120, 108);
    return { w: MARK_BOX, h: MARK_BOX, body: fill(b.head, t.ink) + fill(b.drive, t.accent) };
  },
});

// ---------------------------------------------------------------------------------------------
// K5 — Pečat: an OEM Parts seal
// ---------------------------------------------------------------------------------------------
concept({
  id: "k5",
  slug: "pecat",
  title: "Pečat",
  idea: "A seal: the redrawn OEM Parts logo in the centre, Euromotors Plus running around it, like the inspection stamp on a part.",
  primary(t) {
    const c = 250;
    const outer = ring(c, c, 240, 229);
    const inner = ring(c, c, 168, 164);
    const top = arcText("EUROMOTORS", FACE.display, 34, c, c, 181, 90, { tracking: 0.16 });
    const bottom = arcText("PLUS", FACE.display, 34, c, c, 215, 270, { tracking: 0.3, flip: true });
    let ticks = "";
    for (const a of [-1, 1]) {
      for (let i = 0; i < 9; i++) {
        const deg = 270 + a * (34 + i * 7.5);
        ticks += rotate(rect(c - 2, c + 186, 4, i % 4 === 0 ? 26 : 15), 270 - deg, c, c);
      }
    }
    const s = oemStack({ cap: 66, cx: c + 2, top: c - 66 });
    const signs = plus(c - 198, c, 22, 7) + plus(c + 198, c, 22, 7);
    return {
      w: 500,
      h: 500,
      body:
        fill(outer + inner + top.d + bottom.d + ticks + s.solid + s.outlined, t.ink) +
        fill(signs, t.accent),
    };
  },
  mark(t) {
    const c = 120;
    const outer = ring(c, c, 114, 96);
    const em = word("EM", FACE.oem, 62);
    const w = em.bbox.x2 - em.bbox.x1;
    const letters = wordAt("EM", FACE.oem, 62, c - w / 2 - 6, c + 31);
    const sign = plus(c + 52, c - 46, 30, 10);
    return {
      w: MARK_BOX,
      h: MARK_BOX,
      body: fill(outer + letters.d, t.ink) + fill(sign, t.accent),
    };
  },
});

// ---------------------------------------------------------------------------------------------
// K6 — Etiketa: the label on the box / the title block of a drawing
// ---------------------------------------------------------------------------------------------
function tag(x, y, s) {
  const cut = s * 0.2;
  const body = poly([
    [x, y],
    [x + s - cut, y],
    [x + s, y + cut],
    [x + s, y + s],
    [x, y + s],
  ]);
  return difference(body, plus(x + s / 2, y + s / 2, s * 0.56, s * 0.18));
}

concept({
  id: "k6",
  slug: "etiketa",
  title: "Etiketa",
  idea: "The logo as a part label and a drawing title block: a frame with cells, the plus in an orange tag, a measured ruler.",
  primary(t) {
    const x0 = 30;
    const y0 = 30;
    const H = 220;
    const line = 5;
    const euro = wordAt("EUROMOTORS PLUS", FACE.display, 62, x0 + H + 36, y0 + 96, {
      tracking: 0.03,
    });
    const W = euro.bbox.x2 + 36 - x0;
    const frame = difference(
      rect(x0, y0, W, H),
      rect(x0 + line, y0 + line, W - 2 * line, H - 2 * line),
    );
    const midY = y0 + 132;
    const hRule = rect(x0 + H, midY, W - H, line);
    const e = endorsement({ cap: 34, x: x0 + H + 36, y: midY + line + 58 });
    const vX = e.x2 + 36;
    const vRule = rect(vX, midY, line, H - 132);
    let ticks = "";
    const tx0 = vX + 36;
    const tx1 = x0 + W - 36;
    const count = Math.floor((tx1 - tx0) / 14);
    for (let i = 0; i <= count; i++) {
      const tall = i % 5 === 0;
      ticks += rect(tx0 + i * 14, y0 + H - line - 22 - (tall ? 24 : 10), 3, tall ? 24 : 10);
    }
    const cell = tag(x0, y0, H);
    return {
      w: Math.ceil(x0 + W + 30),
      h: H + 60,
      body:
        fill(frame + hRule + vRule + euro.d + e.solid + e.outlined + ticks, t.ink) +
        fill(cell, t.accent),
    };
  },
  mark(t) {
    return { w: MARK_BOX, h: MARK_BOX, body: fill(tag(18, 18, 204), t.accent) };
  },
});

// ---------------------------------------------------------------------------------------------
// K7 — Izvučen plus: the plus is the word „Plus“, and one of its parts is lifted out
// ---------------------------------------------------------------------------------------------
concept({
  id: "k7",
  slug: "izvucen-plus",
  title: "Izvučen plus",
  idea: "The name ends in a sign: EUROMOTORS followed by a plus whose upper arm is lifted out in orange — the part you came for. Under the rule, the OEM Parts signature.",
  primary(t) {
    const x0 = 40;
    const base = 150;
    const euro = wordAt("EUROMOTORS", FACE.display, 100, x0, base, { tracking: 0.02 });
    const sign = liftedPlus({
      cx: euro.bbox.x2 + 40 + 56,
      top: base - 106,
      span: 112,
      t: 32,
      lift: 12,
    });
    const right = sign.x2;
    const rule = rect(x0, base + 26, right - x0, 5);
    const e = endorsement({ cap: 44, x: right, y: base + 26 + 5 + 22 + 44, anchor: "end" });
    return {
      w: Math.ceil(right + 40),
      h: 290,
      body:
        fill(euro.d + sign.body + rule + e.solid + e.outlined, t.ink) + fill(sign.part, t.accent),
    };
  },
  mark(t) {
    const sign = liftedPlus({ cx: 120, top: 34, span: 186, t: 56, lift: 14 });
    return { w: MARK_BOX, h: MARK_BOX, body: fill(sign.body, t.ink) + fill(sign.part, t.accent) };
  },
});

// ---------------------------------------------------------------------------------------------
// Build
// ---------------------------------------------------------------------------------------------
const only = process.argv.slice(2);
const list = only.length ? CONCEPTS.filter((c) => only.includes(c.id)) : CONCEPTS;
await mkdir(path.join(OUT, "renders"), { recursive: true });
await mkdir(path.join(OUT, "sheets"), { recursive: true });

const MARK_SIZES = [16, 32, 64, 256];

for (const c of list) {
  const name = `${c.id}-${c.slug}`;
  const png = {};
  for (const themeName of ["night", "paper"]) {
    const t = THEMES[themeName];
    for (const kind of ["primary", "mark"]) {
      const art = c[kind](t);
      const label = `${c.title} — Euromotors Plus by OEM Parts (${kind}, ${themeName})`;
      await writeFile(
        path.join(OUT, `${name}-${kind}-${themeName}.svg`),
        svgDoc({ ...art, title: label }) + "\n",
      );
      const withBg = svgDoc({ ...art, bg: t.bg });
      if (kind === "primary") {
        // padded to a common sheet cell: 760 × 380, the lockup fitted inside 680 × 300
        const k = Math.min(680 / art.w, 300 / art.h);
        const buf = svgToPng(withBg, Math.round(art.w * k));
        const file = path.join(OUT, "renders", `${name}-primary-${themeName}.png`);
        await writeFile(file, svgToPng(withBg, 1200));
        png[`primary-${themeName}`] = buf;
      } else {
        for (const size of MARK_SIZES) {
          const buf = svgToPng(withBg, size);
          await writeFile(path.join(OUT, "renders", `${name}-mark-${themeName}-${size}.png`), buf);
          png[`mark-${themeName}-${size}`] = buf;
        }
      }
    }
  }

  // One-colour proofs: white on night, black on white.
  for (const [themeName, mono] of [
    ["night", THEMES.white],
    ["paper", THEMES.black],
  ]) {
    const lock = c.primary(mono);
    const k = Math.min(520 / lock.w, 170 / lock.h);
    png[`mono-primary-${themeName}`] = svgToPng(
      svgDoc({ ...lock, bg: mono.bg }),
      Math.round(lock.w * k),
    );
    await writeFile(
      path.join(OUT, "renders", `${name}-primary-mono-${mono.name}.png`),
      svgToPng(svgDoc({ ...lock, bg: mono.bg }), 1200),
    );
    const mk = c.mark(mono);
    for (const size of [128, 16]) {
      png[`mono-mark-${themeName}-${size}`] = svgToPng(svgDoc({ ...mk, bg: mono.bg }), size);
      await writeFile(
        path.join(OUT, "renders", `${name}-mark-mono-${mono.name}-${size}.png`),
        png[`mono-mark-${themeName}-${size}`],
      );
    }
  }

  // Contact sheet: two columns (night | paper). Row 1 the lockup; row 2 the mark at 256, 64, 32, 16
  // and the 32 / 16 px files again enlarged ×4 / ×8 without smoothing; row 3 the one-colour proofs.
  const COL = 840;
  const SHEET_H = 980;
  const layers = [];
  for (const [col, themeName] of ["night", "paper"].entries()) {
    const t = THEMES[themeName];
    const ox = col * COL;
    layers.push({
      input: { create: { width: COL, height: SHEET_H, channels: 4, background: t.bg } },
      left: ox,
      top: 0,
    });
    const lock = png[`primary-${themeName}`];
    const meta = await sharp(lock).metadata();
    layers.push({
      input: lock,
      left: ox + Math.round((COL - meta.width) / 2),
      top: Math.round((380 - meta.height) / 2),
    });
    let x = ox + 40;
    for (const size of [256, 64, 32, 16]) {
      layers.push({ input: png[`mark-${themeName}-${size}`], left: x, top: 420 + (256 - size) });
      x += size + 28;
    }
    for (const [size, zoom] of [
      [32, 4],
      [16, 8],
    ]) {
      const big = await sharp(png[`mark-${themeName}-${size}`])
        .resize(size * zoom, size * zoom, { kernel: "nearest" })
        .png()
        .toBuffer();
      layers.push({ input: big, left: x, top: 420 + (256 - size * zoom) });
      x += size * zoom + 20;
    }
    const monoLock = png[`mono-primary-${themeName}`];
    const mm = await sharp(monoLock).metadata();
    layers.push({ input: monoLock, left: ox + 40, top: 760 + Math.round((180 - mm.height) / 2) });
    layers.push({ input: png[`mono-mark-${themeName}-128`], left: ox + 600, top: 786 });
    layers.push({ input: png[`mono-mark-${themeName}-16`], left: ox + 750, top: 898 });
  }
  await sharp({ create: { width: COL * 2, height: SHEET_H, channels: 4, background: "#808080" } })
    .composite(layers)
    .png()
    .toFile(path.join(OUT, "sheets", `${name}.png`));
  console.log(`built ${name}`);
}
