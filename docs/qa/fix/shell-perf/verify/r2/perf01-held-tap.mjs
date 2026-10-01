// Step 22 shell-perf verify round 2 · PERF-01: a decision tapped (touch) on the static first-visit
// panel while the interactive banner chunk is still in flight. Logs the event path, every POST
// (with status and Set-Cookie), console output and the end state.
// Usage (Git Bash): AUDIT_BASE=http://localhost:3001 node docs/qa/fix/shell-perf/verify/r2/perf01-held-tap.mjs [click|tap] [delayMs] [msAfterHydrationMarker]
import { writeFileSync } from "node:fs";
import { BASE, launch, newContext } from "../../../../../../scripts/qa/audit/kit.mjs";


/** Dev HMR socket proxy: forwards everything until the returned freeze() is called (after
 *  hydration), then drops server pushes, so
 *  Fast Refresh from other agents' edits cannot reset client state mid-test. */
async function hmrGuard(page) {
  // Off by default: in Next 16 dev the Flight debug channel of every server action response
  // travels over this socket, so dropping pushes leaves the action promise pending forever
  // (verified while building this check). R2_FREEZE=1 only for that experiment.
  if (process.env.R2_FREEZE !== "1") return () => {};
  let open = true;
  await page.routeWebSocket((url) => url.pathname.startsWith("/_next/") && url.pathname.includes("hmr"), (ws) => {
    open = true; // a new document (reload) needs the initial sync again
    const server = ws.connectToServer();
    ws.onMessage((m) => server.send(m));
    server.onMessage((m) => {
      if (open) ws.send(m);
    });
  });
  return () => {
    open = false;
  };
}

