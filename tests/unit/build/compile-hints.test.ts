import { describe, expect, it } from "vitest";

import {
  COMPILE_HINT,
  hintTargets,
  withCompileHint,
} from "../../../scripts/build/compile-hints.mjs";

describe("compile hints (PERF-01, D294)", () => {
  it("puts the V8 magic comment on the first line, once", () => {
    const chunk = '(globalThis.TURBOPACK||(globalThis.TURBOPACK=[])).push(["x",1]);';
    const hinted = withCompileHint(chunk);
    expect(hinted).toBe(`//# allFunctionsCalledOnLoad\n${chunk}`);
    expect(hinted.split("\n")[0]).toBe(COMPILE_HINT);
    expect(withCompileHint(hinted)).toBe(hinted);
  });

  it("targets only the JS root main files of the build manifest", () => {
    expect(
      hintTargets({
        rootMainFiles: [
          "static/chunks/a.js",
          "static/chunks/b.css",
          "static/chunks/turbopack-c.js",
        ],
        polyfillFiles: ["static/chunks/polyfill.js"],
      }),
    ).toEqual(["static/chunks/a.js", "static/chunks/turbopack-c.js"]);
    expect(hintTargets({})).toEqual([]);
  });
});
