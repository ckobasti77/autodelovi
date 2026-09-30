/**
 * Mechanics portal screenshots (docs/qa/MECHANICS.md): registers a workshop through the real
 * UI, captures the pending state, approves it with the internal helper, fills favorites, a
 * customer vehicle, a quick order and a deferred-payment order, then captures every
 * `/za-majstore…`, `/majstor…` and `/admin/majstori…` page at 1440 and 390 (admin: 1440 and
 * 1024) into docs/qa/screens/step-14/.
 *   node scripts/qa/mechanic-shots.mjs [baseUrl]
 * Needs SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD for the admin shots.
 */
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3100";
const outDir = path.resolve("docs/qa/screens/step-14");
mkdirSync(outDir, { recursive: true });
const stamp = Date.now();
const email = `qa-majstor-${stamp}@primer.rs`;
const password = `Radionica${stamp}`;

function convexRun(fn, args = {}) {
  const out = execFileSync(
    process.execPath,
    [path.resolve("node_modules/convex/bin/main.js"), "run", `testing:${fn}`, JSON.stringify(args)],
    { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120_000 },
  );
  return JSON.parse(out.slice(out.search(/[[{]|^null/m)));
}

/** Check digits — same algorithms as lib/domain/identifiers (PIB: ISO 7064 MOD 11,10). */
function pibCheck(first8) {
  let s = 10;
  for (const ch of first8) {
    s = (s + Number(ch)) % 10;
    s = ((s === 0 ? 10 : s) * 2) % 11;
  }
  return (11 - s) % 10;
}
function mbCheck(first7) {
  const w = [2, 7, 6, 5, 4, 3, 2];
  const sum = [...first7].reduce((acc, ch, i) => acc + Number(ch) * w[i], 0);
  const k = 11 - (sum % 11);
  return k > 9 ? 0 : k;
}

const samples = convexRun("samples");
const quick = convexRun("quickOrderSamples");
const slug = samples.inStock.slug;

const WIDTHS = [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "390", width: 390, height: 844 },
];

async function settle(page) {
  await page.waitForTimeout(1200);
  await page.evaluate(async () => {
    for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight * 0.6) {
      window.scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 110));
    }
    window.scrollTo(0, document.documentElement.scrollHeight);
    await new Promise((r) => setTimeout(r, 900));
    window.scrollTo(0, 0);
    await new Promise((r) => setTimeout(r, 400));
  });
}

async function shoot(page, name, tag, errors) {
  await settle(page);
  await page.screenshot({ path: path.join(outDir, `${name}-${tag}.png`), fullPage: true });
  console.log(`${name}@${tag}: errors=${errors.length}${errors.length ? ` → ${errors[0]}` : ""}`);
  errors.length = 0;
}

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: `Mozilla/5.0 SklopQA-mechanic/${stamp}`,
});
const page = await context.newPage();
const errors = [];
page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
page.on("pageerror", (e) => errors.push(e.message));

// Anonymous: landing and the empty registration form.
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w.width, height: w.height });
  await page.goto(`${base}/za-majstore`, { waitUntil: "networkidle" });
  await shoot(page, "landing", w.tag, errors);
  await page.goto(`${base}/za-majstore/registracija`, { waitUntil: "networkidle" });
  await shoot(page, "registration", w.tag, errors);
}

