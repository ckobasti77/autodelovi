// Independent verification of flows-shop-08 (quote accept payments), -09 (PIB/MB messages),
// -11 (mobile filter row not sticky). Audit only: never submits an order, inquiry or registration.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { BASE, launch, newContext, watch, shot, loginWith } from "./kit.mjs";

const OUT = "docs/qa/audit/verify/flows-shop";
mkdirSync(OUT, { recursive: true });
const only = process.argv[2] ?? "all";
const accounts = JSON.parse(readFileSync(".playwright/audit-accounts.json", "utf8"));
const QUOTE = "/upit/3UMmrdzw1RNGw5ToQh06cANjxl8c_-Ajvp7eBwA1ayI";
const result = {};

const browser = await launch("chromium");

async function acceptFormState(page) {
  return page.evaluate(() => {
    const groups = [...document.querySelectorAll('[role="radiogroup"]')].map((g) => ({
      label: g.getAttribute("aria-label") ?? g.previousElementSibling?.textContent ?? "",
      options: [...g.querySelectorAll('[role="radio"], input[type="radio"]')].map(
        (r) => r.closest("label")?.textContent?.trim() ?? r.getAttribute("aria-label") ?? r.value,
      ),
    }));
    const form = document.querySelector("form");
    const text = form?.innerText ?? "";
    return {
      groups,
      labels: [...(form?.querySelectorAll("label") ?? [])].map((l) => l.textContent.trim()).slice(0, 30),
      hasCompany: /firma|PIB|Matični|predračun|Virman/i.test(text),
      hasDeferred: /Odloženo/i.test(text),
    };
  });
}

async function quoteRun(tag, login) {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: `vfs08-${tag}` });
  const page = await ctx.newPage();
  const log = watch(page);
  if (login) await loginWith(page, login.email, login.password, "/nalog");
  await page.goto(`${BASE}${QUOTE}`, { waitUntil: "networkidle" });
  const r = { status: await page.locator("h1 + div, main").first().innerText().then((t) => t.slice(0, 260)) };
  const accept = page.getByTestId("quote-accept");
  r.acceptVisible = await accept.isVisible().catch(() => false);
  if (!r.acceptVisible) {
    const btn = page.getByRole("button", { name: "Prihvati ponudu" });
    r.acceptVisible = await btn.isVisible().catch(() => false);
    if (r.acceptVisible) await btn.click();
  } else await accept.click();
  if (r.acceptVisible) {
    await page.waitForSelector("form", { timeout: 10000 });
    r.pickup = await acceptFormState(page);
    await page.locator("form").scrollIntoViewIfNeeded();
    r.shotPickup = await shot(page, `verify/flows-shop/flows-shop-08-reproduce-${tag}-pickup-390`, {
      locator: page.locator("form"),
    });
    await page.getByText("Kurirska služba", { exact: false }).first().click();
    await page.waitForTimeout(400);
    r.courier = await acceptFormState(page);
    r.shotCourier = await shot(page, `verify/flows-shop/flows-shop-08-reproduce-${tag}-courier-390`, {
      locator: page.locator("form"),
    });
  }
  r.log = log;
  await ctx.close();
  return r;
}

if (only === "all" || only === "08") {
  result["08"] = {
    guest: await quoteRun("guest", null),
    mechanic: await quoteRun("mechanic", accounts.mechanic),
  };
}

// ---------- 09: PIB / MB messages (checkout step 1, and /za-majstore) ----------
async function fieldErrors(page, ids) {
  return page.evaluate((ids) => {
    const out = {};
    for (const id of ids) {
      const input = document.getElementById(id);
      const described = input?.getAttribute("aria-describedby") ?? "";
      const texts = described
        .split(/\s+/)
        .map((d) => document.getElementById(d)?.textContent?.trim())
        .filter(Boolean);
      out[id] = { invalid: input?.getAttribute("aria-invalid"), value: input?.value, described: texts };
    }
    return out;
  }, ids);
}

