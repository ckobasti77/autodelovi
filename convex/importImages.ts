/**
 * Image URLs from an import (docs/IMPORT.md §K4 step 5): fetched after commit, three at a
 * time with a pause between groups, 10 s timeout, ≤ 10 MB, JPEG/PNG/WebP verified from the
 * bytes (never the Content-Type), private/loopback hosts refused on every redirect hop
 * (lib/import/remoteUrl), the body read with a byte cap. Failures are recorded on
 * the job and shown on the import page. The action re-schedules itself before the action
 * time limit.
 */
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { sniffImage } from "../lib/import/imageSniff";
import { fetchableUrl } from "../lib/import/remoteUrl";
import { SYSTEM_ACTOR } from "./lib/authz";
import { MAX_PRODUCT_IMAGES, setProductImages } from "./lib/productWriter";

const PARALLEL = 3;
const TIMEOUT_MS = 10_000;
const MAX_BYTES = 10 * 1024 * 1024;
const PAUSE_MS = 300;
const ACTION_BUDGET_MS = 5 * 60_000;
const MAX_ATTEMPTS = 2;
const MAX_REDIRECTS = 3;

export const nextJobs = internalQuery({
  args: { batchId: v.id("importBatches"), limit: v.number() },
  returns: v.array(
    v.object({ _id: v.id("imageFetchJobs"), url: v.string(), attempts: v.number() }),
  ),
  handler: async (ctx, { batchId, limit }) => {
    const jobs = await ctx.db
      .query("imageFetchJobs")
      .withIndex("by_batchId_and_status", (q) => q.eq("batchId", batchId).eq("status", "pending"))
      .take(limit);
    return jobs.map((j) => ({ _id: j._id, url: j.url, attempts: j.attempts }));
  },
});

type Fetched =
  { ok: true; blob: Blob; width: number; height: number } | { ok: false; error: string };

/** One message for every network-level failure, so job errors cannot map hosts or ports. */
const FETCH_FAILED = "Slika nije mogla da se preuzme.";

/**
 * GET with redirects followed by hand (at most `MAX_REDIRECTS` hops), re-checking every
 * target against the private-host rules — `redirect: "follow"` would only check the first URL.
 */
async function fetchPublic(
  start: URL,
  signal: AbortSignal,
): Promise<{ ok: true; res: Response } | { ok: false; error: string }> {
  let url = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const res = await fetch(url.toString(), {
      signal,
      redirect: "manual",
      headers: { Accept: "image/jpeg,image/png,image/webp;q=0.9,*/*;q=0.1" },
    });
    if (res.type === "opaqueredirect") return { ok: false, error: FETCH_FAILED };
    if (res.status < 300 || res.status > 399) return { ok: true, res };
    const location = res.headers.get("location");
    await res.body?.cancel();
    const next = location ? fetchableUrl(location, url) : null;
    if (!next) return { ok: false, error: "Adresa preusmerava na nedozvoljenu adresu." };
    url = next;
  }
  return { ok: false, error: "Previše preusmeravanja." };
}

/** Reads at most `max` bytes (a missing or false Content-Length cannot exhaust memory). */
async function readCapped(res: Response, max: number): Promise<Uint8Array<ArrayBuffer> | null> {
  if (!res.body) {
    const whole = new Uint8Array(await res.arrayBuffer());
    return whole.byteLength > max ? null : whole;
  }
  const reader = res.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

async function fetchImage(url: string): Promise<Fetched> {
  const parsed = fetchableUrl(url);
  if (!parsed) return { ok: false, error: "Adresa nije ispravna ili vodi na privatnu mrežu." };
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const fetched = await fetchPublic(parsed, controller.signal);
    if (!fetched.ok) return fetched;
    const res = fetched.res;
    if (!res.ok) {
      await res.body?.cancel();
      return { ok: false, error: FETCH_FAILED };
    }
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared > MAX_BYTES) {
      await res.body?.cancel();
      return { ok: false, error: "Slika je veća od 10 MB." };
    }
    const buffer = await readCapped(res, MAX_BYTES);
    if (!buffer) return { ok: false, error: "Slika je veća od 10 MB." };
    const sniffed = sniffImage(buffer);
    if (!sniffed) return { ok: false, error: "Sadržaj nije JPEG, PNG ni WebP slika." };
    if (sniffed.width < 50 || sniffed.height < 50)
      return { ok: false, error: "Slika je manja od 50 × 50 px." };
    return {
      ok: true,
      blob: new Blob([buffer], { type: sniffed.mime }),
      width: sniffed.width,
      height: sniffed.height,
    };
  } catch {
    return { ok: false, error: FETCH_FAILED };
  } finally {
    clearTimeout(timer);
  }
}

