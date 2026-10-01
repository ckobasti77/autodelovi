/**
 * Mechanic (B2B) self-service: registration of the signed-in account, own profile.
 */
import { v } from "convex/values";

import type { Doc } from "./_generated/dataModel";

import { consentInForce, sanitizeAttribution } from "./lib/attribution";
import {
  isValidEmail,
  isValidMb,
  isValidPib,
  normalizeEmail,
  normalizeMb,
  normalizePib,
} from "../lib/domain/identifiers";
import { normalizePhone } from "../lib/format/phone";
import { actorOf } from "./lib/authz";
import { fail, invalid } from "./lib/errors";
import { emitEvent } from "./lib/events";
import { userMutation, userQuery } from "./lib/functions";
import { enforceRateLimit } from "./lib/rateLimits";
import { getSettings } from "./lib/settings";
import { bumpStatsDaily } from "./lib/stats";
import { attributionV, consentV, mechanicStatusV, serviceTypeV } from "./lib/validators";

export const register = userMutation({
  args: {
    companyName: v.string(),
    pib: v.string(),
    mb: v.string(),
    contactPerson: v.string(),
    phone: v.string(),
    email: v.optional(v.string()),
    city: v.string(),
    address: v.string(),
    serviceTypes: v.array(serviceTypeV),
    brandsServiced: v.array(v.id("vehicleBrands")),
    consent: consentV,
    attribution: v.optional(attributionV),
    /** Page the registration was sent from (Meta CAPI `event_source_url`). */
    eventSourceUrl: v.optional(v.string()),
  },
  returns: v.id("mechanicProfiles"),
  handler: async (ctx, args) => {
    const settings = await getSettings(ctx);
    if (!settings.flags.mechanicRegistration)
      fail("DISABLED", "Registracija majstora je trenutno isključena.");
    await enforceRateLimit(ctx, "mechanicRegister", ctx.client.key);
    const viewer = ctx.viewer;
    if (viewer.user.mechanicProfileId)
      fail("DUPLICATE", "Ovaj nalog već ima registraciju servisa.");
    const existingProfile = await ctx.db
      .query("mechanicProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", viewer.userId))
      .first();
    if (existingProfile) fail("DUPLICATE", "Ovaj nalog već ima registraciju servisa.");

    const companyName = args.companyName.trim().slice(0, 120);
    if (!companyName) invalid("Upišite naziv servisa ili firme.", "companyName");
    const pib = normalizePib(args.pib);
    if (!isValidPib(pib)) invalid("PIB nije ispravan (9 cifara, kontrolni broj).", "pib");
    const mb = normalizeMb(args.mb);
    if (!isValidMb(mb)) invalid("Matični broj nije ispravan (8 cifara).", "mb");
    // A rejected registration does not hold the PIB (the workshop may apply again).
    const samePib = await ctx.db
      .query("mechanicProfiles")
      .withIndex("by_pib", (q) => q.eq("pib", pib))
      .take(20);
    const pibTaken = samePib.some((p) => p.status !== "rejected");
    if (pibTaken)
      fail("DUPLICATE", "Ovaj PIB je već registrovan — prijavite se ili nas pozovite.", {
        field: "pib",
      });
    const contactPerson = args.contactPerson.trim().slice(0, 80);
    if (!contactPerson) invalid("Upišite kontakt osobu.", "contactPerson");
    const phone = normalizePhone(args.phone);
    if (!phone) invalid("Upišite ispravan broj telefona.", "phone");
    const email = normalizeEmail(args.email ?? viewer.user.email ?? "");
    if (!isValidEmail(email))
      invalid("Adresa e-pošte nije ispravna. Primer: ime@primer.rs.", "email");
    const city = args.city.trim().slice(0, 60);
    const address = args.address.trim().slice(0, 160);
    if (!city || !address) invalid("Upišite grad i adresu servisa.", "address");
    if (args.serviceTypes.length === 0 || args.serviceTypes.length > 7)
      invalid("Izaberite vrstu servisa.", "serviceTypes");
    if (args.brandsServiced.length > 5) invalid("Najviše 5 marki.", "brandsServiced");

    const now = Date.now();
    const consent = consentInForce(settings, args.consent, now);
    const attribution = sanitizeAttribution(args.attribution);
    const profileId = await ctx.db.insert("mechanicProfiles", {
      userId: viewer.userId,
      status: "pending",
      companyName,
      pib,
      mb,
      contactPerson,
      phone,
      email,
      city,
      address,
      serviceTypes: [...new Set(args.serviceTypes)],
      brandsServiced: [...new Set(args.brandsServiced)],
      creditEnabled: false,
      paymentTermsDays: 15,
      ...(attribution ? { attribution } : {}),
      consent,
      isDemo: false,
      updatedAt: now,
    });
    await ctx.db.patch("users", viewer.userId, {
      mechanicStatus: "pending",
      mechanicProfileId: profileId,
      ...(viewer.user.phoneE164 ? {} : { phoneE164: phone }),
    });
    await emitEvent(ctx, {
      type: "mechanic.registered",
      aggregateType: "mechanic",
      aggregateId: profileId,
      payload: { kind: "mechanic", profileId, userId: viewer.userId, companyName },
      dedupeKey: `mechanic.registered:${profileId}`,
      actor: actorOf(viewer),
      ...(args.attribution?.consentAds && ctx.client.ip && ctx.client.userAgent
        ? {
            capiContext: {
              ip: ctx.client.ip,
              userAgent: ctx.client.userAgent,
              eventSourceUrl: (args.eventSourceUrl ?? "").slice(0, 500),
            },
          }
        : {}),
    });
    await bumpStatsDaily(ctx, now, { registrationsCount: 1 });
    return profileId;
  },
});

