// perf-3d track: WebGL2 extensions relevant to the 3D start (parallel shader compile) on ANGLE D3D11.
import { chromium } from "@playwright/test";
import { GPU_ARGS } from "./perf-3d-gl.mjs";
const b = await chromium.launch({ args: GPU_ARGS });
const p = await b.newPage();
await p.goto("about:blank");
console.log(
  await p.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl2");
    const info = gl.getExtension("WEBGL_debug_renderer_info");
    return {
      renderer: gl.getParameter(info.UNMASKED_RENDERER_WEBGL),
      parallel: !!gl.getExtension("KHR_parallel_shader_compile"),
      maxSamples: gl.getParameter(gl.MAX_SAMPLES),
      timer: !!gl.getExtension("EXT_disjoint_timer_query_webgl2"),
    };
  }),
);
await b.close();
