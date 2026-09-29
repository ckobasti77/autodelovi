/**
 * Idempotent, re-runnable seed (docs/ARCHITECTURE.md §E8):
 *   npx convex run seed:run          reference data + ~150 demo products + demo actors/orders/inquiries
 *   npx convex run seed:createOwner  owner account from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
 *   npx convex run seed:stats        row counts per table
 * Reference rows are upserted by natural keys (`source: "seed"`); demo rows are `isDemo`.
 */
import { createAccount } from "@convex-dev/auth/server";
import { v } from "convex/values";

import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import {
  internalAction,
  internalMutation,
  internalQuery,
  type MutationCtx,
} from "./_generated/server";
import { CATEGORIES, SUBCATEGORIES, SYSTEMS } from "../lib/catalog/taxonomy";
import { formatDocumentNumber, mbCheckDigit, pibCheckDigit } from "../lib/domain/identifiers";
import { belgradeYear, endOfBelgradeDay } from "../lib/domain/time";
import { SYSTEM_ACTOR } from "./lib/authz";
import { nextCounter } from "./lib/counters";
import { seedAdminCredentials } from "./lib/env";
import {
  commitStock,
  createOrder,
  transitionOrder,
  validateCheckout,
  type NewOrderLine,
} from "./lib/orders";
import { createProduct } from "./lib/productWriter";
import { DEFAULT_SETTINGS, getSettings, getSettingsDoc } from "./lib/settings";
import { hashToken, randomToken } from "./lib/tokens";
import { buildIntro, seoDescription, seoTitle } from "./seedData/categories";
import { MANUFACTURERS } from "./seedData/manufacturers";
import { buildProductSeeds, type ProductSeed } from "./seedData/products";
import { BRANDS, ENGINES, MODELS, type PlatformGroup } from "./seedData/vehicles";

const PRODUCT_BATCH = 25;

// Reference data -----------------------------------------------------------------------

async function upsertBySlug<
  T extends "vehicleBrands" | "engines" | "manufacturers" | "priceTiers" | "categories",
>(
  ctx: MutationCtx,
  table: T,
  slug: string,
  doc: Omit<Doc<T>, "_id" | "_creationTime">,
): Promise<Id<T>> {
  // Each table has a `by_slug` index; the union of index builders is not expressible generically.
  const existing = (await ctx.db
    .query(table)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- `by_slug` exists on every table in T
    .withIndex("by_slug" as any, (q: any) => q.eq("slug", slug))
    .unique()) as Doc<T> | null;
  if (existing) {
    // Keep owner edits: only fill structural fields for seed-owned rows.
    if ((existing as { source?: string }).source === "seed") {
      await ctx.db.patch(table, existing._id, doc as Partial<Doc<T>>);
    }
    return existing._id;
  }
  return await ctx.db.insert(table, doc as never);
}

