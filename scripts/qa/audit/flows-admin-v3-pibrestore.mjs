// flows-admin v3: restores the company PIB to empty (the settings test stored "123"), then re-reads it.
import { launch, shot } from "./kit.mjs";
import { save, sleep } from "./flows-admin-lib.mjs";
import { ownerCtx, go } from "./flows-admin-lib2.mjs";
const browser = await launch();
const out = {};
try {
  const ctx = await ownerCtx(browser, { tag: "fa3-pibr" });
  const s = await go(ctx, "/admin/podesavanja", { wait: 3000 });
  const pib = s.getByLabel("PIB");
  out.before = await pib.inputValue();
  await pib.fill("");
  await sleep(600);
  // the company section's sticky save bar
  const bar = s.locator("div.sticky", { has: s.getByRole("button", { name: "Odbaci izmene" }) }).first();
  out.barButtons = await bar.getByRole("button").allTextContents();
  await bar.getByRole("button").last().click();
  await sleep(3000);
  const s2 = await go(ctx, "/admin/podesavanja", { wait: 3000 });
  out.after = await s2.getByLabel("PIB").inputValue();
  // Dirty-tab-switch re-check: edit slogan, switch tab, come back
  const slogan = s2.getByLabel("Slogan");
  const orig = await slogan.inputValue();
  await slogan.fill(orig + " X");
  await sleep(500);
  out.barVisibleDirty = await s2.getByRole("button", { name: "Odbaci izmene" }).isVisible();
  await shot(s2, "flows-admin/v3-settings-dirty-bar");
  await s2.getByRole("tab", { name: "SEO", exact: true }).click();
  await sleep(1000);
  out.dialogOnSwitch = await s2.getByRole("alertdialog").isVisible().catch(() => false);
  await s2.getByRole("tab", { name: "Firma", exact: true }).click();
  await sleep(1000);
  out.sloganAfterSwitch = await s2.getByLabel("Slogan").inputValue();
  out.sloganOrig = orig;
} catch (e) {
  out.error = String(e).slice(0, 500);
} finally {
  save("v3-pibrestore.json", out);
  console.log(JSON.stringify(out));
  await browser.close();
}
