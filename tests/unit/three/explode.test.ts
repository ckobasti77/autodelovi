import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, test } from "vitest";

import { STAGES } from "@/lib/catalog/taxonomy";
import { explodeFactor, parseCarManifest } from "@/lib/three/manifest";
import {
  cameraBlend,
  currentStage,
  HOLD_EXPLODED,
  partFactor,
  partSlot,
  power2InOut,
  progressPerPixel,
  scrollTargetFor,
  shellFade,
  stageEnd,
  stageLocal,
  stageWindows,
} from "@/lib/three/explode";

const manifest = parseCarManifest(
  JSON.parse(readFileSync(resolve(__dirname, "../../../public/models/car.manifest.json"), "utf8")),
);

describe("stage windows (contract F6, D78)", () => {
  test("desktop windows are the taxonomy windows", () => {
    const w = stageWindows("desktop");
    expect([...w.keys()].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
    for (const s of STAGES.filter((x) => x.stage > 0)) {
      expect(w.get(s.stage)).toEqual(s.scroll.desktop);
    }
  });

  test("mobile runs grouped stages sequentially (0–55 %, 45–100 % of the shared window)", () => {
    const w = stageWindows("mobile");
    const [a1, b1] = w.get(1)!;
    const [a2, b2] = w.get(2)!;
    expect(a1).toBeCloseTo(0.1, 6);
    expect(b1).toBeCloseTo(0.1 + 0.55 * 0.22, 6);
    expect(a2).toBeCloseTo(0.1 + 0.45 * 0.22, 6);
    expect(b2).toBeCloseTo(0.32, 6);
    expect(w.get(3)).toEqual([0.3, 0.52]);
    expect(w.get(7)![1]).toBeCloseTo(0.92, 6);
  });

  test("every stage ends by the exploded hold on both timelines", () => {
    for (const t of ["desktop", "mobile"] as const) {
      for (const [, [start, end]] of stageWindows(t)) {
        expect(start).toBeLessThan(end);
        expect(end).toBeLessThanOrEqual(HOLD_EXPLODED + 1e-9);
      }
    }
  });
});

describe("part motion", () => {
  test("matches the manifest helper used by the Blender checks", () => {
    const w = stageWindows("desktop");
    for (const part of manifest.parts.slice(0, 30)) {
      const win = w.get(part.explode.stage)!;
      for (const p of [0, 0.1, 0.3, 0.5, 0.77, 1]) {
        expect(partFactor(p, win, part.explode.order)).toBeCloseTo(
          explodeFactor(p, win, part.explode.order),
          10,
        );
      }
    }
  });

  test("a GSAP tween at partSlot with power2.inOut reproduces the factor", () => {
    const win = [0.28, 0.46] as const;
    const order = 0.6;
    const { start, duration } = partSlot(win, order);
    for (const p of [0.2, 0.33, 0.4, 0.45, 0.5]) {
      const t = Math.min(Math.max((p - start) / duration, 0), 1);
      expect(power2InOut(t)).toBeCloseTo(partFactor(p, win, order), 10);
    }
  });

  test("assembled at 0, fully exploded after the last stage", () => {
    const w = stageWindows("mobile");
    for (const part of manifest.parts) {
      const win = w.get(part.explode.stage)!;
      expect(partFactor(0, win, part.explode.order)).toBe(0);
      expect(partFactor(HOLD_EXPLODED, win, part.explode.order)).toBe(1);
    }
  });
});

describe("stage index", () => {
  const w = stageWindows("desktop");

  test("0 while assembled, 7 through the hold", () => {
    expect(currentStage(0, w)).toBe(0);
    expect(currentStage(0.05, w)).toBe(0);
    expect(currentStage(0.95, w)).toBe(7);
    expect(currentStage(1, w)).toBe(7);
  });

  test("landing on a stage's end shows that stage (windows overlap)", () => {
    for (let k = 1; k <= 7; k++) {
      expect(currentStage(stageEnd(k, w), w)).toBe(k);
    }
    // just past the end of stage 1 the caption moves on to stage 2
    expect(currentStage(0.25, w)).toBe(2);
  });

  // MOT-03: a detent (deep link, index button, phone stepper) scrolls to a whole pixel. The
  // track is 320 vh (≥ 1024 px) or 200 vh long and starts 1 px under the header; viewports are
  // the audited ones plus a sweep, with fractional lengths (1366×768 → 2457.6 px).
  const tracks: Array<{ name: string; timeline: "desktop" | "mobile"; start: number; length: number }> = [
    { name: "1440×900", timeline: "desktop", start: 1, length: 2880 },
    { name: "1280×800", timeline: "desktop", start: 1, length: 2560 },
    { name: "1366×768", timeline: "desktop", start: 1, length: 2457.6 },
    { name: "1920×1080", timeline: "desktop", start: 1, length: 3456 },
    { name: "1024×768", timeline: "desktop", start: 1, length: 2457.6 },
    { name: "390×844", timeline: "mobile", start: 1, length: 1688 },
    { name: "360×640", timeline: "mobile", start: 1, length: 1280 },
    { name: "768×1024", timeline: "mobile", start: 1, length: 2048 },
  ];
  for (let h = 500; h <= 1600; h += 37) {
    tracks.push({ name: `desktop h${h}`, timeline: "desktop", start: 0.5, length: 3.2 * h });
    tracks.push({ name: `mobile h${h}`, timeline: "mobile", start: 0.5, length: 2 * h });
  }

  test("every stage detent lands on its own stage over the real track lengths", () => {
    for (const t of tracks) {
      const windows = stageWindows(t.timeline);
      const end = t.start + t.length;
      const tolerance = progressPerPixel(t.start, end);
      for (let k = 0; k <= 7; k++) {
        const y = scrollTargetFor(stageEnd(k, windows), t.start, end);
        expect(Number.isInteger(y), `${t.name} stage ${k} target ${y}`).toBe(true);
        const p = Math.max(0, (y - t.start) / t.length);
        expect(currentStage(p, windows, tolerance), `${t.name} stage ${k} y ${y} p ${p}`).toBe(k);
        // Even when the browser rounds a fractional target up, one pixel of tolerance keeps it.
        const exact = t.start + stageEnd(k, windows) * t.length;
        const pUp = Math.max(0, (Math.ceil(exact) - t.start) / t.length);
        expect(currentStage(pUp, windows, tolerance), `${t.name} stage ${k} rounded up`).toBe(k);
      }
    }
  });

  test("the audited case: 0.46 on a 2880 px track rounds up to stage 4 without the fixes", () => {
    const windows = stageWindows("desktop");
    const late = (Math.round(1 + 0.46 * 2880) - 1) / 2880; // 1326 px → 0.460069
    expect(currentStage(late, windows)).toBe(4);
    expect(currentStage(late, windows, progressPerPixel(1, 2881))).toBe(3);
    expect(scrollTargetFor(0.46, 1, 2881)).toBe(1325);
  });

  test("scroll targets stay inside the track", () => {
    expect(scrollTargetFor(0, 0.5, 2000)).toBe(1);
    expect(scrollTargetFor(-1, 10, 2000)).toBe(10);
    expect(scrollTargetFor(1, 10, 2000.4)).toBe(2000);
    expect(scrollTargetFor(2, 10, 2000)).toBe(2000);
  });

  test("local progress inside the current stage", () => {
    expect(stageLocal(0.08, 1, w)).toBeCloseTo(0, 6);
    expect(stageLocal(0.16, 1, w)).toBeCloseTo(0.5, 6);
    expect(stageLocal(0.04, 0, w)).toBeCloseTo(0.5, 6);
  });
});

describe("camera and shell", () => {
  test("camera blend eases out across 0.08–0.92 (the dolly leads the explode)", () => {
    expect(cameraBlend(0)).toBe(0);
    expect(cameraBlend(0.08)).toBe(0);
    expect(cameraBlend(0.5)).toBeCloseTo(0.75, 6);
    expect(cameraBlend(0.92)).toBeCloseTo(1, 6);
    expect(cameraBlend(1)).toBeCloseTo(1, 6);
  });

  test("shell fades during stage 1 only", () => {
    const w = stageWindows("desktop");
    expect(shellFade(0.08, w)).toBe(0);
    expect(shellFade(0.24, w)).toBe(1);
    expect(shellFade(0.6, w)).toBe(1);
  });
});