export const seedReference = internalMutation({
  args: {},
  returns: v.object({
    brands: v.number(),
    models: v.number(),
    generations: v.number(),
    engines: v.number(),
    categories: v.number(),
    manufacturers: v.number(),
    tiers: v.number(),
  }),
  handler: async (ctx) => {
    const now = Date.now();
    if (!(await getSettingsDoc(ctx)))
      await ctx.db.insert("settings", { ...DEFAULT_SETTINGS, updatedAt: now });

    const engineIds = new Map<string, Id<"engines">>();
    for (const e of ENGINES) {
      engineIds.set(e.slug, await upsertBySlug(ctx, "engines", e.slug, { ...e, source: "seed" }));
    }
    const brandIds = new Map<string, Id<"vehicleBrands">>();
    for (const b of BRANDS) {
      brandIds.set(
        b.slug,
        await upsertBySlug(ctx, "vehicleBrands", b.slug, { ...b, active: true, source: "seed" }),
      );
    }
    let models = 0;
    let generations = 0;
    for (const [mi, m] of MODELS.entries()) {
      const brandId = brandIds.get(m.brand)!;
      const existingModel = await ctx.db
        .query("vehicleModels")
        .withIndex("by_brandId_and_slug", (q) => q.eq("brandId", brandId).eq("slug", m.slug))
        .unique();
      const modelDoc = {
        brandId,
        name: m.name,
        slug: m.slug,
        aliases: m.aliases,
        sortOrder: mi,
        active: true,
        source: "seed" as const,
      };
      const modelId = existingModel
        ? existingModel._id
        : await ctx.db.insert("vehicleModels", modelDoc);
      if (existingModel && existingModel.source === "seed")
        await ctx.db.patch("vehicleModels", modelId, modelDoc);
      models++;
      for (const [gi, g] of m.generations.entries()) {
        const existingGen = await ctx.db
          .query("vehicleGenerations")
          .withIndex("by_modelId_and_slug", (q) => q.eq("modelId", modelId).eq("slug", g.slug))
          .unique();
        const genDoc = {
          brandId,
          modelId,
          name: g.name,
          ...(g.code ? { code: g.code } : {}),
          vinModelCodes: g.vinModelCodes,
          slug: g.slug,
          aliases: g.aliases,
          yearFrom: g.yearFrom,
          ...(g.yearTo !== undefined ? { yearTo: g.yearTo } : {}),
          ...(g.platform ? { platform: g.platform } : {}),
          sortOrder: gi,
          active: true,
          source: "seed" as const,
        };
        const generationId = existingGen
          ? existingGen._id
          : await ctx.db.insert("vehicleGenerations", genDoc);
        if (existingGen && existingGen.source === "seed")
          await ctx.db.patch("vehicleGenerations", generationId, genDoc);
        generations++;
        for (const engineSlug of g.engines) {
          const engineId = engineIds.get(engineSlug);
          if (!engineId) continue;
          const link = await ctx.db
            .query("generationEngines")
            .withIndex("by_generationId_and_engineId", (q) =>
              q.eq("generationId", generationId).eq("engineId", engineId),
            )
            .first();
          if (!link) await ctx.db.insert("generationEngines", { generationId, engineId });
        }
      }
    }

    // Categories: systems → categories → subcategories.
    const systemIds = new Map<string, Id<"categories">>();
    for (const s of SYSTEMS) {
      systemIds.set(
        s.slug,
        await upsertBySlug(ctx, "categories", s.slug, {
          slug: s.slug,
          name: s.labelSr,
          kind: "system",
          systemSlug: s.slug,
          relatedSlugs: [],
          sortOrder: s.order,
          active: true,
          seoTitle: seoTitle(s.labelSr),
          seoDescription: `${s.labelSr}: delovi za VW, Audi, Škoda, SEAT i Cupra — pretraga po OEM broju i vozilu, cene sa PDV-om i stanje.`,
          productCount: 0,
          inStockCount: 0,
          updatedAt: now,
          source: "seed",
        }),
      );
    }
    const categoryIds = new Map<string, Id<"categories">>();
    for (const [ci, c] of CATEGORIES.entries()) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", c.slug))
        .unique();
      categoryIds.set(
        c.slug,
        await upsertBySlug(ctx, "categories", c.slug, {
          slug: c.slug,
          name: c.labelSr,
          kind: "category",
          parentId: systemIds.get(c.system),
          systemSlug: c.system,
          ...(c.instances.length > 0 ? { partKey: c.slug } : {}),
          relatedSlugs: c.relatedSlugs,
          sortOrder: ci,
          active: true,
          intro: buildIntro(c.slug),
          seoTitle: seoTitle(c.labelSr),
          seoDescription: seoDescription(c.labelSr, c.slug),
          thumbnailPath: `/images/parts/${c.slug}.webp`,
          // Counters belong to productWriter; never reset them on re-seed.
          productCount: existing?.productCount ?? 0,
          inStockCount: existing?.inStockCount ?? 0,
          updatedAt: now,
          source: "seed",
        }),
      );
    }
    for (const [si, s] of SUBCATEGORIES.entries()) {
      const existing = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", s.slug))
        .unique();
      await upsertBySlug(ctx, "categories", s.slug, {
        slug: s.slug,
        name: s.labelSr,
        kind: "subcategory",
        parentId: categoryIds.get(s.parent),
        systemSlug: s.system,
        relatedSlugs: s.relatedSlugs,
        sortOrder: si,
        active: true,
        intro: buildIntro(s.slug),
        seoTitle: seoTitle(s.labelSr),
        seoDescription: seoDescription(s.labelSr, s.slug),
        thumbnailPath: `/images/parts/${s.slug}.webp`,
        productCount: existing?.productCount ?? 0,
        inStockCount: existing?.inStockCount ?? 0,
        updatedAt: now,
        source: "seed",
      });
    }

    for (const m of MANUFACTURERS) {
      const existing = await ctx.db
        .query("manufacturers")
        .withIndex("by_slug", (q) => q.eq("slug", m.slug))
        .unique();
      await upsertBySlug(ctx, "manufacturers", m.slug, {
        ...m,
        active: true,
        productCount: existing?.productCount ?? 0,
        source: "seed",
      });
    }

    const tiers = [
      { slug: "majstor", name: "Majstor", defaultDiscountBp: 1_000, sortOrder: 1, isDefault: true },
      {
        slug: "majstor-plus",
        name: "Majstor Plus",
        defaultDiscountBp: 1_500,
        sortOrder: 2,
        isDefault: false,
      },
      {
        slug: "partner",
        name: "Partner",
        defaultDiscountBp: 2_000,
        sortOrder: 3,
        isDefault: false,
      },
    ];
    for (const t of tiers) {
      const existing = await ctx.db
        .query("priceTiers")
        .withIndex("by_slug", (q) => q.eq("slug", t.slug))
        .unique();
      // Tiers are owner-editable: insert once, never overwrite.
      if (!existing)
        await ctx.db.insert("priceTiers", {
          ...t,
          categoryRules: [],
          manufacturerRules: [],
          active: true,
        });
    }

    return {
      brands: BRANDS.length,
      models,
      generations,
      engines: ENGINES.length,
      categories: SYSTEMS.length + CATEGORIES.length + SUBCATEGORIES.length,
      manufacturers: MANUFACTURERS.length,
      tiers: tiers.length,
    };
  },
});

