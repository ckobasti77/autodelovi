/**
 * flows-shop: VIN inquiry — empty submit, VIN 16 chars, valid VIN → WMI/model prefill, photos
 * (wrong type, > 8 MB, 6 at once), submit, thank-you and status page, inquiryProbe.
 * 390 px guest. Evidence: docs/qa/audit/flows-shop/I-*.webp + inquiry.json.
 */
import sharp from "sharp";

import { BASE, convexRun, launch, newContext, shot, watch } from "./kit.mjs";
import { saveJson, sleep } from "./flows-shop-lib.mjs";

const T = "flows-shop";
const out = {};
const browser = await launch();
const ctx = await newContext(browser, { width: 390, height: 844, tag: "flows-inq" });
const page = await ctx.newPage();
page.setDefaultTimeout(60_000);
page.setDefaultNavigationTimeout(150_000);
const log = watch(page);
const errs = () =>
  page.evaluate(() => ({
    invalid: [...document.querySelectorAll('[aria-invalid="true"]')].map((e) => {
      const d = (e.getAttribute("aria-describedby") || "").split(/\s+/).filter(Boolean).map((x) => document.getElementById(x)?.textContent?.trim());
      return `${e.id}: ${d.join(" ")}`;
    }),
    alerts: [...document.querySelectorAll('[role="alert"]')].map((e) => e.innerText.replace(/\s+/g, " ").trim()).filter(Boolean),
  }));

await page.goto(`${BASE}/upit`, { waitUntil: "domcontentloaded" });
await page.getByTestId("inquiry-submit").waitFor();
await page.waitForFunction(() => Object.keys(document.querySelector('[data-testid="inquiry-submit"]') ?? {}).some((k) => k.startsWith("__react")), null, { timeout: 150_000 }).catch(() => console.log("hydration wait timed out"));
await sleep(3500); // honeypot timing
await page.getByTestId("inquiry-submit").click();
await sleep(700);
out.empty = await errs();
await shot(page, `${T}/I-empty-390`);

const vinInput = page.getByTestId("inquiry-vin-input");
await vinInput.fill("WVWZZZAUZGW12345");
await vinInput.blur();
await sleep(600);
out.vin16 = { errs: await errs(), text: (await page.locator("form").first().innerText()).slice(0, 400).replace(/\s+/g, " ") };
await vinInput.fill("WVWZZZAUZGW123456");
await vinInput.blur();
await sleep(1200);
out.vinValid = await page.evaluate(() => {
  const sel = (id) => {
    const el = document.getElementById(id);
    return el ? el.value || el.textContent?.trim() || el.getAttribute("data-value") : null;
  };
  return {
    brand: sel("iq-brandSlug"),
    model: sel("iq-modelSlug"),
    generation: sel("iq-generationSlug"),
    year: document.querySelector('input[placeholder="2016"]')?.value,
    decodeText: document.querySelector("form")?.innerText.slice(0, 500).replace(/\s+/g, " "),
  };
});
await shot(page, `${T}/I-vin-decoded-390`);

// photos
const jpg = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 120, g: 130, b: 140 } } }).jpeg().toBuffer();
const photoInput = page.getByTestId("inquiry-photo-input");
await photoInput.setInputFiles([{ name: "racun.pdf", mimeType: "application/pdf", buffer: Buffer.from("%PDF-1.4 test") }]);
await sleep(800);
out.wrongType = (await page.locator("form").first().innerText()).match(/Fotografija[^\n]*|Najviše[^\n]*/g);
await shot(page, `${T}/I-photo-wrong-type-390`, { locator: photoInput.locator("xpath=ancestor::*[self::fieldset or self::div][2]") }).catch(() => {});
const big = Buffer.alloc(9 * 1024 * 1024, 1);
await photoInput.setInputFiles([{ name: "velika.jpg", mimeType: "image/jpeg", buffer: big }]);
await sleep(800);
out.tooBig = (await page.locator("form").first().innerText()).match(/Fotografija[^\n]*|Najviše[^\n]*/g);
const six = Array.from({ length: 6 }, (_, i) => ({ name: `deo-${i + 1}.jpg`, mimeType: "image/jpeg", buffer: jpg }));
await photoInput.setInputFiles(six);
await sleep(8000);
out.six = {
  notice: (await page.locator("form").first().innerText()).match(/Fotografija[^\n]*|Najviše[^\n]*/g),
  thumbs: await page.getByTestId("inquiry-photo").count(),
  uploading: await page.getByText("Otprema se").count(),
};
await shot(page, `${T}/I-photos-six-390`);

// fill and submit
await page.locator("#iq-message").fill("Treba mi set kočionih diskova i pločica napred za Golf 7 (audit flows-shop).");
await page.locator("#iq-name").fill("Audit Upit");
await page.locator("#iq-phone").fill("064 123 4567");
const consent = page.locator("#iq-consent [role=checkbox], #iq-consent input[type=checkbox]").first();
await consent.click();
await sleep(500);
out.photosDone = await page.getByTestId("inquiry-photo").count();
await page.getByTestId("inquiry-submit").click();
await page.waitForURL(/\/upit\/hvala\//, { timeout: 60_000 }).catch(async () => {
  out.submitErr = await errs();
});
out.thanksUrl = page.url();
out.thanksText = (await page.locator("main").innerText().catch(() => "")).replace(/\s+/g, " ").slice(0, 800);
await shot(page, `${T}/I-thanks-390`);
const num = out.thanksText.match(/UP-\d{4}-\d{6}/)?.[0];
out.number = num;
if (num) out.probe = convexRun("testing:inquiryProbe", { number: num });
const statusLink = await page.getByRole("link", { name: /status|upit/i }).evaluateAll((a) => a.map((x) => x.getAttribute("href")).filter((h) => h && /\/upit\/[^h]/.test(h)));
out.statusLinks = statusLink;
if (statusLink[0]) {
  await page.goto(`${BASE}${statusLink[0]}`, { waitUntil: "domcontentloaded" });
  await sleep(3000);
  out.statusText = (await page.locator("main").innerText()).replace(/\s+/g, " ").slice(0, 800);
  await shot(page, `${T}/I-status-390`);
}
out.log = log;
console.log(JSON.stringify(out, null, 1).slice(0, 7000));
saveJson("inquiry.json", out);
await browser.close();