export const run = internalAction({
  args: { batchId: v.id("importBatches") },
  returns: v.null(),
  handler: async (ctx, { batchId }) => {
    const started = Date.now();
    for (;;) {
      if (Date.now() - started > ACTION_BUDGET_MS) {
        await ctx.scheduler.runAfter(0, internal.importImages.run, { batchId });
        return null;
      }
      const jobs = await ctx.runQuery(internal.importImages.nextJobs, { batchId, limit: PARALLEL });
      if (jobs.length === 0) return null;
      await Promise.all(
        jobs.map(async (job) => {
          const result = await fetchImage(job.url);
          if (result.ok) {
            const storageId = await ctx.storage.store(result.blob);
            await ctx.runMutation(internal.importImages.attach, {
              jobId: job._id,
              storageId,
              width: result.width,
              height: result.height,
            });
          } else {
            await ctx.runMutation(internal.importImages.fail, {
              jobId: job._id,
              error: result.error,
            });
          }
        }),
      );
      await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
    }
  },
});

async function bumpBatch(
  ctx: { db: MutationCtx["db"] },
  batchId: Id<"importBatches"> | undefined,
  field: "done" | "failed",
): Promise<void> {
  if (!batchId) return;
  const batch = await ctx.db.get("importBatches", batchId);
  if (!batch) return;
  const images = batch.images ?? { total: 0, done: 0, failed: 0 };
  await ctx.db.patch("importBatches", batchId, {
    images: { ...images, [field]: images[field] + 1 },
  });
}

export const attach = internalMutation({
  args: {
    jobId: v.id("imageFetchJobs"),
    storageId: v.id("_storage"),
    width: v.number(),
    height: v.number(),
  },
  returns: v.null(),
  handler: async (ctx, { jobId, storageId, width, height }) => {
    const job = await ctx.db.get("imageFetchJobs", jobId);
    const product = job ? await ctx.db.get("products", job.productId) : null;
    if (!job || job.status !== "pending" || !product) {
      await ctx.storage.delete(storageId);
      return null;
    }
    const content = await ctx.db
      .query("productContent")
      .withIndex("by_productId", (q) => q.eq("productId", product._id))
      .unique();
    const images = content?.images ?? [];
    if (images.length >= MAX_PRODUCT_IMAGES) {
      await ctx.storage.delete(storageId);
      await ctx.db.patch("imageFetchJobs", jobId, {
        status: "skipped",
        error: "Artikal već ima 12 slika.",
        updatedAt: Date.now(),
      });
      return null;
    }
    const batch = job.batchId ? await ctx.db.get("importBatches", job.batchId) : null;
    await setProductImages(
      ctx,
      product._id,
      [...images, { storageId, alt: product.name, width, height, sourceUrl: job.url }],
      { actor: batch?.actor ?? SYSTEM_ACTOR, emit: false },
    );
    await ctx.db.insert("uploads", {
      storageId,
      purpose: "product_image",
      uploaderKey: "import",
      status: "attached",
      attachedTo: { type: "product", id: product._id },
      checkedAt: Date.now(),
    });
    // The image belongs to the same import: keep the change rollback-able.
    const saved = (await ctx.db.get("products", product._id))!;
    if (job.batchId) {
      const changes = await ctx.db
        .query("importChanges")
        .withIndex("by_productId", (q) => q.eq("productId", product._id))
        .order("desc")
        .take(5);
      const change = changes.find((c) => c.batchId === job.batchId);
      if (change && change.productUpdatedAtAfter === product.updatedAt) {
        await ctx.db.patch("importChanges", change._id, { productUpdatedAtAfter: saved.updatedAt });
      }
    }
    await ctx.db.patch("imageFetchJobs", jobId, {
      status: "done",
      storageId,
      updatedAt: Date.now(),
    });
    await bumpBatch(ctx, job.batchId, "done");
    return null;
  },
});

export const fail = internalMutation({
  args: { jobId: v.id("imageFetchJobs"), error: v.string() },
  returns: v.null(),
  handler: async (ctx, { jobId, error }) => {
    const job = await ctx.db.get("imageFetchJobs", jobId);
    if (!job || job.status !== "pending") return null;
    const attempts = job.attempts + 1;
    const retry = attempts < MAX_ATTEMPTS && /isteklo|preuzme|odgovorio 5/i.test(error);
    await ctx.db.patch("imageFetchJobs", jobId, {
      attempts,
      error: error.slice(0, 200),
      status: retry ? "pending" : "failed",
      updatedAt: Date.now(),
    });
    if (!retry) await bumpBatch(ctx, job.batchId, "failed");
    return null;
  },
});