// Products -----------------------------------------------------------------------------

function groupsToGenerationSlugs(groups: PlatformGroup[]): string[] {
  const out: string[] = [];
  for (const m of MODELS)
    for (const g of m.generations) if (groups.includes(g.group)) out.push(g.slug);
  return out;
}

async function fitmentsFor(ctx: MutationCtx, seed: ProductSeed) {
  const slugs = [...new Set([...groupsToGenerationSlugs(seed.groups), ...seed.generations])];
  const fitments = [];
  for (const slug of slugs) {
    const generation = await ctx.db
      .query("vehicleGenerations")
      .withIndex("by_slug", (q) => q.eq("slug", slug))
      .first();
    if (!generation) continue;
    if (seed.engines.length === 0) {
      fitments.push({
        brandId: generation.brandId,
        modelId: generation.modelId,
        generationId: generation._id,
      });
      continue;
    }
    for (const engineSlug of seed.engines) {
      const engine = await ctx.db
        .query("engines")
        .withIndex("by_slug", (q) => q.eq("slug", engineSlug))
        .unique();
      if (!engine) continue;
      const link = await ctx.db
        .query("generationEngines")
        .withIndex("by_generationId_and_engineId", (q) =>
          q.eq("generationId", generation._id).eq("engineId", engine._id),
        )
        .first();
      if (link)
        fitments.push({
          brandId: generation.brandId,
          modelId: generation.modelId,
          generationId: generation._id,
          engineId: engine._id,
        });
    }
  }
  return fitments.slice(0, 200);
}

export const seedProducts = internalMutation({
  args: { from: v.number(), to: v.number() },
  returns: v.object({ created: v.number(), skipped: v.number() }),
  handler: async (ctx, { from, to }) => {
    const seeds = buildProductSeeds().slice(from, to);
    let created = 0;
    let skipped = 0;
    for (const seed of seeds) {
      const exists = await ctx.db
        .query("products")
        .withIndex("by_sku", (q) => q.eq("sku", seed.sku))
        .first();
      if (exists) {
        skipped++;
        continue;
      }
      const category = await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", seed.category))
        .unique();
      const manufacturer = await ctx.db
        .query("manufacturers")
        .withIndex("by_slug", (q) => q.eq("slug", seed.manufacturer))
        .unique();
      if (!category || !manufacturer)
        throw new Error(
          `Seed reference missing for ${seed.sku} (${seed.category}/${seed.manufacturer})`,
        );
      const crossNumbers = [];
      for (const c of seed.crossNumbers) {
        const m = await ctx.db
          .query("manufacturers")
          .withIndex("by_slug", (q) => q.eq("slug", c.manufacturerSlug))
          .unique();
        crossNumbers.push({ manufacturer: m?.name ?? c.manufacturerSlug, raw: c.raw });
      }
      await createProduct(
        ctx,
        {
          sku: seed.sku,
          name: seed.name,
          categoryId: category._id,
          manufacturerId: manufacturer._id,
          ...(seed.quality ? { quality: seed.quality } : {}),
          ...(seed.mpn ? { mpn: seed.mpn } : {}),
          oemNumbers: seed.oemNumbers,
          crossNumbers,
          retailPricePara: seed.retailPricePara,
          stockQty: seed.stockQty,
          ...(seed.leadTimeDays !== undefined ? { leadTimeDays: seed.leadTimeDays } : {}),
          allowBackorder: seed.allowBackorder,
          universal: seed.universal,
          fitments: await fitmentsFor(ctx, seed),
          description: seed.description,
          specs: seed.specs,
          notes: "Demo artikal — podaci služe za prikaz.",
          warrantyMonths: 24,
          costNetPara: seed.costNetPara,
          supplierName: "Demo dobavljač",
          popularity: seed.popularity,
          active: true,
          isDemo: true,
          source: "seed",
        },
        { actor: SYSTEM_ACTOR, emit: false, stockReason: "receipt" },
      );
      created++;
    }
    return { created, skipped };
  },
});

