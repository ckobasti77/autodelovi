/**
 * Backup restore drill (docs/BACKUPS.md): verifies an extracted `npx convex export` snapshot
 * before anyone relies on it — every table of the current schema is present, every document
 * validates against today's schema (so `npx convex import --replace` would accept it), every
 * stored file listed in `_storage` is in the archive, and row counts match what the live
 * deployment reported (`npx convex run seed:stats`, optional).
 *
 * Skipped unless BACKUP_DIR points at an extracted snapshot:
 *   tar -xf backups/<date>.zip -C backups/<date>
 *   BACKUP_DIR=backups/<date> [BACKUP_STATS=backups/<date>-stats.json] npx vitest run tests/unit/backup
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

import { validate } from "convex-helpers/validators";
import { describe, expect, it } from "vitest";

import schema from "@/convex/schema";

const dir = process.env.BACKUP_DIR;
const statsFile = process.env.BACKUP_STATS;

function readJsonl(file: string): Record<string, unknown>[] {
  if (!existsSync(file)) return [];
  return readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line) as Record<string, unknown>);
}

describe.skipIf(!dir)("backup restore drill", () => {
  const root = path.resolve(dir ?? ".");
  const tables = Object.keys(schema.tables);

  it("contains every table of the current schema", () => {
    const present = new Set(readdirSync(root));
    const missing = tables.filter((t) => !present.has(t));
    // Tables that have never had a row are not exported; they must be empty on the live side.
    const stats = statsFile
      ? (JSON.parse(readFileSync(statsFile, "utf8")) as { counts: Record<string, number> }).counts
      : {};
    expect(missing.filter((t) => (stats[t] ?? 0) > 0)).toEqual([]);
  });

  it("every document validates against today's schema", () => {
    const failures: string[] = [];
    let total = 0;
    for (const table of tables) {
      const validator = schema.tables[table as keyof typeof schema.tables].validator;
      for (const doc of readJsonl(path.join(root, table, "documents.jsonl"))) {
        total++;
        const { _id, _creationTime, ...fields } = doc;
        if (typeof _id !== "string" || typeof _creationTime !== "number") {
          failures.push(`${table}: system fields missing`);
          continue;
        }
        try {
          validate(validator, fields, { throw: true });
        } catch (error) {
          if (failures.length < 20) failures.push(`${table}/${_id}: ${(error as Error).message}`);
        }
      }
    }
    expect(total).toBeGreaterThan(0);
    expect(failures).toEqual([]);
  });

  it("every stored file listed in _storage is in the archive", () => {
    const files = readJsonl(path.join(root, "_storage", "documents.jsonl"));
    const names = new Set(readdirSync(path.join(root, "_storage")));
    const missing = files
      .map((f) => String(f._id))
      .filter((id) => ![...names].some((n) => n.startsWith(id)));
    expect(missing).toEqual([]);
  });

  it.skipIf(!statsFile)("row counts match the live deployment (seed:stats)", () => {
    const stats = JSON.parse(readFileSync(statsFile!, "utf8")) as {
      counts: Record<string, number>;
    };
    const diff: string[] = [];
    for (const [table, count] of Object.entries(stats.counts)) {
      const exported = readJsonl(path.join(root, table, "documents.jsonl")).length;
      // seed:stats reads at most 10 000 rows per table.
      if (exported !== count && !(count === 10_000 && exported > count)) {
        diff.push(`${table}: live ${count}, backup ${exported}`);
      }
    }
    expect(diff).toEqual([]);
  });
});
