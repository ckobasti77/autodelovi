/**
 * flows-shop: zero-result searches are logged (admin /admin/pretrage). Runs a fresh zero-result
 * query as a guest, then reads the admin report. Evidence: F-admin-pretrage-1440.webp.
 */
import { BASE, launch, loginAdmin, newContext, shot, watch } from "./kit.mjs";
import { saveJson, sleep } from "./flows-shop-lib.mjs";

const out = {};
const browser = await launch();
const g = await newContext(browser, { width: 390, height: 844, tag: "flows-zero" });
const gp = await g.newPage();
gp.setDefaultNavigationTimeout(150_000);
const q = `zzaudit${Date.now().toString(36)}`;
out.q = q;
await gp.goto(`${BASE}/pretraga?q=${q}`, { waitUntil: "domcontentloaded" });
await gp.locator("h1").first().waitFor({ timeout: 60_000 });
out.zeroText = (await gp.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 700);
await shot(gp, "flows-shop/F-search-zero-390");
await g.close();
await sleep(3000);
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "flows-admin-search" });
const page = await ctx.newPage();
page.setDefaultTimeout(90_000);
page.setDefaultNavigationTimeout(150_000);
const log = watch(page);
const email = process.env.SEED_ADMIN_EMAIL;
const password = process.env.SEED_ADMIN_PASSWORD;
await page.goto(`${BASE}/prijava?next=%2Fadmin%2Fpretrage`, { waitUntil: "domcontentloaded" });
await page.getByTestId("auth-email").waitFor();
await page.waitForFunction(() => Object.keys(document.querySelector('[data-testid="auth-submit"]') ?? {}).some((k) => k.startsWith("__react")), null, { timeout: 120_000 });
await page.getByTestId("auth-email").fill(email);
await page.getByTestId("auth-password").fill(password);
await page.getByTestId("auth-submit").click();
await page.waitForURL(/\/admin/, { timeout: 150_000 });
if (!/pretrage/.test(page.url())) await page.goto(`${BASE}/admin/pretrage`, { waitUntil: "domcontentloaded" });
await sleep(6000);
const body = await page.locator("main").innerText().catch(() => "");
out.found = body.includes(q);
out.foundPrior = { zzqx: body.includes("zzqxmuockym5"), oem: /03L ?253 ?016 ?T/i.test(body) };
out.head = body.replace(/\s+/g, " ").slice(0, 1500);
await shot(page, "flows-shop/F-admin-pretrage-1440");
out.log = log;
console.log(JSON.stringify(out, null, 1));
saveJson("admin-search.json", out);
await browser.close();