// Demo actors, orders, inquiries -------------------------------------------------------

function demoPib(base8: string): string {
  return `${base8}${pibCheckDigit(base8)}`;
}
function demoMb(base7: string): string {
  return `${base7}${mbCheckDigit(base7)}`;
}

export const seedDemoAccounts = internalMutation({
  args: {},
  returns: v.object({ mechanicProfileId: v.id("mechanicProfiles"), customerId: v.id("users") }),
  handler: async (ctx) => {
    const now = Date.now();
    const ensureUser = async (email: string, fields: Partial<Doc<"users">>) => {
      const existing = await ctx.db
        .query("users")
        .withIndex("email", (q) => q.eq("email", email))
        .first();
      if (existing) return existing._id;
      return await ctx.db.insert("users", { email, ...fields, isDemo: true });
    };
    const mechanicUserId = await ensureUser("majstor.demo@sklop.test", {
      name: "Demo Majstor",
      firstName: "Demo",
      lastName: "Majstor",
      phoneE164: "+381640000001",
      role: "customer",
      status: "active",
    });
    const customerId = await ensureUser("kupac.demo@sklop.test", {
      name: "Demo Kupac",
      firstName: "Demo",
      lastName: "Kupac",
      phoneE164: "+381640000002",
      role: "customer",
      status: "active",
    });
    let profile = await ctx.db
      .query("mechanicProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", mechanicUserId))
      .first();
    if (!profile) {
      const tier = await ctx.db
        .query("priceTiers")
        .withIndex("by_slug", (q) => q.eq("slug", "majstor-plus"))
        .unique();
      const golfBrand = await ctx.db
        .query("vehicleBrands")
        .withIndex("by_slug", (q) => q.eq("slug", "volkswagen"))
        .unique();
      const skoda = await ctx.db
        .query("vehicleBrands")
        .withIndex("by_slug", (q) => q.eq("slug", "skoda"))
        .unique();
      const profileId = await ctx.db.insert("mechanicProfiles", {
        userId: mechanicUserId,
        status: "approved",
        companyName: "Demo Auto Servis",
        pib: demoPib("11122233"),
        mb: demoMb("2112223"),
        contactPerson: "Demo Majstor",
        phone: "+381640000001",
        email: "majstor.demo@sklop.test",
        city: "Beograd",
        address: "Demo adresa bb",
        serviceTypes: ["mehanika", "dijagnostika"],
        brandsServiced: [golfBrand?._id, skoda?._id].filter((x): x is Id<"vehicleBrands"> =>
          Boolean(x),
        ),
        ...(tier ? { tierId: tier._id } : {}),
        creditEnabled: true,
        creditLimitPara: 20_000_000,
        paymentTermsDays: 15,
        consent: {
          termsVersion: "2026-09-29",
          privacyVersion: "2026-09-29",
          acceptedAt: now,
          marketingEmail: false,
          analytics: false,
          ads: false,
        },
        reviewedAt: now,
        isDemo: true,
        updatedAt: now,
      });
      await ctx.db.patch("users", mechanicUserId, {
        mechanicStatus: "approved",
        mechanicProfileId: profileId,
      });
      profile = (await ctx.db.get("mechanicProfiles", profileId))!;
    }
    return { mechanicProfileId: profile._id, customerId };
  },
});

