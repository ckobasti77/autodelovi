import { describe, expect, test } from "vitest";

import { FLOAT_MAX_GAP_MS, FLOAT_WINDOW, createFloatGovernor } from "@/lib/three/floatGovernor";

function feed(governor: ReturnType<typeof createFloatGovernor>, gaps: number[]): boolean {
  let stop = false;
  for (const gap of gaps) stop = governor.sample(gap);
  return stop;
}

const run = (gap: number, frames = FLOAT_WINDOW) => Array.from({ length: frames }, () => gap);

describe("float governor", () => {
  test("a device that holds 60 or 30 frames a second keeps floating", () => {
    expect(feed(createFloatGovernor(), run(16.7, FLOAT_WINDOW * 10))).toBe(false);
    expect(feed(createFloatGovernor(), run(33.4, FLOAT_WINDOW * 10))).toBe(false);
  });

  test("one long task in a window does not stop it, however long", () => {
    for (const hiccup of [400, 900, 2500]) {
      const gaps = run(16.7, FLOAT_WINDOW * 3);
      gaps[5] = hiccup;
      expect(feed(createFloatGovernor(), gaps), `${hiccup} ms`).toBe(false);
    }
  });

  test("a window of mostly slow frames stops it, and it stays stopped", () => {
    const governor = createFloatGovernor();
    const slow = run(FLOAT_MAX_GAP_MS + 5);
    expect(feed(governor, slow.slice(0, FLOAT_WINDOW - 1))).toBe(false);
    expect(governor.sample(slow[0])).toBe(true);
    expect(governor.sample(16.7)).toBe(true);
  });

  test("a very slow renderer is judged after a second and a half, not after 24 frames", () => {
    const governor = createFloatGovernor();
    expect(feed(governor, [300, 300, 300, 300])).toBe(false);
    expect(governor.sample(300)).toBe(true);
    // Frames of more than a second count too (a software renderer at full size).
    expect(feed(createFloatGovernor(), [1200, 1200, 1200, 1200])).toBe(true);
  });

  test("a hidden tab is a pause, and an interrupted run starts a new window", () => {
    const governor = createFloatGovernor();
    expect(feed(governor, run(60_000, FLOAT_WINDOW * 2))).toBe(false);
    feed(governor, [200, 200, 200]);
    governor.reset();
    expect(feed(governor, [200, 200, 200])).toBe(false);
  });
});
