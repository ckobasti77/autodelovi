// Steps 25 and 33 — renders a sample e-mail with its header and screenshots it (docs/brand/site/).
// Usage: node scripts/brand/site/email.mjs <baseUrl>
// The logo is loaded from <baseUrl>/brand/email-header@2x.png (and -dark@2x.png), so a server
// must be running.
import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const BASE = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const ROOT = path.resolve(import.meta.dirname, "../../..");
const OUT = path.join(ROOT, "docs/brand/site");
await mkdir(OUT, { recursive: true });

// The templates are TypeScript shared by Next and Convex: bundle them once for Node.
const work = await mkdtemp(path.join(tmpdir(), "em-email-"));
const bundle = path.join(work, "email.mjs");
await build({
  stdin: {
    contents: `export { emailContext } from "./lib/email/context";
export { renderSample } from "./lib/email/registry";`,
    resolveDir: ROOT,
    loader: "ts",
  },
  bundle: true,
  format: "esm",
  platform: "node",
  outfile: bundle,
  alias: { "@": ROOT },
  logLevel: "silent",
});
const { emailContext, renderSample } = await import(pathToFileURL(bundle).href);

// Brand from the defaults; company lines left empty, as on a deployment before go-live.
const ctx = emailContext(
  {
    brand: { name: "Euromotors Plus" },
    company: {
      legalName: "",
      address: { street: "", city: "", postalCode: "" },
      phones: [],
      bankAccounts: [],
    },
    hours: [
      { day: 1, open: "08:00", close: "17:00", closed: false },
      { day: 6, open: "08:00", close: "14:00", closed: false },
    ],
  },
  BASE,
);

const browser = await chromium.launch();
for (const key of ["order_confirmed", "password_reset_code"]) {
  const mail = renderSample(key, ctx);
  const file = path.join(OUT, `email-${key}.html`);
  await writeFile(file, mail.html);
  for (const [name, width, scheme, blockImages] of [
    ["light-700", 700, "light", false],
    ["dark-700", 700, "dark", false],
    ["light-390", 390, "light", false],
    ["no-images-700", 700, "light", true],
  ]) {
    if (key !== "order_confirmed" && name !== "light-700") continue;
    const context = await browser.newContext({
      viewport: { width, height: 900 },
      deviceScaleFactor: 2,
      colorScheme: scheme,
    });
    const page = await context.newPage();
    if (blockImages) await page.route("**/*.png", (route) => route.abort());
    await page.setContent(mail.html, { waitUntil: "networkidle" });
    const logo = await page.evaluate(() => {
      // The header holds a light and a dark-mode image; report the one the scheme shows.
      const imgs = [...document.querySelectorAll("img")];
      const img = imgs.find((i) => i.getBoundingClientRect().width > 0) ?? imgs[0];
      const r = img.getBoundingClientRect();
      return {
        src: img.getAttribute("src").replace(/^.*\/brand\//, ""),
        loaded: img.complete && img.naturalWidth > 0,
        natural: `${img.naturalWidth}x${img.naturalHeight}`,
        shown: `${Math.round(r.width)}x${Math.round(r.height)}`,
        alt: img.alt,
        overflow: document.documentElement.scrollWidth > window.innerWidth,
      };
    });
    await page.screenshot({
      path: path.join(OUT, `email-${key}-${name}.png`),
      clip: { x: 0, y: 0, width, height: 620 },
    });
    console.log(`${key} ${name}:`, JSON.stringify(logo), "| subject:", mail.subject);
    await context.close();
  }
}
await browser.close();
await rm(work, { recursive: true, force: true });