const MODE = process.argv[2] ?? "tap";
const DELAY = Number(process.argv[3] ?? 3000);
const OFFSET = Number(process.argv[4] ?? 300);
const BANNER = "[data-testid='consent-banner']";
const DEF = '[project]/components/consent/ConsentBanner.tsx [app-client] (ecmascript)", ((__turbopack_context__';
const out = { mode: MODE, delayMs: DELAY, offsetMs: Number(process.argv[4] ?? 300), console: [], posts: [] };
const browser = await launch();
try {
  const ctx = await newContext(browser, { width: 390, height: 844, consent: false, tag: `r2tap-${MODE}` });
  const page = await ctx.newPage();
  page.__freezeHmr = await hmrGuard(page);
  const t0 = Date.now();
  const at = () => Date.now() - t0;
  page.on("console", (m) => out.console.push(`${at()} ${m.type()}: ${m.text().slice(0, 300)}`));
  page.on("pageerror", (e) => out.console.push(`${at()} pageerror: ${String(e).slice(0, 300)}`));
  page.on("request", (r) => {
    if (r.method() === "POST") out.posts.push({ at: at(), url: r.url().replace(BASE, ""), action: r.headers()["next-action"] ?? null, type: r.resourceType(), body: (r.postData() ?? "").slice(0, 200) });
  });
  page.on("response", async (r) => {
    if (r.request().method() !== "POST") return;
    const p = out.posts.find((x) => x.url === r.url().replace(BASE, "") && x.status === undefined);
    if (p) {
      p.status = r.status();
      p.setCookie = ((await r.allHeaders())["set-cookie"] ?? "").slice(0, 120);
      p.respondedAt = at();
    }
  });
  out.requests = [];
  page.on("request", (r) => out.requests.push({ at: at(), url: r.url().replace(BASE, "").slice(0, 90), m: r.method() }));
  page.on("requestfinished", (r) => { const x = out.requests.findLast((q) => q.url === r.url().replace(BASE, "").slice(0, 90) && q.done === undefined); if (x) x.done = at(); });
  page.on("requestfailed", (r) => { const x = out.requests.findLast((q) => q.url === r.url().replace(BASE, "").slice(0, 90) && q.done === undefined); if (x) x.done = `failed ${r.failure()?.errorText}`; });
  let chunkAt = null;
  if (process.env.R2_NO_INTERCEPT !== "1") await page.route("**/_next/static/chunks/**", async (route) => {
    const res = await route.fetch();
    const body = await res.text();
    if (body.includes(DEF)) {
      chunkAt = at();
      await new Promise((r) => setTimeout(r, DELAY));
      out.chunkDeliveredAt = at();
    }
    await route.fulfill({ response: res, body });
  });
  await page.addInitScript(() => {
    window.__ev = [];
    window.addEventListener("unhandledrejection", (e) => window.__ev.push(`unhandledrejection ${String(e.reason).slice(0, 200)}`));
    const f = window.fetch;
    window.fetch = function (input, init) {
      const action = init?.headers && (init.headers["Next-Action"] || init.headers["next-action"] || (init.headers.get && init.headers.get("next-action")));
      const p = f.apply(this, arguments);
      if (action) {
        window.__ev.push(`${Math.round(performance.now())} action fetch start`);
        p.then((r) => { window.__ev.push(`${Math.round(performance.now())} action fetch resolved ${r.status}`); }, (e) => window.__ev.push(`action fetch rejected ${e}`));
      }
      return p;
    };
    for (const type of ["touchstart", "touchend", "pointerdown", "pointerup", "mousedown", "click", "submit"]) {
      document.addEventListener(type, (e) => {
        const t = e.target instanceof Element ? e.target.closest("button,a,form") : null;
        window.__ev.push(`${Math.round(performance.now())} ${type} on ${t ? t.tagName.toLowerCase() + (t.getAttribute("data-consent-key") ? `[${t.getAttribute("data-consent-key")}]` : "") : "?"} prevented=${e.defaultPrevented}`);
      }, false); // bubble phase on document: after the gate's capture listener ran
    }
  });
  await page.goto(`${BASE}/delovi/kocioni-diskovi`, { waitUntil: "load", timeout: 90000 });
  await page.waitForFunction(() => Object.keys(document.querySelector("main") || {}).some((k) => k.startsWith("__reactFiber")), null, { timeout: 60000 });
  out.hydratedSeenAt = at();
  page.__freezeHmr();
  if (OFFSET) await page.waitForTimeout(OFFSET);
  out.chunkRequestedAt = chunkAt;
  await page.evaluate(() => {
    window.__doc = true;
    document.querySelectorAll(`[data-testid='consent-banner'] *`).forEach((el) => (el.__static = true));
  });
  // Optional early interaction elsewhere (R2_PRE=tap|click at the hydration marker), then the
  // decision R2_PRE_WAIT ms later.
  if (process.env.R2_PRE) {
    const h1 = page.locator("main h1").first();
    if (process.env.R2_PRE === "tap") await h1.tap(); else await h1.click();
    out.pre = { mode: process.env.R2_PRE, at: at() };
    await page.waitForTimeout(Number(process.env.R2_PRE_WAIT ?? 5000));
  }
  const btn = page.locator(BANNER).getByRole("button", { name: "Prihvati sve" });
  out.actionAt = at();
  if (MODE === "tap") await btn.tap();
  else await btn.click();
  await page.waitForTimeout(DELAY + 7000);
  const c = (await ctx.cookies()).find((x) => x.name === "sk_consent");
  out.end = {
    at: at(),
    banner: await page.locator(BANNER).count(),
    bannerStatic: await page.evaluate(() => document.querySelector("[data-testid='consent-banner'] button")?.__static === true),
    sameDocument: await page.evaluate(() => window.__doc === true),
    cookie: c ? JSON.parse(decodeURIComponent(c.value)) : null,
    events: await page.evaluate(() => window.__ev),
    devOverlay: await page.evaluate(() => [...document.querySelectorAll("nextjs-portal")].map((n) => [...(n.shadowRoot?.querySelectorAll("*") ?? [])].filter((e) => !["STYLE", "SCRIPT"].includes(e.tagName) && e.children.length === 0).map((e) => e.textContent.trim()).filter(Boolean).join(" | ").replace(/s+/g, " ").slice(0, 600))),
    pendingRequests: out.requests.filter((r) => r.done === undefined),
    bannerState: await page.evaluate(() => {
      const b = document.querySelector("[data-testid='consent-banner']");
      if (!b) return null;
      const cs = getComputedStyle(b);
      const r = b.getBoundingClientRect();
      const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
      return { opacity: cs.opacity, transform: cs.transform, pointerEvents: cs.pointerEvents, visibility: cs.visibility, rect: [Math.round(r.top), Math.round(r.height)], hitInsideBanner: !!hit?.closest("[data-testid='consent-banner']"), buttonsDisabled: [...b.querySelectorAll("button")].map((x) => x.disabled), focus: document.activeElement?.tagName + "#" + (document.activeElement?.id || "") };
    }),
  };
  await ctx.close();
} finally {
  await browser.close();
}
writeFileSync(`docs/qa/fix/shell-perf/verify/r2/perf01-held-${MODE}-${process.argv[4] ?? 300}.json`, JSON.stringify(out, null, 2));
console.log(JSON.stringify(out, null, 1));