// Registration with a validation error shown, then the real submit.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/za-majstore/registracija`, { waitUntil: "networkidle" });
const seed = String(stamp).slice(-7);
const pib8 = `2${seed}`;
const mb7 = `7${seed.slice(-6)}`;
await page.getByTestId("mechanic-reg-email").fill(email);
await page.getByTestId("mechanic-reg-password").fill(password);
await page.getByTestId("mechanic-reg-company").fill("Auto servis Jović");
await page.getByTestId("mechanic-reg-pib").fill("123456789");
await page.getByTestId("mechanic-reg-submit").click();
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(outDir, "registration-errors-1440.png"), fullPage: true });
await page.getByTestId("mechanic-reg-pib").fill(`${pib8}${pibCheck(pib8)}`);
await page.getByTestId("mechanic-reg-mb").fill(`${mb7}${mbCheck(mb7)}`);
await page.getByTestId("mechanic-reg-contact").fill("Dragan Jović");
await page.getByTestId("mechanic-reg-phone").fill("064 555 1234");
await page.getByTestId("mechanic-reg-city").fill("Kragujevac");
await page.getByTestId("mechanic-reg-address").fill("Kralja Petra I 12");
await page.getByTestId("mechanic-reg-service-mehanika").click();
await page.getByTestId("mechanic-reg-service-dijagnostika").click();
await page.getByRole("checkbox", { name: "Volkswagen" }).click();
await page.getByRole("checkbox", { name: "Škoda" }).click();
await page.getByTestId("mechanic-reg-terms").click();
await page.getByTestId("mechanic-reg-submit").click();
await page.waitForURL(/\/za-majstore\/hvala/, { timeout: 45_000 });
errors.length = 0;
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w.width, height: w.height });
  await page.goto(`${base}/za-majstore/hvala`, { waitUntil: "networkidle" });
  await shoot(page, "thanks", w.tag, errors);
  await page.goto(`${base}/majstor`, { waitUntil: "networkidle" });
  await shoot(page, "portal-pending", w.tag, errors);
}

