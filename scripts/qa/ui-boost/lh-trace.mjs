/**
 * One Lighthouse run (mobile, applied throttling) with the trace opened up (steps 26–27,
 * docs/design/UI-BOOST.md §9):
 *   node scripts/qa/ui-boost/lh-trace.mjs http://localhost:3100/delovi/kocioni-diskovi
 *
 * Prints TBT and FCP, the totals of style, layout, paint and script on the main thread, every
 * style pass over more than 150 elements (time: elements @ ms / µs per element) and every long
 * task with what is inside it and how much of it counts as blocking time.
 *
 * What to look for: a style pass over (nearly) every element of the document after first paint.
 * That is a rule with a universal subject that depends on a class of <html>, a `:root:has(…)`
 * selector, or a custom property written on the root — step 26 found and removed four such
 * causes (D328–D330). The pre-step build has none above ~330 elements on the category page.
 */
import * as chromeLauncher from "chrome-launcher";
import lighthouse from "lighthouse";

const url = process.argv[2];
if (!url) throw new Error("usage: node scripts/qa/ui-boost/lh-trace.mjs <url>");

const chrome = await chromeLauncher.launch({
  chromePath: process.env.CHROME_PATH,
  chromeFlags: ["--headless=new", "--no-first-run", "--disable-extensions"],
});
const result = await lighthouse(url, {
  port: chrome.port,
  output: "json",
  logLevel: "error",
  throttlingMethod: "devtools",
  onlyCategories: ["performance"],
});
await chrome.kill();

const trace = result.artifacts.Trace ?? result.artifacts.traces?.defaultPass;
const events = trace.traceEvents;
const audits = result.lhr.audits;
const complete = events.filter((e) => e.ph === "X" && e.dur);
const longTasks = complete.filter((e) => e.name === "RunTask" && e.dur > 50_000);
const byThread = new Map();
for (const t of longTasks) {
  const key = `${t.pid}:${t.tid}`;
  byThread.set(key, (byThread.get(key) ?? 0) + t.dur);
}
const [mainKey] = [...byThread.entries()].sort((a, b) => b[1] - a[1])[0];
const onMain = complete.filter((e) => `${e.pid}:${e.tid}` === mainKey);
const start = Math.min(...onMain.map((e) => e.ts));
const sum = (list) => Math.round(list.reduce((a, e) => a + e.dur, 0) / 1000);
const named = (...names) => onMain.filter((e) => names.includes(e.name));

const styles = named("UpdateLayoutTree");
const big = styles.filter((e) => (e.args?.elementCount ?? 0) > 150);
const fcp = audits["first-contentful-paint"].numericValue;
console.log(
  `TBT ${Math.round(audits["total-blocking-time"].numericValue)} · FCP ${Math.round(fcp)} · ` +
    `style ${sum(styles)} ms in ${styles.length} passes · layout ${sum(named("Layout"))} ms · ` +
    `paint ${sum(named("Paint"))} ms · script ${sum(named("EvaluateScript", "FunctionCall"))} ms`,
);
console.log(
  "style passes over 150 elements (t: elements @ ms / µs per element):\n  " +
    big
      .map(
        (e) =>
          `${Math.round((e.ts - start) / 1000)}: ${e.args.elementCount} @ ${Math.round(e.dur / 1000)} / ${Math.round(e.dur / e.args.elementCount)}`,
      )
      .join("\n  "),
);

const navigation =
  events.find(
    (e) =>
      e.name === "navigationStart" &&
      String(e.args?.data?.documentLoaderURL ?? "").startsWith("http"),
  )?.ts ?? start;
const PARTS = new Set([
  "UpdateLayoutTree",
  "Layout",
  "Paint",
  "PrePaint",
  "ParseHTML",
  "EvaluateScript",
  "FunctionCall",
  "v8.compile",
  "RunMicrotasks",
  "TimerFire",
  "FireAnimationFrame",
  "FireIdleCallback",
  "EventDispatch",
]);
console.log("long tasks (t, duration, blocking after FCP :: inside):");
for (const task of onMain
  .filter((e) => e.name === "RunTask" && e.dur > 50_000)
  .sort((a, b) => a.ts - b.ts)) {
  const at = (task.ts - navigation) / 1000;
  const inside = onMain.filter(
    (e) => e !== task && e.ts >= task.ts && e.ts + e.dur <= task.ts + task.dur && PARTS.has(e.name),
  );
  const sums = new Map();
  for (const e of inside) sums.set(e.name, (sums.get(e.name) ?? 0) + e.dur);
  const top = [...sums.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([name, dur]) => `${name} ${Math.round(dur / 1000)}`);
  const blocking = Math.max(0, at + task.dur / 1000 - Math.max(at + 50, fcp));
  console.log(
    `  @${Math.round(at)} ${Math.round(task.dur / 1000)} ms, blocking ${Math.round(blocking)} :: ${top.join(" · ")}`,
  );
}
