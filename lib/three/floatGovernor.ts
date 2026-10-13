/**
 * The idle float of docked parts is decoration (docs/3d/HERO-V2.md §4, §13): on a device that
 * cannot hold it, it must not keep the main thread busy — a tap on a slot would wait behind
 * frames nobody asked for. The governor watches the gaps between consecutive float frames and
 * says when to stop; the parts then rest still in their slots and everything else works as
 * before. Pure: no clock, no DOM.
 *
 * It judges a window by its majority, not by its mean: one long task (a dialog opening, a
 * collection pause, a tab switch) is a single slow frame and changes nothing.
 */

/** Float frames in a window … */
export const FLOAT_WINDOW = 24;
/** … or this much float time (ms), whichever comes first: a very slow device is judged at once. */
export const FLOAT_WINDOW_MS = 1500;
/** A frame gap above this (ms) is a slow frame: under about 22 frames a second. */
export const FLOAT_MAX_GAP_MS = 45;
const MIN_SAMPLES = 4;
/** A gap this long is a pause (the tab was hidden), not a frame. */
const PAUSE_MS = 4000;

export type FloatGovernor = {
  /** Feed the gap since the previous float frame; true once the float should stop for good. */
  sample: (gapMs: number) => boolean;
  /** The run of float frames was interrupted: start a new window. */
  reset: () => void;
};

export function createFloatGovernor(): FloatGovernor {
  let time = 0;
  let count = 0;
  let slow = 0;
  let stopped = false;
  const reset = () => {
    time = 0;
    count = 0;
    slow = 0;
  };
  return {
    sample(gapMs) {
      if (stopped) return true;
      if (!(gapMs > 0) || gapMs >= PAUSE_MS) return false;
      time += gapMs;
      count += 1;
      if (gapMs > FLOAT_MAX_GAP_MS) slow += 1;
      if (count < FLOAT_WINDOW && (time < FLOAT_WINDOW_MS || count < MIN_SAMPLES)) return false;
      stopped = slow * 2 > count;
      reset();
      return stopped;
    },
    reset,
  };
}
