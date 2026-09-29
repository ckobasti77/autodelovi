// Verifies the self-hosted display fonts: Serbian Latin glyphs (č ć ž š đ Č Ć Ž Š Đ), the
// typographic punctuation the copy uses, and the OpenType features the design system relies on.
// Usage: node scripts/fonts/verify-fonts.mjs   (exits 1 on any failure)
import { readdir } from "node:fs/promises";
import path from "node:path";
import * as fontkit from "fontkit";

const ROOT = path.resolve(import.meta.dirname, "../..");
const DIRS = ["app/fonts", "assets/fonts/og"];
const REQUIRED_CHARS = "čćžšđČĆŽŠĐ„“”‘’–—…·×€→";
const REQUIRED_FEATURES = ["kern", "tnum"];

let failures = 0;
for (const dir of DIRS) {
  for (const file of (await readdir(path.join(ROOT, dir))).filter((f) => /\.(woff2?|ttf|otf)$/.test(f))) {
    const font = fontkit.openSync(path.join(ROOT, dir, file));
    const missingChars = [...REQUIRED_CHARS].filter((c) => !font.hasGlyphForCodePoint(c.codePointAt(0)));
    const missingFeatures = REQUIRED_FEATURES.filter((f) => !font.availableFeatures.includes(f));
    const ok = missingChars.length === 0 && missingFeatures.length === 0;
    if (!ok) failures++;
    console.log(
      `${ok ? "ok  " : "FAIL"} ${dir}/${file} — ${font.fullName}, ${font.numGlyphs} glyphs` +
        (missingChars.length ? `, missing chars: ${missingChars.join("")}` : "") +
        (missingFeatures.length ? `, missing features: ${missingFeatures.join(" ")}` : ""),
    );
  }
}
if (failures) process.exit(1);
