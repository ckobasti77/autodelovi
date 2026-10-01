// Counts Phosphor icon components and weight maps in the JS a page loads (dev or prod server).
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3001";
const path = process.argv[2] ?? "/";
const html = await (await fetch(BASE + path, { headers: { cookie: "sk_consent=" + encodeURIComponent(JSON.stringify({ v: 1, analytics: false, ads: false, at: Date.now(), id: "probe-0001" })) } })).text();
const srcs = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map((m) => m[1]);
let icons = new Set(), duotone = 0, bytes = 0, sklop = 0;
for (const src of srcs) {
  const js = await (await fetch(new URL(src, BASE))).text();
  bytes += js.length;
  for (const m of js.matchAll(/displayName = "([A-Za-z]+Icon)"/g)) icons.add(m[1]);
  for (const m of js.matchAll(/\("([A-Z][A-Za-z]+Icon)", new Map/g)) { icons.add(m[1]); sklop++; }
  duotone += (js.match(/"duotone"/g) ?? []).length;
}
console.log(JSON.stringify({ path, scripts: srcs.length, kb: Math.round(bytes / 1024), icons: icons.size, generated: sklop, duotone, sample: [...icons].slice(0, 8) }));