// Approve (internal helper), then fill the portal with data.
const approved = convexRun("approveMechanic", {
  email,
  tierSlug: "majstor-plus",
  creditEnabled: true,
  creditLimitPara: 50_000_000,
});
console.log(`approved as ${approved.tierName}`);
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/deo/${slug}`, { waitUntil: "networkidle" });
await page.getByTestId("favorite-toggle").click();
await page.waitForTimeout(800);
await page.goto(`${base}/deo/${quick.exact.slug}`, { waitUntil: "networkidle" });
await page.getByTestId("favorite-toggle").click();
await page.waitForTimeout(800);

await page.goto(`${base}/majstor/vozila`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Dodaj vozilo mušterije" }).click();
await page.getByLabel("Mušterija ili oznaka").fill("Petrović — Golf");
await page.getByLabel("Broj šasije (VIN)").fill("WVWZZZAUZHW123456");
await page.waitForTimeout(300);
await page.getByLabel("Tablice").fill("KG 123-AB");
await page.getByLabel("Napomena").fill("Menjan zupčasti kaiš 03.2026.");
await page.getByRole("button", { name: "Sačuvaj vozilo" }).click();
await page.waitForTimeout(1200);

const lines = [`${quick.exact.code} 2`, ...(quick.ambiguous ? [`${quick.ambiguous.code} 1`] : []), "5Q0 698 151 x4", "ZZ9999999 3", "hvala"];
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w.width, height: w.height });
  await page.goto(`${base}/majstor/brza-porudzbina`, { waitUntil: "networkidle" });
  await page.getByTestId("mechanic-quick-order-input").fill("");
  await shoot(page, "quick-order-empty", w.tag, errors);
  await page.getByTestId("mechanic-quick-order-input").fill(lines.join("\n"));
  await page.getByTestId("mechanic-quick-order-check").click();
  await page.getByTestId("mechanic-quick-order-row").first().waitFor();
  await page.waitForFunction(() => !document.querySelector('[data-testid="mechanic-quick-order-row"][data-status="pending"]'));
  await shoot(page, "quick-order-results", w.tag, errors);
}
const ambiguousRow = page.locator('[data-testid="mechanic-quick-order-row"][data-status="ambiguous"]').first();
if (await ambiguousRow.count()) await ambiguousRow.getByRole("radio").first().check();
await page.getByTestId("mechanic-quick-order-add-all").click();
await page.waitForTimeout(1500);

// Deferred-payment order.
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/porudzbina`, { waitUntil: "networkidle" });
await page.getByTestId("checkout-step-contact").waitFor({ timeout: 20_000 });
await page.screenshot({ path: path.join(outDir, "checkout-contact-mechanic-1440.png"), fullPage: true });
await page.getByTestId("checkout-next").click();
await page.getByLabel("Poštanski broj").fill("34000");
await page.getByTestId("checkout-next").click();
await page.getByRole("radio", { name: /Odloženo plaćanje/ }).click();
await page.screenshot({ path: path.join(outDir, "checkout-payment-mechanic-1440.png"), fullPage: true });
await page.getByTestId("checkout-next").click();
await page.getByRole("checkbox", { name: /Prihvatam uslove kupovine/ }).click();
await page.waitForTimeout(3200);
await page.getByTestId("checkout-submit").click();
await page.waitForURL(/\/porudzbina\/hvala\//, { timeout: 30_000 });
const number = (await page.getByTestId("order-number").first().textContent())?.trim() ?? "";
console.log(`ORDER ${number}`);
errors.length = 0;

const pages = [
  { name: "portal", path: "/majstor" },
  { name: "orders", path: "/majstor/porudzbine" },
  { name: "order", path: `/majstor/porudzbine/${encodeURIComponent(number)}` },
  { name: "favorites", path: "/majstor/omiljeno" },
  { name: "vehicles", path: "/majstor/vozila" },
  { name: "price-list", path: "/majstor/cenovnik" },
  { name: "inquiries", path: "/majstor/upiti" },
  { name: "profile", path: "/majstor/profil" },
  { name: "product-mechanic", path: `/deo/${slug}` },
  { name: "search-mechanic", path: `/pretraga?q=${encodeURIComponent(quick.exact.code)}` },
];
for (const w of WIDTHS) {
  await page.setViewportSize({ width: w.width, height: w.height });
  for (const p of pages) {
    await page.goto(`${base}${p.path}`, { waitUntil: "networkidle" });
    await shoot(page, p.name, w.tag, errors);
  }
}
// The price list itself (downloaded through the real route handler).
await page.setViewportSize({ width: 1440, height: 900 });
await page.goto(`${base}/majstor/cenovnik`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Izaberi sve kategorije" }).click();
const [download] = await Promise.all([page.waitForEvent("download"), page.getByTestId("mechanic-price-list-download").click()]);
const file = path.join(outDir, await download.suggestedFilename());
await download.saveAs(file);
console.log(`PRICE LIST ${file}`);
await context.close();

// Admin: owner signs in, list + the new registration's detail.
const adminEmail = process.env.SEED_ADMIN_EMAIL;
const adminPassword = process.env.SEED_ADMIN_PASSWORD;
if (adminEmail && adminPassword) {
  const admin = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const a = await admin.newPage();
  const adminErrors = [];
  a.on("console", (m) => m.type() === "error" && adminErrors.push(m.text()));
  await a.goto(`${base}/prijava?next=%2Fadmin%2Fmajstori`, { waitUntil: "networkidle" });
  await a.getByTestId("auth-email").fill(adminEmail);
  await a.getByTestId("auth-password").fill(adminPassword);
  await a.getByTestId("auth-submit").click();
  await a.waitForURL(/\/admin\/majstori/, { timeout: 30_000 });
  for (const w of [
    { tag: "1440", width: 1440, height: 900 },
    { tag: "1024", width: 1024, height: 768 },
  ]) {
    await a.setViewportSize({ width: w.width, height: w.height });
    await a.goto(`${base}/admin/majstori`, { waitUntil: "networkidle" });
    await a.getByRole("button", { name: /^Svi/ }).click();
    await shoot(a, "admin-mechanics", w.tag, adminErrors);
    await a.getByRole("row").filter({ hasText: "Auto servis Jović" }).first().click();
    await a.waitForURL(/\/admin\/majstori\/.+/);
    await shoot(a, "admin-mechanic", w.tag, adminErrors);
  }
  // A pending registration's decision panel.
  await a.setViewportSize({ width: 1440, height: 900 });
  await a.goto(`${base}/admin/majstori`, { waitUntil: "networkidle" });
  const pendingRow = a.getByTestId("admin-mechanic-row").first();
  if (await pendingRow.count()) {
    await pendingRow.click();
    await a.waitForURL(/\/admin\/majstori\/.+/);
    await shoot(a, "admin-mechanic-pending", "1440", adminErrors);
  }
  await admin.close();
}
await browser.close();