if (only === "all" || only === "09") {
  const ctx = await newContext(browser, { width: 390, height: 844, tag: "vfs09" });
  const page = await ctx.newPage();
  const log = watch(page);
  await page.goto(`${BASE}/deo/kocioni-disk-prednji-276-24-mm-demo-0004`, { waitUntil: "networkidle" });
  await page.getByTestId("product-add-to-cart").first().click();
  await page.waitForTimeout(1500);
  await page.goto(`${BASE}/porudzbina`, { waitUntil: "networkidle" });
  await page.waitForSelector('[data-testid="checkout-step-contact"]');
  const ids = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="checkout-step-contact"] input')].map((i) => ({
      id: i.id,
      type: i.type,
      name: i.name,
      label: i.labels?.[0]?.textContent?.trim(),
    })),
  );
  const byLabel = async (re) => {
    const f = ids.find((i) => re.test(i.label ?? ""));
    return f ? page.locator(`[id="${f.id}"]`) : null;
  };
  await (await byLabel(/^Ime/)).fill("Audit");
  await (await byLabel(/^Prezime/)).fill("Verifikacija");
  await (await byLabel(/Telefon/)).fill("064 123 4567");
  await (await byLabel(/E-po|E-mail/)).fill(`audit-verify-fs09-${Date.now()}@primer.rs`);
  await page.getByText("Kupujem kao firma").click();
  await page.waitForTimeout(400);
  const ids2 = await page.evaluate(() =>
    [...document.querySelectorAll('[data-testid="checkout-step-contact"] input')].map((i) => ({
      id: i.id,
      label: i.labels?.[0]?.textContent?.trim(),
    })),
  );
  const find = (re) => ids2.find((i) => re.test(i.label ?? ""))?.id;
  const nameId = find(/Naziv firme/);
  const pibId = find(/^PIB/);
  const mbId = find(/Matični/);
  await page.locator(`[id="${nameId}"]`).fill("Audit Servis DOO");
  const cases = [
    { name: "pib-valid-mb-bad-checksum", pib: "154552870", mb: "64552873" },
    { name: "pib-bad-checksum-mb-7digits", pib: "154552871", mb: "6455287" },
    { name: "pib-empty-mb-valid", pib: "", mb: "64552872" },
    { name: "pib-8digits-mb-valid", pib: "15455287", mb: "64552872" },
    { name: "pib-letters", pib: "ABCDEFGHI", mb: "" },
  ];
  const out = [];
  for (const c of cases) {
    await page.locator(`[id="${pibId}"]`).fill(c.pib);
    await page.locator(`[id="${mbId}"]`).fill(c.mb);
    await page.getByTestId("checkout-next").click();
    await page.waitForTimeout(700);
    const stillContact = await page.getByTestId("checkout-step-contact").isVisible();
    const errs = await fieldErrors(page, [pibId, mbId]);
    const visibleText = await page
      .locator(`[data-testid="checkout-step-contact"]`)
      .innerText()
      .then((t) => t.split("\n").filter((l) => /PIB|Matični|cifar|kontroln/i.test(l)));
    out.push({ ...c, stillContact, errs, visibleText });
    if (c.name === "pib-valid-mb-bad-checksum" || c.name === "pib-empty-mb-valid") {
      await page.locator(`[id="${mbId}"]`).scrollIntoViewIfNeeded();
      const box = await page.locator(`[id="${nameId}"]`).boundingBox();
      await shot(page, `verify/flows-shop/flows-shop-09-reproduce-${c.name}-390`, {
        clip: { x: 0, y: Math.max(0, box.y - 60), width: 390, height: 420 },
      });
    }
  }
  result["09"] = { checkout: out, log };

  // /za-majstore registration: same messages?
  await page.goto(`${BASE}/za-majstore`, { waitUntil: "networkidle" });
  const reg = await page.evaluate(() =>
    [...document.querySelectorAll("form input")].map((i) => ({ id: i.id, label: i.labels?.[0]?.textContent?.trim() })),
  );
  const rPib = reg.find((i) => /^PIB/.test(i.label ?? ""))?.id;
  const rMb = reg.find((i) => /Matični/.test(i.label ?? ""))?.id;
  const regOut = { fields: reg.slice(0, 20), rPib, rMb, cases: [] };
  if (rPib && rMb) {
    for (const c of [
      { name: "mb-bad-checksum", pib: "154552870", mb: "64552873" },
      { name: "pib-empty", pib: "", mb: "64552872" },
    ]) {
      await page.locator(`[id="${rPib}"]`).fill(c.pib);
      await page.locator(`[id="${rMb}"]`).fill(c.mb);
      // Only fields are filled; everything else stays empty so client validation blocks any submit.
      await page.locator("form").getByRole("button", { name: /Pošalji|Registr|Prijav/ }).last().click();
      await page.waitForTimeout(800);
      regOut.cases.push({ ...c, errs: await fieldErrors(page, [rPib, rMb]) });
      if (c.name === "mb-bad-checksum") {
        await page.locator(`[id="${rMb}"]`).scrollIntoViewIfNeeded();
        const box = await page.locator(`[id="${rPib}"]`).boundingBox();
        await shot(page, `verify/flows-shop/flows-shop-09-reproduce-za-majstore-390`, {
          clip: { x: 0, y: Math.max(0, box.y - 60), width: 390, height: 360 },
        });
      }
    }
  }
  result["09"].registration = regOut;
  await ctx.close();
}