const DEMO_CONSENT = {
  termsVersion: "2026-09-29",
  privacyVersion: "2026-09-29",
  acceptedAt: 0,
  marketingEmail: false,
  analytics: false,
  ads: false,
};

export const seedDemoOrders = internalMutation({
  args: {},
  returns: v.object({ created: v.number() }),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("orders")
      .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
      .first();
    if (existing) return { created: 0 };
    const settings = await getSettings(ctx);
    const bySku = async (sku: string) =>
      (await ctx.db
        .query("products")
        .withIndex("by_sku", (q) => q.eq("sku", sku))
        .unique())!;
    const line = (p: Doc<"products">, quantity: number, discountBp = 0): NewOrderLine => {
      const unitPricePara =
        Math.round((p.retailPricePara * (10_000 - discountBp)) / 10_000 / 100) * 100;
      return {
        productId: p._id,
        sku: p.sku,
        name: p.name,
        manufacturerName: p.manufacturerName,
        quality: p.quality,
        ...(p.oemPrimary ? { oem: p.oemPrimary } : {}),
        quantity,
        unitRetailPara: p.retailPricePara,
        unitPricePara,
        discountBp,
        availabilityAtOrder: p.stockState,
        isCustomLine: false,
        categoryId: p.categoryId,
      };
    };
    const mechanic = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "majstor.demo@sklop.test"))
      .first();
    const profile = mechanic
      ? await ctx.db
          .query("mechanicProfiles")
          .withIndex("by_userId", (q) => q.eq("userId", mechanic._id))
          .first()
      : null;
    const customer = await ctx.db
      .query("users")
      .withIndex("email", (q) => q.eq("email", "kupac.demo@sklop.test"))
      .first();

    type Plan = {
      skus: [string, number][];
      contact: { firstName: string; lastName: string; email: string; phone: string };
      delivery: "pickup" | "courier";
      payment: "cod" | "pickup_cash" | "pickup_card" | "bank_transfer";
      path: Array<
        | "potvrdjena"
        | "ceka_deo"
        | "spremna_za_preuzimanje"
        | "poslata"
        | "preuzeta"
        | "isporucena"
        | "zavrsena"
        | "otkazana"
      >;
      mechanic?: boolean;
      company?: boolean;
    };
    const plans: Plan[] = [
      {
        skus: [
          ["DEMO-0001", 2],
          ["DEMO-0009", 1],
        ],
        contact: {
          firstName: "Petar",
          lastName: "Demo",
          email: "petar.demo@sklop.test",
          phone: "+381641000001",
        },
        delivery: "courier",
        payment: "cod",
        path: [],
      },
      {
        skus: [["DEMO-0058", 1]],
        contact: {
          firstName: "Jelena",
          lastName: "Demo",
          email: "jelena.demo@sklop.test",
          phone: "+381641000002",
        },
        delivery: "pickup",
        payment: "pickup_cash",
        path: ["potvrdjena"],
      },
      {
        skus: [["DEMO-0045", 1]],
        contact: {
          firstName: "Nikola",
          lastName: "Demo",
          email: "nikola.demo@sklop.test",
          phone: "+381641000003",
        },
        delivery: "courier",
        payment: "bank_transfer",
        path: ["ceka_deo"],
        company: true,
      },
      {
        skus: [
          ["DEMO-0023", 2],
          ["DEMO-0035", 2],
        ],
        contact: {
          firstName: "Demo",
          lastName: "Majstor",
          email: "majstor.demo@sklop.test",
          phone: "+381640000001",
        },
        delivery: "pickup",
        payment: "pickup_card",
        path: ["potvrdjena", "spremna_za_preuzimanje"],
        mechanic: true,
      },
      {
        skus: [
          ["DEMO-0137", 1],
          ["DEMO-0141", 1],
        ],
        contact: {
          firstName: "Demo",
          lastName: "Kupac",
          email: "kupac.demo@sklop.test",
          phone: "+381640000002",
        },
        delivery: "courier",
        payment: "cod",
        path: ["potvrdjena", "poslata"],
      },
      {
        skus: [["DEMO-0105", 1]],
        contact: {
          firstName: "Milica",
          lastName: "Demo",
          email: "milica.demo@sklop.test",
          phone: "+381641000004",
        },
        delivery: "pickup",
        payment: "pickup_cash",
        path: ["potvrdjena", "spremna_za_preuzimanje", "preuzeta"],
      },
      {
        skus: [
          ["DEMO-0002", 2],
          ["DEMO-0010", 1],
        ],
        contact: {
          firstName: "Demo",
          lastName: "Majstor",
          email: "majstor.demo@sklop.test",
          phone: "+381640000001",
        },
        delivery: "courier",
        payment: "bank_transfer",
        path: ["potvrdjena", "poslata", "isporucena", "zavrsena"],
        mechanic: true,
        company: true,
      },
      {
        skus: [["DEMO-0073", 1]],
        contact: {
          firstName: "Stefan",
          lastName: "Demo",
          email: "stefan.demo@sklop.test",
          phone: "+381641000005",
        },
        delivery: "courier",
        payment: "cod",
        path: ["otkazana"],
      },
    ];

    let created = 0;
    for (const plan of plans) {
      const lines = [];
      for (const [sku, qty] of plan.skus)
        lines.push(line(await bySku(sku), qty, plan.mechanic ? 1_500 : 0));
      const checkout = validateCheckout(
        {
          contact: plan.contact,
          ...(plan.company
            ? {
                company: {
                  name: "Demo Firma d.o.o.",
                  pib: demoPib("10987654"),
                  mb: demoMb("2098765"),
                },
              }
            : {}),
          delivery:
            plan.delivery === "courier"
              ? {
                  method: "courier",
                  address: { street: "Demo ulica 1", city: "Novi Sad", postalCode: "21000" },
                }
              : { method: "pickup" },
          payment: { method: plan.payment },
          consent: { ...DEMO_CONSENT, acceptedAt: Date.now() },
        },
        settings,
        null,
      );
      const order = await createOrder(ctx, {
        checkout,
        lines,
        customerType: plan.mechanic
          ? "mechanic"
          : plan.contact.email === "kupac.demo@sklop.test"
            ? "customer"
            : "guest",
        ...(plan.mechanic && mechanic
          ? { userId: mechanic._id }
          : plan.contact.email === "kupac.demo@sklop.test" && customer
            ? { userId: customer._id }
            : {}),
        ...(plan.mechanic && profile ? { mechanicProfileId: profile._id } : {}),
        source: "web",
        isDemo: true,
        actor: SYSTEM_ACTOR,
      });
      for (const to of plan.path) {
        await transitionOrder(ctx, order.orderId, to, {
          actor: { type: "staff", name: "Demo" },
          auditAsStaff: false,
          ...(to === "otkazana" ? { reason: "Kupac je odustao (demo)." } : {}),
          ...(to === "poslata"
            ? {
                tracking: {
                  courierCode: "dexpress",
                  trackingNumber: `DEMO${order.number.replace(/\D/g, "")}`,
                },
              }
            : {}),
        });
      }
      if (plan.path.length === 0 && settings.commerce.stockDecrementOn === "created")
        await commitStock(ctx, order.orderId, "order_created", SYSTEM_ACTOR);
      created++;
    }
    return { created };
  },
});

