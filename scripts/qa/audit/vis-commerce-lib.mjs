// vis-commerce helpers shared by the track scripts.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";

export const TRACK = "vis-commerce";
export const OUT = `docs/qa/audit/${TRACK}`;
mkdirSync(OUT, { recursive: true });

export function cartState() {
  return JSON.parse(readFileSync(`${OUT}/_state/cart.json`, "utf8"));
}

/** Layout probe: overflow, tiny targets, small inputs, fixed/sticky overlays. */
export async function probe(page) {
  return page.evaluate(() => {
    const vw = document.documentElement.clientWidth;
    const over = document.documentElement.scrollWidth - vw;
    const vis = (e) => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.height > 0 && cs.visibility !== "hidden" && cs.display !== "none";
    };
    const sel = 'a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=checkbox],[role=radio],[role=tab],summary';
    const tiny = [];
    const under44 = [];
    for (const e of document.querySelectorAll(sel)) {
      if (!vis(e)) continue;
      if (e.closest('[aria-hidden="true"]')) continue;
      const r = e.getBoundingClientRect();
      const label = (e.getAttribute("aria-label") || e.textContent || e.getAttribute("name") || e.tagName).trim().replace(/\s+/g, " ").slice(0, 50);
      const inline = e.tagName === "A" && getComputedStyle(e).display === "inline" && e.closest("p,li,dd,span");
      if ((r.width < 24 || r.height < 24) && !inline) tiny.push(`${e.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} "${label}"`);
      else if (r.height < 44 && !inline && (e.tagName === "BUTTON" || e.tagName === "INPUT" || e.tagName === "SELECT")) under44.push(`${e.tagName.toLowerCase()} ${Math.round(r.width)}x${Math.round(r.height)} "${label}"`);
    }
    const smallInputs = [...document.querySelectorAll("input:not([type=hidden]):not([type=checkbox]):not([type=radio]),textarea,select")]
      .filter(vis)
      .filter((e) => parseFloat(getComputedStyle(e).fontSize) < 16)
      .map((e) => `${e.id || e.name} ${getComputedStyle(e).fontSize}`);
    const offenders =
      over > 0
        ? [...document.querySelectorAll("body *")]
            .filter((e) => e.getBoundingClientRect().right > vw + 1)
            .slice(0, 6)
            .map((e) => `${e.tagName.toLowerCase()}.${String(e.className).split(" ").slice(0, 3).join(".")}`)
        : [];
    return { vw, over, offenders, tiny: tiny.slice(0, 15), tinyCount: tiny.length, under44: under44.slice(0, 10), under44Count: under44.length, smallInputs };
  });
}

export function save(name, data) {
  const f = path.join(OUT, `${name}.json`);
  writeFileSync(f, JSON.stringify(data, null, 2));
  return f;
}

export async function settle(page, ms = 1200) {
  await page.waitForLoadState("networkidle", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(ms);
}

/** kit.loginWith without the networkidle wait (the shared server is slow under load). */
export async function login(page, base, email, password, next) {
  await page.goto(`${base}/prijava?next=${encodeURIComponent(next)}`, { waitUntil: "load", timeout: 90000 });
  await page.getByTestId("auth-email").waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await page.getByTestId("auth-email").fill(email);
  await page.getByTestId("auth-password").fill(password);
  await page.getByTestId("auth-submit").click();
  await page.waitForURL((u) => u.pathname.startsWith(next), { timeout: 90000 });
}

/** Retry navigations on the shared, slow server: page.goto gets 3 attempts of 150 s each. */
export function harden(page) {
  const orig = page.goto.bind(page);
  page.goto = async (url, opts = {}) => {
    let err;
    for (let i = 0; i < 3; i++) {
      try {
        return await orig(url, { ...opts, waitUntil: "load", timeout: 150000 });
      } catch (e) {
        err = e;
        console.log("retry goto", url, String(e).slice(0, 80));
      }
    }
    throw err;
  };
  page.setDefaultTimeout(60000);
  return page;
}