// ---------- 11: mobile filter row sticky? ----------
if (only === "all" || only === "11") {
  const routes = [
    "/delovi/kocioni-diskovi",
    "/delovi/kocioni-diskovi/volkswagen/golf",
    "/delovi/kocnice",
    "/pretraga?q=disk",
    "/ponuda/kocione-plocice-golf",
  ];
  const out = [];
  for (const w of [{ width: 360, height: 780 }, { width: 390, height: 844 }, { width: 768, height: 1024 }]) {
    const ctx = await newContext(browser, { ...w, tag: `vfs11-${w.width}` });
    const page = await ctx.newPage();
    for (const r of routes) {
      if (w.width !== 390 && r !== "/delovi/kocioni-diskovi") continue;
      await page.goto(`${BASE}${r}`, { waitUntil: "networkidle" });
      const btn = page.getByRole("button", { name: /^Filteri/ }).first();
      const has = await btn.isVisible().catch(() => false);
      if (!has) {
        out.push({ route: r, width: w.width, filterButton: false });
        continue;
      }
      const before = await btn.boundingBox();
      const scrollH = await page.evaluate(() => document.documentElement.scrollHeight);
      await page.evaluate(() => window.scrollTo(0, 1400));
      await page.waitForTimeout(900);
      const after = await btn.boundingBox();
      const info = await btn.evaluate((el) => {
        const sticky = [];
        for (let n = el; n; n = n.parentElement) {
          const cs = getComputedStyle(n);
          if (cs.position === "sticky" || cs.position === "fixed") sticky.push(`${n.tagName}.${String(n.className).slice(0, 60)}`);
        }
        const header = document.querySelector("header");
        return { sticky, headerBottom: header?.getBoundingClientRect().bottom, scrollY: window.scrollY };
      });
      out.push({ route: r, width: w.width, before: before?.y, after: after?.y, scrollH, ...info });
      if (r === "/delovi/kocioni-diskovi" || r === "/delovi/kocioni-diskovi/volkswagen/golf") {
        const slug = r.replaceAll("/", "_").replace(/^_/, "");
        await shot(page, `verify/flows-shop/flows-shop-11-reproduce-${slug}-${w.width}-scrolled`);
      }
    }
    await ctx.close();
  }
  result["11"] = out;
}

await browser.close();
writeFileSync(`${OUT}/flows-shop-08-11-reproduce-${only}.json`, JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2).slice(0, 12000));
