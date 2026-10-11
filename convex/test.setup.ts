/// <reference types="vite/client" />
/**
 * Shared convex-test setup: registers components and builds a small world with every role
 * (anonymous, customers, pending / approved / suspended mechanics, staff, owner) and five
 * products covering the stock states. Not deployed (the Convex bundler skips names with
 * several dots) and not a test file itself.
 */
import rateLimiter from "@convex-dev/rate-limiter/test";
import resend from "@convex-dev/resend/test";
import { convexTest } from "convex-test";

import { internal } from "./_generated/api";
import { mbCheckDigit, pibCheckDigit } from "../lib/domain/identifiers";
import type { Id } from "./_generated/dataModel";
import { SYSTEM_ACTOR } from "./lib/authz";
import { createProduct } from "./lib/productWriter";
import schema from "./schema";

export const modules = import.meta.glob(["./**/*.ts", "!./**/*.test.ts", "!./test.setup.ts"]);

export function makeT() {
  const t = convexTest(schema, modules);
  rateLimiter.register(t);
  resend.register(t);
  return t;
}

export type T = ReturnType<typeof makeT>;

export const CONSENT = {
  termsVersion: "2026-09-29",
  privacyVersion: "2026-09-29",
  acceptedAt: 1,
  marketingEmail: false,
  analytics: false,
  ads: false,
};

export const CONTACT = {
  firstName: "Petar",
  lastName: "Petrović",
  email: "Petar@Primer.rs",
  phone: "064 123 4567",
};

/** A valid 9-digit PIB and 8-digit MB (checksums computed, not real companies). */
export const VALID_PIB = `11122233${pibCheckDigit("11122233")}`;
export const VALID_MB = `2112223${mbCheckDigit("2112223")}`;