export const seedDemoInquiries = internalMutation({
  args: {},
  returns: v.object({ created: v.number() }),
  handler: async (ctx) => {
    const existing = await ctx.db
      .query("inquiries")
      .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
      .first();
    if (existing) return { created: 0 };
    const settings = await getSettings(ctx);
    const now = Date.now();
    const year = belgradeYear(now);
    const plans = [
      {
        status: "nov" as const,
        kind: "vin" as const,
        vin: "WVWZZZ1KZ8W000001",
        message: "Treba mi set kvačila i zamajac, auto trokira pri kretanju.",
        name: "Demo Vozač",
        phone: "+381642000001",
        channel: "viber" as const,
      },
      {
        status: "u_obradi" as const,
        kind: "part" as const,
        message: "Pumpa za vodu za Octavia III 1.6 TDI, ima li na stanju?",
        name: "Demo Kupac",
        email: "kupac.demo@sklop.test",
        phone: "+381640000002",
        channel: "email" as const,
      },
      {
        status: "ponuda_poslata" as const,
        kind: "not_found" as const,
        message: "Nisam našao nosač motora za Tiguan 2.0 TDI 2014.",
        name: "Demo Majstor",
        phone: "+381640000001",
        email: "majstor.demo@sklop.test",
        channel: "phone" as const,
        quote: true,
      },
      {
        status: "odbijena" as const,
        kind: "product_question" as const,
        message: "Da li ovaj disk ide na Leon Cupra?",
        name: "Demo Pitanje",
        email: "pitanje.demo@sklop.test",
        channel: "email" as const,
      },
    ];
    let created = 0;
    for (const plan of plans) {
      const seq = await nextCounter(ctx, `inquiry:${year}`);
      const number = formatDocumentNumber(settings.brand.inquiryPrefix, year, seq);
      const inquiryId = await ctx.db.insert("inquiries", {
        number,
        year,
        seq,
        publicTokenHash: await hashToken(randomToken()),
        status: plan.status,
        kind: plan.kind,
        ...(plan.vin
          ? {
              vin: plan.vin,
              vinInfo: {
                wmi: plan.vin.slice(0, 3),
                brandGuess: "Volkswagen",
                modelCode: plan.vin.slice(6, 8),
              },
            }
          : {}),
        message: plan.message,
        categorySlugs: [],
        requestedCodes: [],
        photos: [],
        contact: {
          name: plan.name,
          ...(plan.email ? { email: plan.email } : {}),
          ...(plan.phone ? { phone: plan.phone } : {}),
          preferredChannel: plan.channel,
        },
        consent: { ...DEMO_CONSENT, acceptedAt: now },
        reminderLevel: 0,
        searchText: `${number.toLowerCase()} ${plan.name.toLowerCase()}`,
        ...(plan.status === "odbijena" ? { closedReason: "Deo nije kompatibilan (demo)." } : {}),
        isDemo: true,
        updatedAt: now,
      });
      await ctx.db.insert("inquiryEvents", {
        inquiryId,
        type: "created",
        toStatus: "nov",
        message: "Upit je primljen.",
        visibleToCustomer: true,
        actor: SYSTEM_ACTOR,
        at: now,
      });
      if (plan.quote) {
        const mount = await ctx.db
          .query("products")
          .withIndex("by_sku", (q) => q.eq("sku", "DEMO-0078"))
          .unique();
        const lines = [
          {
            ...(mount
              ? {
                  productId: mount._id,
                  sku: mount.sku,
                  manufacturer: mount.manufacturerName,
                  quality: mount.quality,
                }
              : {}),
            name: mount?.name ?? "Nosač motora",
            quantity: 1,
            unitPricePara: mount ? Math.round(mount.retailPricePara * 0.9) : 890_000,
            availability: "in_stock" as const,
          },
          {
            name: "Nosač menjača, po porudžbini",
            quantity: 1,
            unitPricePara: 649_000,
            availability: "on_order" as const,
            leadTimeDays: 3,
          },
        ];
        const quoteId = await ctx.db.insert("quotes", {
          inquiryId,
          version: 1,
          status: "sent",
          validUntil: endOfBelgradeDay(now, settings.commerce.quoteValidityDays),
          lines,
          totalPara: lines.reduce((s, l) => s + l.quantity * l.unitPricePara, 0),
          sentAt: now,
          isDemo: true,
        });
        await ctx.db.patch("inquiries", inquiryId, {
          currentQuoteId: quoteId,
          firstResponseAt: now,
        });
        await ctx.db.insert("inquiryEvents", {
          inquiryId,
          type: "quote_sent",
          message: "Ponuda v1 poslata",
          visibleToCustomer: false,
          actor: SYSTEM_ACTOR,
          at: now,
        });
      }
      created++;
    }
    return { created };
  },
});

