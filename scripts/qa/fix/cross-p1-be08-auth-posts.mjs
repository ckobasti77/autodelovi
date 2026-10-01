/**
 * BE-08 (cross-p1, step 22): count POST /api/auth (token refresh) per signed-in page load with
 * ConvexReactClient initialAuthTokenReuse. Signs in the audit customer, then loads three pages.
 *   AUDIT_BASE=http://localhost:3001 node scripts/qa/fix/cross-p1-be08-auth-posts.mjs
 */
import { readFileSync, writeFileSync } from "node:fs";
import { BASE, launch, loginWith, newContext } from "../audit/kit.mjs";

const acc = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8")).customer;
const browser = await launch();
const rows = [];
try {
  const ctx = await newContext(browser, { width: 1440, height: 900, tag: "cp1-be08" });
  const page = await ctx.newPage();
  let posts = 0;
  page.on("request", (r) => {
    if (r.method() === "POST" && new URL(r.url()).pathname === "/api/auth") posts++;
  });
  await loginWith(page, acc.email, acc.password);
  await page.waitForTimeout(3000);
  for (const url of ["/nalog", "/delovi/kocioni-diskovi", "/nalog/porudzbine"]) {
    posts = 0;
    await page.goto(BASE + url, { waitUntil: "load", timeout: 180000 });
    await page.waitForTimeout(6000);
    const signedIn = await page.getByTestId("account-button").first().getAttribute("aria-label").catch(() => null);
    rows.push({ url, authPosts: posts, accountButton: signedIn });
    console.log(JSON.stringify(rows.at(-1)));
  }
  await ctx.close();
} finally {
  await browser.close();
  writeFileSync("docs/qa/fix/cross-p1/be08-auth-posts.json", JSON.stringify(rows, null, 1));
}
