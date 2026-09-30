/**
 * Account-area screenshots (docs/qa/STOREFRONT.md): registers a fresh customer through the
 * real UI, places one order while signed in, saves a vehicle, then captures every `/nalog…`
 * page and the signed-in `/prijava` at 1440 and 390 into docs/qa/screens/step-12/.
 *   node scripts/qa/account-shots.mjs [baseUrl] <productSlug>
 */
import { chromium } from "@playwright/test";
import { mkdirSync } from "node:fs";
import path from "node:path";

const base = process.argv[2] ?? "http://localhost:3100";
const slug = process.argv[3];
if (!slug) throw new Error("product slug required");
const outDir = path.resolve("docs/qa/screens/step-12");
mkdirSync(outDir, { recursive: true });
const stamp = Date.now();

const browser = await chromium.launch();
const setup = await browser.newContext({
  viewport: { width: 1440, height: 900 },
  userAgent: `Mozilla/5.0 SklopQA-account/${stamp}`,
});
const page = await setup.newPage();

// Register.
await page.goto(`${base}/registracija`, { waitUntil: "networkidle" });
await page.getByLabel("Ime i prezime").fill("Jelena Marković");
await page.getByTestId("signup-email").fill(`qa-account-${stamp}@primer.rs`);
await page.getByTestId("signup-password").fill(`Lozinka${stamp}`);
await page.getByRole("checkbox", { name: /Prihvatam uslove korišćenja/ }).click();
await page.getByTestId("signup-submit").click();
await page.waitForURL(/\/nalog/, { timeout: 30_000 });

// Profile phone, then an order while signed in.
await page.goto(`${base}/nalog/profil`, { waitUntil: "networkidle" });
await page.getByLabel("Ime", { exact: true }).fill("Jelena");
await page.getByLabel("Prezime").fill("Marković");
await page.getByLabel("Telefon", { exact: true }).fill("064 222 3344");
await page.getByRole("button", { name: "Sačuvaj" }).click();
await page.waitForTimeout(1500);

await page.goto(`${base}/deo/${slug}`, { waitUntil: "networkidle" });
await page.locator("#buy-box").getByTestId("product-add-to-cart").click();
await page.getByText("Dodato").first().waitFor({ timeout: 20_000 });
await page.goto(`${base}/porudzbina`, { waitUntil: "networkidle" });
await page.getByTestId("checkout-step-contact").waitFor({ timeout: 20_000 });
await page.getByLabel("Ime", { exact: true }).fill("Jelena");
await page.getByLabel("Prezime").fill("Marković");
await page.getByLabel("Telefon", { exact: true }).fill("064 222 3344");
await page.getByLabel("E-pošta").fill(`qa-account-${stamp}@primer.rs`);
await page.getByTestId("checkout-next").click();
await page.getByRole("radio", { name: /Lično preuzimanje/ }).click();
await page.getByTestId("checkout-next").click();
await page.getByTestId("checkout-next").click();
await page.getByRole("checkbox", { name: /Prihvatam uslove kupovine/ }).click();
await page.waitForTimeout(3200);
await page.getByTestId("checkout-submit").click();
await page.waitForURL(/\/porudzbina\/hvala\//, { timeout: 30_000 });
const number = (await page.getByTestId("order-number").first().textContent())?.trim() ?? "";

// A saved vehicle: pick one in the shared picker, then save it on the account page.
await page.goto(`${base}/nalog/vozila`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "Izaberite vozilo" }).first().click();
const picker = page.getByRole("dialog", { name: "Izaberite vozilo" });
await picker.getByRole("button", { name: "Škoda" }).click();
await picker.getByRole("button", { name: /^Octavia/ }).first().click();
await picker.getByRole("button", { name: /Octavia III/ }).first().click();
await picker.getByRole("button", { name: "Ne znam motor" }).click();
await page.getByRole("button", { name: "Sačuvaj ovo vozilo" }).click();
await page.waitForTimeout(1500);
await setup.close();
const email = `qa-account-${stamp}@primer.rs`;
const password = `Lozinka${stamp}`;

const pages = [
  { name: "account", path: "/nalog" },
  { name: "account-orders", path: "/nalog/porudzbine" },
  { name: "account-order", path: `/nalog/porudzbine/${encodeURIComponent(number)}` },
  { name: "account-inquiries", path: "/nalog/upiti" },
  { name: "account-vehicles", path: "/nalog/vozila" },
  { name: "account-profile", path: "/nalog/profil" },
  { name: "signin-signed", path: "/prijava" },
];
for (const w of [
  { tag: "1440", width: 1440, height: 900 },
  { tag: "390", width: 390, height: 844 },
]) {
  // Sign in per context: Convex Auth rotates refresh tokens, so a copied storage state expires.
  const context = await browser.newContext({ viewport: { width: w.width, height: w.height } });
  const login = await context.newPage();
  await login.goto(`${base}/prijava`, { waitUntil: "networkidle" });
  await login.getByTestId("auth-email").fill(email);
  await login.getByTestId("auth-password").fill(password);
  await login.getByTestId("auth-submit").click();
  await login.getByTestId("auth-viewer").waitFor({ timeout: 30_000 });
  await login.close();
  for (const p of pages) {
    const tab = await context.newPage();
    const errors = [];
    tab.on("console", (m) => m.type() === "error" && errors.push(m.text()));
    await tab.goto(`${base}${p.path}`, { waitUntil: "networkidle" });
    await tab.waitForTimeout(1500);
    // Scroll end to end so the text reveal runs everywhere (same as storefront-shots).
    await tab.evaluate(async () => {
      for (let y = 0; y < document.documentElement.scrollHeight; y += window.innerHeight * 0.6) {
        window.scrollTo(0, y);
        await new Promise((r) => setTimeout(r, 120));
      }
      window.scrollTo(0, document.documentElement.scrollHeight);
      await new Promise((r) => setTimeout(r, 900));
      window.scrollTo(0, 0);
      await new Promise((r) => setTimeout(r, 400));
    });
    await tab.screenshot({ path: path.join(outDir, `${p.name}-${w.tag}.png`), fullPage: true });
    console.log(`${p.name}@${w.tag}: errors=${errors.length}${errors.length ? ` → ${errors[0]}` : ""}`);
    await tab.close();
  }
  await context.close();
}
console.log(`ORDER ${number}`);
await browser.close();
