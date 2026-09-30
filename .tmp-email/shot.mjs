import { chromium } from "@playwright/test";
import { pathToFileURL } from "node:url";
import path from "node:path";
const keys = process.argv.slice(2);
const browser = await chromium.launch();
for (const [w, tag] of [[680, "d"], [375, "m"]]) {
  const page = await browser.newPage({ viewport: { width: w, height: 900 }, deviceScaleFactor: 1 });
  for (const key of keys) {
    await page.goto(pathToFileURL(path.resolve(`.tmp-email/${key}.html`)).href);
    await page.screenshot({ path: `.tmp-email/${key}-${tag}.png`, fullPage: true });
  }
  if (keys.includes("order_confirmed")) {
    await page.emulateMedia({ colorScheme: "dark" });
    await page.goto(pathToFileURL(path.resolve(`.tmp-email/order_confirmed.html`)).href);
    await page.screenshot({ path: `.tmp-email/order_confirmed-${tag}-dark.png`, fullPage: true });
    await page.emulateMedia({ colorScheme: "light" });
  }
  await page.close();
}
await browser.close();
