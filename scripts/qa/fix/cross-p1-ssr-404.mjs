// Server HTML of 404s on :3001: status, <title>, whether an <h1> is server-rendered, error fallback template.
const BASE = process.env.AUDIT_BASE ?? "http://localhost:3001";
const routes = process.argv.slice(2).length ? process.argv.slice(2) : ["nema-ove-strane-xyz", "deo/nepostoji-xyz", "upit/xxxxxxxxxxxxxxxxxxxx", "porudzbina/xxxxxxxxxxxxxxxxxxxxxxxx", "porudzbina/hvala/xxxxxxxxxxxxxxxxxxxxxxxx", "delovi/nepostoji-kat"];
for (const r of routes) {
  const res = await fetch(`${BASE}/${r.replace(/^\/+/, "")}`, { redirect: "manual" });
  const html = await res.text();
  const noScript = html.replace(/<script[\s\S]*?<\/script>/g, "");
  console.log(JSON.stringify({ route: r, status: res.status, titles: [...html.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => m[1]), h1: (noScript.match(/<h1[^>]*>([\s\S]*?)<\/h1>/) ?? [])[1]?.replace(/<[^>]+>/g, "").slice(0, 60) ?? null, errorFallback: html.includes("data-next-error-digest") }));
}
