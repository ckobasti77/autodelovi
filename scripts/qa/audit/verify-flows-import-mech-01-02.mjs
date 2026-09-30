/** Verifier (step 21): flows-import-mech-01 (duplicate rows in quick order) and -02 (qty 0 / >999). */
import { mkdirSync, writeFileSync } from "node:fs";

import { BASE, launch, newContext, shot, watch } from "./kit.mjs";
import { loginMechanic } from "./flows-import-mech-lib.mjs";

const OUT = "docs/qa/audit/verify/flows-import-mech";
mkdirSync(OUT, { recursive: true });
const log = {};
const note = (k, v) => {
  log[k] = v;
  console.log(`--- ${k}\n${typeof v === "string" ? v : JSON.stringify(v, null, 2)}`);
};

const browser = await launch();
const ctx = await newContext(browser, { width: 1440, height: 900, tag: "verify-fim" });
const page = await ctx.newPage();
const w = watch(page);

async function cartLines() {
  await page.goto(`${BASE}/korpa`, { waitUntil: "load" });
  await page.waitForTimeout(3500);
  const list = page.getByRole("list", { name: "Stavke u korpi" }).first();
  if (!(await list.count())) return "(empty cart)";
  return (await list.innerText()).replace(/\n+/g, " | ");
}

async function removeFromCart(namePart) {
  await page.goto(`${BASE}/korpa`, { waitUntil: "load" });
  await page.waitForTimeout(3000);
  const btns = page.getByRole("button", { name: new RegExp(`^Ukloni .*${namePart}`, "i") });
  const n = await btns.count();
  for (let i = 0; i < n; i++) {
    await page.getByRole("button", { name: new RegExp(`^Ukloni .*${namePart}`, "i") }).first().click();
    await page.waitForTimeout(1500);
  }
  return n;
}

async function quick(text, tag) {
  await page.goto(`${BASE}/majstor/brza-porudzbina`, { waitUntil: "load" });
  const input = page.getByTestId("mechanic-quick-order-input");
  await input.waitFor({ timeout: 60000 });
  await page.waitForTimeout(1500);
  await input.fill(text);
  await page.getByTestId("mechanic-quick-order-check").click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll('[data-testid="mechanic-quick-order-row"]').length > 0 &&
      !document.querySelector('[data-testid="mechanic-quick-order-row"][data-status="pending"]'),
    null,
    { timeout: 60000 },
  );
  await page.waitForTimeout(800);
  const rows = await page.getByTestId("mechanic-quick-order-row").evaluateAll((els) =>
    els.map((e) => `[${e.getAttribute("data-status")}] ${e.innerText.replace(/\n+/g, " · ")}`),
  );
  const addAll = await page.getByTestId("mechanic-quick-order-add-all").innerText().catch(() => "");
  const summary = await page
    .locator('[aria-live="polite"]')
    .filter({ hasText: /kom\.|Nema stavki/ })
    .first()
    .innerText()
    .catch(() => "");
  note(`${tag}:check`, { rows, summary, addAll });
  return { rows, summary };
}

async function addAllAndCapture(tag) {
  await page.getByTestId("mechanic-quick-order-add-all").click();
  const toast = page.locator("[data-sonner-toast], [role='status']").filter({ hasText: /Dodato|U korpi|Nije dodato/ }).first();
  await toast.waitFor({ timeout: 30000 });
  const toastText = await toast.innerText();
  await page.waitForTimeout(600);
  const rowsAfter = await page.getByTestId("mechanic-quick-order-row").evaluateAll((els) =>
    els.map((e) => e.innerText.replace(/\n+/g, " · ")),
  );
  const textarea = await page.getByTestId("mechanic-quick-order-input").inputValue();
  note(`${tag}:afterAdd`, { toastText, rowsAfter, textarea });
  return toastText;
}

try {
  await loginMechanic(page, "/majstor");
  note("cartBefore", await cartLines());

  // ---- 01 (a): duplicate rows of a disc, plus a belt kit
  await quick("5Q0615505R 2\n5Q0 615 505 R 2\n036 121 959 P 1", "01a");
  await shot(page, "verify/flows-import-mech/flows-import-mech-01-reproduce-check-1440");
  await addAllAndCapture("01a");
  await shot(page, "verify/flows-import-mech/flows-import-mech-01-reproduce-after-add-1440");
  note("01a:cart", await cartLines());
  await shot(page, "verify/flows-import-mech/flows-import-mech-01-reproduce-cart-1440");

  // restore: remove what was added (cart was recorded before)
  note("01a:removed", {
    disc: await removeFromCart("Kočioni disk prednji 276"),
    belt: await removeFromCart("zupčastog kaiša"),
  });

  // ---- 01 (b): stock-1 part pasted twice
  await quick("1K0615540Q 1\n1K0 615 540 Q 1", "01b");
  await shot(page, "verify/flows-import-mech/flows-import-mech-01-reproduce-stock1-check-1440");
  const exactRows = await page.locator('[data-testid="mechanic-quick-order-row"][data-status="exact"]').count();
  if (exactRows === 2) {
    await addAllAndCapture("01b");
    await shot(page, "verify/flows-import-mech/flows-import-mech-01-reproduce-stock1-after-add-1440");
    note("01b:cart", await cartLines());
    const cartText = log["01b:cart"];
    const name = (log["01b:check"].rows[0] || "").split(" · ")[3] ?? "";
    note("01b:nameGuess", name);
  }

  // ---- 02: qty 0 / 1000 / 1500 and variants
  await quick(
    [
      "5Q0615505R 0",
      "5Q0615505R 1000",
      "ZZ9999999",
      "5q0-615-505-r 0",
      "5Q0615505R 1500",
      "5Q0615505R x1000",
      "5Q0615505R;1000",
      "1000x 5Q0615505R",
      "5Q0615505R 999",
    ].join("\n"),
    "02",
  );
  await shot(page, "verify/flows-import-mech/flows-import-mech-02-reproduce-check-1440", { fullPage: true });
  const inquireLabel = await page.getByTestId("mechanic-quick-order-inquire").innerText().catch(() => "(none)");
  note("02:inquireButton", inquireLabel);
} catch (e) {
  note("error", String(e).slice(0, 800));
  await shot(page, "verify/flows-import-mech/flows-import-mech-01-02-error-1440").catch(() => {});
} finally {
  note("watch", w);
  writeFileSync(`${OUT}/flows-import-mech-01-02-reproduce.json`, JSON.stringify(log, null, 2));
  await browser.close();
}
