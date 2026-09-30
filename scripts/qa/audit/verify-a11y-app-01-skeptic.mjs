// Skeptic verification of a11y-app-01: stale/revoked session on account URLs.
// Writes docs/qa/audit/verify/a11y-app/a11y-app-01-skeptic.json + screenshots.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, shot, loginWith } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/a11y-app";
mkdirSync(OUT, { recursive: true });
const host = new URL(BASE).hostname;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
// Decodable JWT that expired long ago (the state after >1 h away): forces a real refresh attempt.
const expiredJwt = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({ sub: "x", iat: 1700000000, exp: 1700003600 })}.sig`;

const results = { base: BASE, runs: [] };

async function probe(browser, engine, width, path, refreshToken, label, doShot) {
  const ctx = await newContext(browser, { width, height: width < 1024 ? 844 : 900, engine, tag: "verify-a11y01" });
  await ctx.addCookies([
    { name: "__convexAuthJWT", value: expiredJwt, domain: host, path: "/", httpOnly: true, sameSite: "Lax" },
    { name: "__convexAuthRefreshToken", value: refreshToken, domain: host, path: "/", httpOnly: true, sameSite: "Lax" },
  ]);
  const page = await ctx.newPage();
  const resp = await page.goto(`${BASE}${path}`, { waitUntil: "load", timeout: 60_000 });
  await page.waitForTimeout(1500);
  const r = {
    engine,
    width,
    path,
    label,
    status: resp?.status(),
    location: resp?.headers()["location"] ?? null,
    finalUrl: page.url(),
    title: await page.title(),
    bodyTextLength: (await page.evaluate(() => document.body?.innerText.trim().length ?? -1)),
    htmlLength: (await page.evaluate(() => document.documentElement.outerHTML.length)),
    lang: await page.evaluate(() => document.documentElement.getAttribute("lang")),
    cookiesLeft: (await ctx.cookies()).filter((c) => c.name.includes("convexAuth")).map((c) => c.name),
  };
  if (doShot) r.shot = await shot(page, `verify/a11y-app/a11y-app-01-skeptic-${label}-${engine}-${width}`);
  await page.reload({ waitUntil: "load" });
  await page.waitForTimeout(800);
  r.afterReloadUrl = page.url();
  r.afterReloadTitle = await page.title();
  results.runs.push(r);
  console.log(JSON.stringify(r));
  await ctx.close();
}

const accounts = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));

// 1) Real, genuinely revoked refresh token: sign in as the retail customer, capture it, sign out.
let revoked = null;
{
  const browser = await launch("chromium");
  const ctx = await newContext(browser, { width: 1440, tag: "verify-a11y01-login" });
  const page = await ctx.newPage();
  try {
    await loginWith(page, accounts.customer.email, accounts.customer.password, "/nalog");
    revoked = (await ctx.cookies()).find((c) => c.name.endsWith("__convexAuthRefreshToken"))?.value ?? null;
    await page.goto(`${BASE}/prijava`, { waitUntil: "networkidle" });
    await page.getByTestId("auth-sign-out").click();
    await page.getByTestId("auth-submit").waitFor({ timeout: 30_000 });
    results.revokedCaptured = Boolean(revoked);
  } catch (e) {
    results.revokedError = String(e).slice(0, 300);
  }
  await ctx.close();
  await browser.close();
}

{
  const browser = await launch("chromium");
  await probe(browser, "chromium", 390, "/admin", "revokedtoken123|abc", "admin", true);
  await probe(browser, "chromium", 1440, "/admin/porudzbine/SK-2026-000092", "revokedtoken123|abc", "admin-order-emaillink", true);
  await probe(browser, "chromium", 390, "/majstor", "revokedtoken123|abc", "majstor", false);
  if (revoked) await probe(browser, "chromium", 390, "/nalog/porudzbine", revoked, "nalog-real-revoked", true);
  await browser.close();
}
for (const engine of ["firefox", "webkit"]) {
  try {
    const browser = await launch(engine);
    await probe(browser, engine, 1440, "/nalog", "revokedtoken123|abc", "nalog", true);
    await browser.close();
  } catch (e) {
    results.runs.push({ engine, error: String(e).slice(0, 300) });
  }
}

writeFileSync(`${OUT}/a11y-app-01-skeptic.json`, JSON.stringify(results, null, 2));
