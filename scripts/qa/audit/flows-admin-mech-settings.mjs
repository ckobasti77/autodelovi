// flows-admin: mechanic approve/suspend/reactivate + reject; settings tabs, one harmless save+restore,
// invalid PIB, danger zone inspect. Usage: node flows-admin-mech-settings.mjs <approveProfileId> <rejectProfileId>
import { launch, watch, shot, axe } from "./kit.mjs";
import { save, sleep } from "./flows-admin-lib.mjs";
import { ownerCtx, go } from "./flows-admin-lib2.mjs";

const [A, R] = process.argv.slice(2);
const browser = await launch();
const report = { A, R, steps: [] };
const step = (name, data = {}) => {
  report.steps.push({ name, at: new Date().toISOString(), ...data });
  console.log(name, JSON.stringify(data).slice(0, 600));
};
const txt = async (l) => ((await l.textContent().catch(() => "")) ?? "").replace(/\s+/g, " ").trim();
const toasts = (p) => p.locator("[data-sonner-toast]").allTextContents();

try {
  const ctx = await ownerCtx(browser, { tag: "fa-ms" });
  // ---- reject R: empty reason first
  const r = await go(ctx, `/admin/majstori/${R}`);
  const logR = watch(r);
  await shot(r, "flows-admin/mech-01-pending", { fullPage: true });
  await r.getByRole("button", { name: "Odbij registraciju" }).click();
  await sleep(2500);
  step("reject empty reason", { dialog: await r.getByRole("alertdialog").isVisible().catch(() => false), alerts: await r.getByRole("alert").allTextContents(), toasts: await toasts(r), invalid: await r.locator("[aria-invalid=true]").count() });
  await shot(r, "flows-admin/mech-02-reject-empty");
  await r.getByLabel("Razlog odbijanja").fill("PIB ne odgovara nazivu firme (audit).");
  await r.getByRole("button", { name: "Odbij registraciju" }).click();
  await sleep(3000);
  step("rejected (no confirm dialog?)", { dialog: await r.getByRole("alertdialog").isVisible().catch(() => false), toasts: await toasts(r), status: (await txt(r.locator("main"))).slice(0, 300) });
  step("errors R", logR);
  await r.close();

  // ---- approve A
  const a = await go(ctx, `/admin/majstori/${A}`);
  const nivo = a.getByLabel("Nivo rabata");
  step("tier options", { opts: await nivo.locator("option").allTextContents().catch(() => []) });
  const opts = await nivo.locator("option").evaluateAll((os) => os.map((o) => o.value).filter(Boolean)).catch(() => []);
  if (opts[1]) await nivo.selectOption(opts[1]);
  const credit = a.getByLabel("Odloženo plaćanje");
  if (await credit.count()) {
    await credit.check().catch(async () => credit.click());
    await sleep(500);
    await a.getByLabel("Limit").fill("-5").catch(() => {});
  }
  await a.getByRole("button", { name: "Odobri nalog" }).click();
  await sleep(3500);
  step("approve with limit -5", { toasts: await toasts(a), alerts: await a.getByRole("alert").allTextContents(), invalid: await a.locator("[aria-invalid=true]").count() });
  await shot(a, "flows-admin/mech-03-approve-negative-limit");
  if (await a.getByRole("button", { name: "Odobri nalog" }).isVisible().catch(() => false)) {
    await a.getByLabel("Limit").fill("150.000").catch(() => {});
    await a.getByRole("button", { name: "Odobri nalog" }).click();
    await sleep(3500);
    step("approve with 150.000", { toasts: await toasts(a), alerts: await a.getByRole("alert").allTextContents() });
  }
  await shot(a, "flows-admin/mech-04-approved", { fullPage: true });
  // suspend
  if (await a.getByRole("button", { name: "Pauziraj nalog" }).isVisible().catch(() => false)) {
    await a.getByRole("button", { name: "Pauziraj nalog" }).click();
    await sleep(3000);
    step("suspend (no confirm?)", { dialog: await a.getByRole("alertdialog").isVisible().catch(() => false), toasts: await toasts(a) });
    const re = a.getByRole("button", { name: "Aktiviraj ponovo" });
    if (await re.isVisible().catch(() => false)) {
      await re.click();
      await sleep(3000);
      step("reactivated", { toasts: await toasts(a) });
    }
  }
  await a.close();

  // ---- settings
  const s = await go(ctx, "/admin/podesavanja");
  const logS = watch(s);
  const tabs = await s.getByRole("tab").allTextContents();
  step("settings tabs", { tabs });
  for (const t of tabs) {
    await s.getByRole("tab", { name: t, exact: true }).click();
    await sleep(1500);
    const slug = t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/g, "dj").replace(/[^a-z]+/g, "-");
    await shot(s, `flows-admin/settings-${slug}`, { fullPage: true });
  }
  const ax = await axe(s);
  step("settings axe (last tab)", { ax });
  // harmless change: Slogan
  await s.getByRole("tab", { name: "Firma", exact: true }).click();
  await sleep(1000);
  const slogan = s.getByLabel("Slogan");
  const orig = await slogan.inputValue();
  await slogan.fill(orig + " (audit)");
  await sleep(500);
  step("dirty savebar", { bar: (await txt(s.locator("[data-savebar], [role=region]").filter({ hasText: /Sačuvaj/ }).first())).slice(0, 200) });
  await shot(s, "flows-admin/settings-dirty");
  // try switching tab while dirty
  await s.getByRole("tab", { name: "SEO", exact: true }).click();
  await sleep(1000);
  step("switch tab while dirty", { dialog: await s.getByRole("alertdialog").isVisible().catch(() => false), selected: await s.getByRole("tab", { selected: true }).textContent() });
  await s.getByRole("tab", { name: "Firma", exact: true }).click();
  await sleep(1000);
  step("slogan after switching back", { value: await s.getByLabel("Slogan").inputValue() });
  const sl = s.getByLabel("Slogan");
  if ((await sl.inputValue()) !== orig + " (audit)") await sl.fill(orig + " (audit)");
  // save via the bar next to slogan
  const bar = sl.locator("xpath=ancestor::section[1]").getByRole("button", { name: /Sačuvaj/ });
  await bar.first().click();
  await sleep(3000);
  step("saved slogan", { toasts: await toasts(s) });
  await sl.fill(orig);
  await bar.first().click();
  await sleep(3000);
  step("restored slogan", { toasts: await toasts(s), value: await sl.inputValue(), orig });
  // invalid PIB → save → message; then discard
  const pib = s.getByLabel("PIB");
  const pibOrig = await pib.inputValue();
  await pib.fill("123");
  const cbar = pib.locator("xpath=ancestor::section[1]").getByRole("button", { name: /Sačuvaj/ });
  await cbar.first().click();
  await sleep(2500);
  step("invalid PIB save", { toasts: await toasts(s), alerts: await s.getByRole("alert").allTextContents(), invalid: await s.locator("[aria-invalid=true]").count(), pibOrig });
  await shot(s, "flows-admin/settings-invalid-pib");
  const discard = pib.locator("xpath=ancestor::section[1]").getByRole("button", { name: /Odbaci|Poništi|Otkaži/ });
  if (await discard.count()) await discard.first().click();
  else await pib.fill(pibOrig);
  await sleep(1500);
  step("pib after discard", { value: await pib.inputValue(), pibOrig });
  // danger zone inspect
  if (tabs.includes("Opasna zona")) {
    await s.getByRole("tab", { name: "Opasna zona", exact: true }).click();
    await sleep(1500);
    step("danger zone", { text: (await txt(s.getByRole("tabpanel"))).slice(0, 900) });
  }
  step("errors S", logS);
} catch (e) {
  step("FAILED", { error: String(e).slice(0, 800) });
} finally {
  save(`mech-settings.json`, report);
  await browser.close();
}
