// Generates the Convex Auth signing keys (RS256 JWT_PRIVATE_KEY + JWKS) and sets them on a Convex
// deployment. Run once per deployment; keys are never copied between dev and production.
//
//   node scripts/setup/auth-keys.mjs            # the dev deployment from .env.local
//   node scripts/setup/auth-keys.mjs --prod     # the production deployment
//   node scripts/setup/auth-keys.mjs --deployment <name>
//
// The values go straight to `convex env set` as single "NAME=VALUE" arguments (no shell, no temp
// file), so the private key never lands on disk or in the shell history. Re-running it rotates the
// keys and signs every user out.
import { spawnSync } from "node:child_process";
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";

const passthrough = process.argv.slice(2);
const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

const values = {
  JWT_PRIVATE_KEY: privateKey.trimEnd().replace(/\n/g, " "),
  JWKS: jwks,
};

for (const [name, value] of Object.entries(values)) {
  const result = spawnSync(
    process.execPath,
    ["node_modules/convex/bin/main.js", "env", "set", ...passthrough, `${name}=${value}`],
    { stdio: ["ignore", "inherit", "inherit"] },
  );
  if (result.status !== 0) {
    console.error(`convex env set ${name} failed (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}
console.log("JWT_PRIVATE_KEY and JWKS are set. Every existing session is now invalid.");
