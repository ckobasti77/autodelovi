// flows-admin shared helpers: an owner page that re-logs in when the stored session is gone.
import { existsSync, writeFileSync, mkdirSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { BASE, newContext, loginAdmin } from "./kit.mjs";

export const STATE = path.join(os.tmpdir(), "sklop-flows-admin-state.json");
export const EVID = "docs/qa/audit/flows-admin";
mkdirSync(EVID, { recursive: true });

export async function ownerContext(browser, { width = 1440, height = 900, tag = "fa", reuse = false } = {}) {
  if (reuse && existsSync(STATE)) {
    const ctx = await browser.newContext({
      storageState: STATE,
      viewport: { width, height },
      locale: "sr-Latn-RS",
      timezoneId: "Europe/Belgrade",
      userAgent: `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36 SklopAudit-${tag}/${Date.now()}`,
    });
    const p = await ctx.newPage();
    p.setDefaultTimeout(90_000);
    await p.goto(`${BASE}/admin/revizija`, { waitUntil: "domcontentloaded", timeout: 120_000 });
    if (!p.url().includes("/prijava")) {
      await p.close();
      return ctx;
    }
    await ctx.close();
  }
  const ctx = await newContext(browser, { width, height, tag });
  const p = await ctx.newPage();
  p.setDefaultTimeout(90_000);
  await loginAdmin(p);
  await ctx.storageState({ path: STATE });
  await p.close();
  return ctx;
}

export async function open(ctx, route) {
  const p = await ctx.newPage();
  p.setDefaultTimeout(90_000);
  await p.goto(BASE + route, { waitUntil: "domcontentloaded", timeout: 120_000 });
  await p.waitForLoadState("networkidle", { timeout: 30_000 }).catch(() => {});
  return p;
}

export function save(name, data) {
  writeFileSync(path.join(EVID, name), typeof data === "string" ? data : JSON.stringify(data, null, 2));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