export async function setupWorld(t: T) {
  await t.mutation(internal.seed.seedReference, {});
  const ids = await t.run(async (ctx) => {
    const bySlug = async (slug: string) =>
      (await ctx.db
        .query("categories")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique())!._id;
    const maker = async (slug: string) =>
      (await ctx.db
        .query("manufacturers")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique())!._id;
    const tier = async (slug: string) =>
      (await ctx.db
        .query("priceTiers")
        .withIndex("by_slug", (q) => q.eq("slug", slug))
        .unique())!;
    const golf7 = (await ctx.db
      .query("vehicleGenerations")
      .withIndex("by_slug", (q) => q.eq("slug", "golf-7"))
      .first())!;
    const golf6 = (await ctx.db
      .query("vehicleGenerations")
      .withIndex("by_slug", (q) => q.eq("slug", "golf-6"))
      .first())!;
    const tdi110 = (await ctx.db
      .query("engines")
      .withIndex("by_slug", (q) => q.eq("slug", "2-0-tdi-110kw"))
      .unique())!;

    const user = (email: string, extra: Record<string, unknown> = {}) =>
      ctx.db.insert("users", { email, name: email.split("@")[0], status: "active", ...extra });
    const owner = await user("owner@primer.test", { role: "owner" });
    const staff = await user("staff@primer.test", { role: "staff" });
    const customerA = await user("a@primer.test", { role: "customer" });
    const customerB = await user("b@primer.test", { role: "customer" });
    const blocked = await user("blocked@primer.test", { role: "customer", status: "blocked" });

    const majstor = await tier("majstor");
    const partner = await tier("partner");
    const discCategory = await bySlug("kocioni-diskovi");
    // Partner tier: 25 % on brake discs (category rule), default 20 %.
    await ctx.db.patch("priceTiers", partner._id, {
      categoryRules: [{ categoryId: discCategory, discountBp: 2_500 }],
    });

    const mechanic = async (
      email: string,
      status: "pending" | "approved" | "suspended",
      tierId?: Id<"priceTiers">,
      creditEnabled = false,
    ) => {
      const userId = await user(email, { role: "customer" });
      const profileId = await ctx.db.insert("mechanicProfiles", {
        userId,
        status,
        companyName: `Servis ${email}`,
        pib: VALID_PIB,
        mb: VALID_MB,
        contactPerson: "Majstor",
        phone: "+381641234567",
        email,
        city: "Beograd",
        address: "Ulica 1",
        serviceTypes: ["mehanika"],
        brandsServiced: [],
        ...(tierId ? { tierId } : {}),
        creditEnabled,
        paymentTermsDays: 15,
        consent: CONSENT,
        isDemo: false,
        updatedAt: 0,
      });
      await ctx.db.patch("users", userId, { mechanicStatus: status, mechanicProfileId: profileId });
      return { userId, profileId };
    };
    const pending = await mechanic("pending@primer.test", "pending");
    const mechA = await mechanic("mech-a@primer.test", "approved", majstor._id, true);
    const mechB = await mechanic("mech-b@primer.test", "approved", partner._id);
    const suspended = await mechanic("suspended@primer.test", "suspended", majstor._id);

    const base = {
      oemNumbers: [],
      crossNumbers: [],
      allowBackorder: false,
      universal: false,
      fitments: [],
      specs: [],
      active: true,
      isDemo: false,
      source: "manual" as const,
    };
    const meta = { actor: SYSTEM_ACTOR, emit: false };
    const disc = await createProduct(
      ctx,
      {
        ...base,
        sku: "T-DISC",
        name: "Kočioni disk prednji 312 mm",
        categoryId: discCategory,
        manufacturerId: await maker("ate"),
        oemNumbers: [{ raw: "5Q0 615 301 F", brand: "VAG" }],
        crossNumbers: [{ manufacturer: "TRW", raw: "DF-6503" }],
        mpn: "24.0125-0184.1",
        retailPricePara: 1_000_000,
        costNetPara: 500_000,
        stockQty: 10,
        fitments: [{ brandId: golf7.brandId, modelId: golf7.modelId, generationId: golf7._id }],
      },
      meta,
    );
    const pads = await createProduct(
      ctx,
      {
        ...base,
        sku: "T-PADS",
        name: "Kočione pločice prednje",
        categoryId: await bySlug("kocione-plocice"),
        manufacturerId: await maker("brembo"),
        oemNumbers: [{ raw: "5Q0 698 151 B" }],
        retailPricePara: 500_000,
        stockQty: 2,
        fitments: [
          {
            brandId: golf7.brandId,
            modelId: golf7.modelId,
            generationId: golf7._id,
            engineId: tdi110._id,
          },
        ],
      },
      meta,
    );
    const filter = await createProduct(
      ctx,
      {
        ...base,
        sku: "T-FILTER",
        name: "Filter ulja",
        categoryId: await bySlug("filter-ulja"),
        manufacturerId: await maker("mann-filter"),
        retailPricePara: 100_000,
        stockQty: 0,
        fitments: [{ brandId: golf6.brandId, modelId: golf6.modelId, generationId: golf6._id }],
      },
      meta,
    );
    const turbo = await createProduct(
      ctx,
      {
        ...base,
        sku: "T-TURBO",
        name: "Turbina 2.0 TDI",
        categoryId: await bySlug("turbina"),
        manufacturerId: await maker("garrett"),
        retailPricePara: 10_000_000,
        stockQty: 0,
        leadTimeDays: 3,
        allowBackorder: true,
      },
      meta,
    );
    const battery = await createProduct(
      ctx,
      {
        ...base,
        sku: "T-BATT",
        name: "Akumulator 60 Ah",
        categoryId: await bySlug("akumulator"),
        manufacturerId: await maker("varta"),
        retailPricePara: 1_200_000,
        costNetPara: 950_000,
        stockQty: 20,
        universal: true,
      },
      meta,
    );
    return {
      owner,
      staff,
      customerA,
      customerB,
      blocked,
      pending,
      mechA,
      mechB,
      suspended,
      products: { disc, pads, filter, turbo, battery },
      categories: { disc: discCategory },
      tiers: { majstor: majstor._id, partner: partner._id },
      golf7: golf7._id,
      tdi110: tdi110._id,
    };
  });

  const as = (userId: Id<"users">) => t.withIdentity({ subject: `${userId}|test-session` });
  return {
    ...ids,
    anon: t,
    asOwner: as(ids.owner),
    asStaff: as(ids.staff),
    asCustomerA: as(ids.customerA),
    asCustomerB: as(ids.customerB),
    asBlocked: as(ids.blocked),
    asPending: as(ids.pending.userId),
    asMechA: as(ids.mechA.userId),
    asMechB: as(ids.mechB.userId),
    asSuspended: as(ids.suspended.userId),
  };
}

export type World = Awaited<ReturnType<typeof setupWorld>>;

/** 32-char base64url guest cart token. */
export const GUEST = "guest-token-aaaaaaaaaaaaaaaaaaaaaaaaaaaa";
export const GUEST_2 = "guest-token-bbbbbbbbbbbbbbbbbbbbbbbbbbbb";

/** Error `code` of a ConvexError thrown by `fn`, or "NO_ERROR". */
export async function errorCode(fn: () => Promise<unknown>): Promise<string> {
  try {
    await fn();
    return "NO_ERROR";
  } catch (error) {
    const data = (error as { data?: unknown }).data;
    if (data && typeof data === "object" && "code" in data)
      return String((data as { code: unknown }).code);
    return `PLAIN:${(error as Error).message}`;
  }
}

export function checkoutArgs(overrides: Record<string, unknown> = {}) {
  return {
    contact: CONTACT,
    delivery: {
      method: "courier" as const,
      address: { street: "Bulevar 1", city: "Beograd", postalCode: "11000" },
    },
    payment: { method: "cod" as const },
    consent: CONSENT,
    honeypot: "",
    startedAt: Date.now() - 60_000,
    ...overrides,
  };
}