export const run = internalAction({
  args: {},
  returns: v.object({
    reference: v.object({
      brands: v.number(),
      models: v.number(),
      generations: v.number(),
      engines: v.number(),
      categories: v.number(),
      manufacturers: v.number(),
      tiers: v.number(),
    }),
    productsCreated: v.number(),
    productsSkipped: v.number(),
    demoOrders: v.number(),
    demoInquiries: v.number(),
  }),
  handler: async (ctx) => {
    const reference: {
      brands: number;
      models: number;
      generations: number;
      engines: number;
      categories: number;
      manufacturers: number;
      tiers: number;
    } = await ctx.runMutation(internal.seed.seedReference, {});
    const total = buildProductSeeds().length;
    let productsCreated = 0;
    let productsSkipped = 0;
    for (let from = 0; from < total; from += PRODUCT_BATCH) {
      const r: { created: number; skipped: number } = await ctx.runMutation(
        internal.seed.seedProducts,
        { from, to: from + PRODUCT_BATCH },
      );
      productsCreated += r.created;
      productsSkipped += r.skipped;
    }
    await ctx.runMutation(internal.seed.seedDemoAccounts, {});
    const orders: { created: number } = await ctx.runMutation(internal.seed.seedDemoOrders, {});
    const inquiries: { created: number } = await ctx.runMutation(
      internal.seed.seedDemoInquiries,
      {},
    );
    return {
      reference,
      productsCreated,
      productsSkipped,
      demoOrders: orders.created,
      demoInquiries: inquiries.created,
    };
  },
});

