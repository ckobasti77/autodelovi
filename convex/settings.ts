/**
 * Settings: public projection (company, hours, delivery/payment labels, flags, brand),
 * tracking IDs, full staff view and owner-only section updates (audited).
 */
import { v } from "convex/values";

import { SETTINGS_SECTION_LABEL } from "../lib/i18n/sr/auditLabels";
import { audit, diffFields } from "./lib/audit";
import { actorOf } from "./lib/authz";
import { emitEvent } from "./lib/events";
import { ownerMutation, publicQuery, staffQuery } from "./lib/functions";
import { DEFAULT_SETTINGS, getSettings, getSettingsDoc } from "./lib/settings";
import {
  brandSettingsV,
  commerceSettingsV,
  companySettingsV,
  couriersSettingsV,
  deliveryMethodsSettingsV,
  emailSettingsV,
  flagsSettingsV,
  holidaysSettingsV,
  hoursSettingsV,
  legalVersionsSettingsV,
  notificationsSettingsV,
  paymentMethodsSettingsV,
  seoSettingsV,
  settingsV,
  trackingSettingsV,
  trustFactsSettingsV,
} from "./lib/settingsSchema";
import { invalid } from "./lib/errors";

export const getPublic = publicQuery({
  args: {},
  returns: v.object({
    company: companySettingsV,
    hours: hoursSettingsV,
    holidays: holidaysSettingsV,
    brand: brandSettingsV,
    trustFacts: trustFactsSettingsV,
    commerce: v.object({
      vatRateBp: v.number(),
      freeShippingOverPara: v.number(),
      quoteValidityDays: v.number(),
      shipCutoff: v.string(),
      etaText: v.string(),
    }),
    deliveryMethods: deliveryMethodsSettingsV,
    paymentMethods: paymentMethodsSettingsV,
    couriers: v.array(v.object({ code: v.string(), name: v.string() })),
    flags: flagsSettingsV,
    legalVersions: legalVersionsSettingsV,
    seo: v.object({ titleSuffix: v.string(), defaultDescription: v.string() }),
    updatedAt: v.number(),
  }),
  handler: async (ctx) => {
    const s = await getSettings(ctx);
    return {
      company: s.company,
      hours: s.hours,
      holidays: s.holidays,
      brand: s.brand,
      trustFacts: s.trustFacts,
      commerce: {
        vatRateBp: s.commerce.vatRateBp,
        freeShippingOverPara: s.commerce.freeShippingOverPara,
        quoteValidityDays: s.commerce.quoteValidityDays,
        shipCutoff: s.commerce.shipCutoff,
        etaText: s.commerce.etaText,
      },
      deliveryMethods: s.deliveryMethods.filter((d) => d.active),
      paymentMethods: s.paymentMethods.filter((p) => p.active),
      couriers: s.couriers.map((c) => ({ code: c.code, name: c.name })),
      flags: s.flags,
      legalVersions: s.legalVersions,
      seo: { titleSuffix: s.seo.titleSuffix, defaultDescription: s.seo.defaultDescription },
      updatedAt: s.updatedAt,
    };
  },
});

/** Tracking IDs only (all empty ⇒ every adapter is a no-op). */
export const getTracking = publicQuery({
  args: {},
  returns: trackingSettingsV,
  handler: async (ctx) => (await getSettings(ctx)).tracking,
});

export const getAdmin = staffQuery({
  args: {},
  returns: settingsV,
  handler: async (ctx) => await getSettings(ctx),
});

const sectionUpdateV = v.union(
  v.object({ section: v.literal("company"), value: companySettingsV }),
  v.object({ section: v.literal("hours"), value: hoursSettingsV }),
  v.object({ section: v.literal("holidays"), value: holidaysSettingsV }),
  v.object({ section: v.literal("brand"), value: brandSettingsV }),
  v.object({ section: v.literal("trustFacts"), value: trustFactsSettingsV }),
  v.object({ section: v.literal("commerce"), value: commerceSettingsV }),
  v.object({ section: v.literal("deliveryMethods"), value: deliveryMethodsSettingsV }),
  v.object({ section: v.literal("paymentMethods"), value: paymentMethodsSettingsV }),
  v.object({ section: v.literal("couriers"), value: couriersSettingsV }),
  v.object({ section: v.literal("notifications"), value: notificationsSettingsV }),
  v.object({ section: v.literal("email"), value: emailSettingsV }),
  v.object({ section: v.literal("seo"), value: seoSettingsV }),
  v.object({ section: v.literal("tracking"), value: trackingSettingsV }),
  v.object({ section: v.literal("flags"), value: flagsSettingsV }),
  v.object({ section: v.literal("legalVersions"), value: legalVersionsSettingsV }),
);

const ARRAY_LIMITS: Partial<Record<string, number>> = {
  hours: 7,
  holidays: 30,
  trustFacts: 6,
  deliveryMethods: 4,
  paymentMethods: 6,
  couriers: 6,
};

/** Owner: replaces one settings section (one section per call, audited). */
export const updateSection = ownerMutation({
  args: { update: sectionUpdateV },
  returns: v.null(),
  handler: async (ctx, { update }) => {
    const limit = ARRAY_LIMITS[update.section];
    if (limit !== undefined && Array.isArray(update.value) && update.value.length > limit) {
      invalid(`Najviše ${limit} stavki u ovom delu podešavanja.`, update.section);
    }
    if (update.section === "commerce") {
      const c = update.value;
      if (c.vatRateBp < 0 || c.vatRateBp > 5_000 || c.minMarginBp < 0 || c.lowStockDefault < 0) {
        invalid("Proverite vrednosti PDV-a, marže i praga zaliha.", "commerce");
      }
    }
    if (update.section === "brand" && !/^[A-Z]{1,4}$/.test(update.value.orderPrefix)) {
      invalid("Prefiks porudžbine: 1–4 velika slova.", "brand");
    }
    const doc = await getSettingsDoc(ctx);
    const current = doc ?? { ...DEFAULT_SETTINGS, updatedAt: 0 };
    const now = Date.now();
    const diff = diffFields(
      { [update.section]: current[update.section] },
      { [update.section]: update.value },
    );
    if (diff.length === 0) return null;
    if (doc) {
      await ctx.db.patch("settings", doc._id, {
        [update.section]: update.value,
        updatedAt: now,
        updatedBy: ctx.viewer.userId,
      });
    } else {
      await ctx.db.insert("settings", {
        ...DEFAULT_SETTINGS,
        [update.section]: update.value,
        updatedAt: now,
        updatedBy: ctx.viewer.userId,
      });
    }
    const actor = actorOf(ctx.viewer);
    await audit(ctx, {
      actor,
      action: "settings.update",
      entityType: "settings",
      entityId: update.section,
      summary: `Izmenjena podešavanja: ${SETTINGS_SECTION_LABEL[update.section] ?? update.section}`,
      diff,
    });
    await emitEvent(ctx, {
      type: "settings.changed",
      aggregateType: "settings",
      aggregateId: "global",
      payload: { kind: "catalog", section: update.section },
      dedupeKey: `settings.changed:${update.section}:${now}`,
      actor,
    });
    return null;
  },
});