export const myProfile = userQuery({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      profileId: v.id("mechanicProfiles"),
      status: mechanicStatusV,
      companyName: v.string(),
      pib: v.string(),
      mb: v.string(),
      contactPerson: v.string(),
      phone: v.string(),
      email: v.string(),
      city: v.string(),
      address: v.string(),
      serviceTypes: v.array(serviceTypeV),
      brandsServiced: v.array(v.id("vehicleBrands")),
      tierName: v.union(v.string(), v.null()),
      tierDiscountBp: v.union(v.number(), v.null()),
      creditEnabled: v.boolean(),
      creditLimitPara: v.union(v.number(), v.null()),
      paymentTermsDays: v.number(),
      rejectionReason: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    const profile = await ctx.db
      .query("mechanicProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewer.userId))
      .first();
    if (!profile) return null;
    const tier =
      profile.status === "approved" && profile.tierId
        ? await ctx.db.get("priceTiers", profile.tierId)
        : null;
    return {
      profileId: profile._id,
      status: profile.status,
      companyName: profile.companyName,
      pib: profile.pib,
      mb: profile.mb,
      contactPerson: profile.contactPerson,
      phone: profile.phone,
      email: profile.email,
      city: profile.city,
      address: profile.address,
      serviceTypes: profile.serviceTypes,
      brandsServiced: profile.brandsServiced,
      tierName: tier?.name ?? null,
      tierDiscountBp: tier?.defaultDiscountBp ?? null,
      creditEnabled: profile.creditEnabled,
      creditLimitPara: profile.creditLimitPara ?? null,
      paymentTermsDays: profile.paymentTermsDays,
      rejectionReason: profile.status === "rejected" ? (profile.rejectionReason ?? null) : null,
    };
  },
});

/** Contact details the mechanic may change himself (company identity changes go via staff). */
export const updateMyProfile = userMutation({
  args: {
    contactPerson: v.optional(v.string()),
    phone: v.optional(v.string()),
    city: v.optional(v.string()),
    address: v.optional(v.string()),
    serviceTypes: v.optional(v.array(serviceTypeV)),
    brandsServiced: v.optional(v.array(v.id("vehicleBrands"))),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const profile = await ctx.db
      .query("mechanicProfiles")
      .withIndex("by_userId", (q) => q.eq("userId", ctx.viewer.userId))
      .first();
    if (!profile) fail("NOT_FOUND", "Nemate registrovan servis.");
    const patch: Partial<Doc<"mechanicProfiles">> = {};
    if (args.contactPerson !== undefined)
      patch.contactPerson = args.contactPerson.trim().slice(0, 80);
    if (args.phone !== undefined) {
      const phone = normalizePhone(args.phone);
      if (!phone) invalid("Upišite ispravan broj telefona.", "phone");
      patch.phone = phone;
    }
    if (args.city !== undefined) patch.city = args.city.trim().slice(0, 60);
    if (args.address !== undefined) patch.address = args.address.trim().slice(0, 160);
    if (args.serviceTypes !== undefined)
      patch.serviceTypes = [...new Set(args.serviceTypes)].slice(0, 7);
    if (args.brandsServiced !== undefined)
      patch.brandsServiced = [...new Set(args.brandsServiced)].slice(0, 5);
    await ctx.db.patch("mechanicProfiles", profile._id, { ...patch, updatedAt: Date.now() });
    return null;
  },
});