// Owner --------------------------------------------------------------------------------

export const findPasswordAccount = internalQuery({
  args: { email: v.string() },
  returns: v.union(
    v.null(),
    v.object({ userId: v.id("users"), role: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx, { email }) => {
    const account = await ctx.db
      .query("authAccounts")
      .withIndex("providerAndAccountId", (q) =>
        q.eq("provider", "password").eq("providerAccountId", email),
      )
      .unique();
    if (!account) return null;
    const user = await ctx.db.get("users", account.userId);
    return user ? { userId: user._id, role: user.role ?? null } : null;
  },
});

export const promoteOwner = internalMutation({
  args: { userId: v.id("users") },
  returns: v.null(),
  handler: async (ctx, { userId }) => {
    const user = await ctx.db.get("users", userId);
    if (!user) throw new Error("Owner user missing");
    if (user.role !== "owner" || user.status !== "active") {
      await ctx.db.patch("users", userId, {
        role: "owner",
        status: "active",
        isDemo: false,
        name: user.name ?? "Vlasnik",
      });
      await ctx.db.insert("auditLog", {
        actor: SYSTEM_ACTOR,
        action: "user.role",
        entityType: "user",
        entityId: userId,
        summary: "Nalog vlasnika je kreiran iz seed-a",
        diff: [{ field: "role", ...(user.role ? { before: user.role } : {}), after: "owner" }],
        at: Date.now(),
      });
    }
    return null;
  },
});

/** Creates (or re-promotes) the owner from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD. Never logs the password. */
export const createOwner = internalAction({
  args: {},
  returns: v.object({
    status: v.union(v.literal("created"), v.literal("exists"), v.literal("missing_env")),
    email: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    const creds = seedAdminCredentials();
    if (!creds) return { status: "missing_env" as const, email: null };
    const email = creds.email.toLowerCase();
    const existing: { userId: Id<"users">; role: string | null } | null = await ctx.runQuery(
      internal.seed.findPasswordAccount,
      { email },
    );
    if (existing) {
      await ctx.runMutation(internal.seed.promoteOwner, { userId: existing.userId });
      return { status: "exists" as const, email };
    }
    const { user } = await createAccount(ctx, {
      provider: "password",
      account: { id: email, secret: creds.password },
      profile: { email, name: "Vlasnik" },
    });
    await ctx.runMutation(internal.seed.promoteOwner, { userId: user._id as Id<"users"> });
    return { status: "created" as const, email };
  },
});

// Stats --------------------------------------------------------------------------------

const STATS_TABLES = [
  "users",
  "vehicleBrands",
  "vehicleModels",
  "vehicleGenerations",
  "engines",
  "generationEngines",
  "categories",
  "manufacturers",
  "products",
  "productContent",
  "productPrivate",
  "productCodes",
  "fitments",
  "priceTiers",
  "mechanicProfiles",
  "carts",
  "orders",
  "orderItems",
  "orderEvents",
  "inquiries",
  "quotes",
  "stockMovements",
  "domainEvents",
  "notifications",
  "auditLog",
  "settings",
  "counters",
  "authAccounts",
] as const;

export const stats = internalQuery({
  args: {},
  returns: v.object({
    counts: v.record(v.string(), v.number()),
    owners: v.number(),
    demoProducts: v.number(),
  }),
  handler: async (ctx) => {
    const counts: Record<string, number> = {};
    for (const table of STATS_TABLES) {
      counts[table] = (await ctx.db.query(table).take(10_000)).length;
    }
    const owners = (
      await ctx.db
        .query("users")
        .withIndex("by_role", (q) => q.eq("role", "owner"))
        .take(50)
    ).length;
    const demoProducts = (
      await ctx.db
        .query("products")
        .withIndex("by_isDemo", (q) => q.eq("isDemo", true))
        .take(10_000)
    ).length;
    return { counts, owners, demoProducts };
  },
});
