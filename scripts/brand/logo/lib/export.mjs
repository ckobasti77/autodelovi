// Export helpers for the logo kit: SVGO optimisation, checks on the result, and an ICO writer.
import { optimize } from "svgo";

/**
 * Optimise a logo SVG. The viewBox, the <title> and the evenodd fill rule are kept. Path data keeps
 * three decimals: SVGO writes relative coordinates, and with two decimals the rounding error adds up
 * along a path of several hundred segments until the hairline sits a visible fraction of a pixel off.
 */
export function optimizeSvg(svg) {
  const { data } = optimize(svg, {
    multipass: true,
    floatPrecision: 3,
    plugins: [
      {
        name: "preset-default",
        params: {
          overrides: {
            // Merging would join the ink and accent groups' sub-paths across fill rules — not wanted.
            mergePaths: false,
            convertPathData: { floatPrecision: 3, transformPrecision: 5 },
          },
        },
      },
      "removeXMLProcInst",
      "sortAttrs",
    ],
  });
  return data.endsWith("\n") ? data : data + "\n";
}

/** Throws if the SVG contains anything a logo file must not contain. */
export function assertClean(svg, name) {
  const banned = [
    [/<text[\s>]/i, "live text"],
    [/<image[\s>]/i, "raster image"],
    [/<font[\s>-]/i, "embedded font"],
    [/font-family/i, "font reference"],
    [/<style[\s>]/i, "stylesheet"],
    [/<script[\s>]/i, "script"],
    [/data:image/i, "embedded raster"],
    [/href=/i, "external reference"],
    [/<filter[\s>]/i, "filter"],
    [/Gradient/i, "gradient"],
  ];
  for (const [re, what] of banned) if (re.test(svg)) throw new Error(`${name}: contains ${what}`);
  if (!/viewBox="0 0 [\d.]+ [\d.]+"/.test(svg)) throw new Error(`${name}: missing viewBox`);
}

/** ICO container holding PNG payloads (Vista+; every current browser reads it). */
export function ico(entries) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);
  const dir = Buffer.alloc(16 * entries.length);
  let offset = 6 + dir.length;
  entries.forEach(({ size, png }, i) => {
    const at = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, at);
    dir.writeUInt8(size >= 256 ? 0 : size, at + 1);
    dir.writeUInt8(0, at + 2);
    dir.writeUInt8(0, at + 3);
    dir.writeUInt16LE(1, at + 4);
    dir.writeUInt16LE(32, at + 6);
    dir.writeUInt32LE(png.length, at + 8);
    dir.writeUInt32LE(offset, at + 12);
    offset += png.length;
  });
  return Buffer.concat([header, dir, ...entries.map((e) => e.png)]);
}
