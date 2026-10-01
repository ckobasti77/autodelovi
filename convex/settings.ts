/**
 * Settings: public projection (company, hours, delivery/payment labels, flags, brand),
 * tracking IDs, full staff view and owner-only section updates (audited).
 */
import { v, type Infer } from "convex/values";

import { isValidBankAccount } from "../lib/domain/company";
import { isValidMb, isValidPib, normalizeMb, normalizePib } from "../lib/domain/identifiers";
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
  type Settings,
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
    seo: v.object({
      titleSuffix: v.string(),
      defaultDescription: v.string(),
      generationPageMin: v.number(),
      curatedSearches: v.array(v.string()),
    }),
    /** Browser tag ids (public by nature — they appear in the page source). */
    tracking: v.object({
      ga4Id: v.union(v.string(), v.null()),
      gadsId: v.union(v.string(), v.null()),
      gadsLabels: v.object({
        purchase: v.union(v.string(), v.null()),
        lead: v.union(v.string(), v.null()),
        mechanicSignup: v.union(v.string(), v.null()),
      }),
      metaPixelId: v.union(v.string(), v.null()),
    }),
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
      seo: {
        titleSuffix: s.seo.titleSuffix,
        defaultDescription: s.seo.defaultDescription,
        generationPageMin: s.seo.landingMin.generationPage,
        curatedSearches: s.seo.curatedSearches ?? [],
      },
      tracking: publicTracking(s.tracking),
      updatedAt: s.updatedAt,
    };
  },
});

const id = (value: string | undefined) => (value?.trim() ? value.trim() : null);

/** Tag ids for the browser loaders; empty ⇒ nothing loads. */
function publicTracking(t: Settings["tracking"]) {
  return {
    ga4Id: id(t.ga4Id),
    gadsId: id(t.gadsId),
    gadsLabels: {
      purchase: id(t.gadsLabels.purchase),
      lead: id(t.gadsLabels.lead),
      mechanicSignup: id(t.gadsLabels.mechanicSignup),
    },
    metaPixelId: id(t.metaPixelId),
  };
}

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
/**
 * Company identifiers print on every predračun and otpremnica, so they are checked like a
 * customer's (QA FLOW-15): PIB with its check digit, an 8-digit MB, and bank accounts as
 * 18 digits with the MOD 97 control pair. Empty optional fields stay empty.
 */
function checkedCompany(c: Infer<typeof companySettingsV>): Infer<typeof companySettingsV> {
  const pib = c.pib?.trim() ? normalizePib(c.pib) : undefined;
  if (pib !== undefined && !isValidPib(pib))
    invalid("PIB nije ispravan (9 cifara, kontrolni broj).", "company.pib");
  const mb = c.mb?.trim() ? normalizeMb(c.mb) : undefined;
  if (mb !== undefined && !isValidMb(mb))
    invalid("Matični broj nije ispravan (8 cifara, kontrolni broj).", "company.mb");
  c.bankAccounts.forEach((a, i) => {
    if (!isValidBankAccount(a.account))
      invalid(
        `Račun ${i + 1} nije ispravan: 18 cifara (npr. 160-0000000123456-78), kontrolni broj po modulu 97.`,
        `company.bankAccounts.${i}`,
      );
  });
  const out: Infer<typeof companySettingsV> = { ...c };
  if (pib) out.pib = pib;
  else delete out.pib;
  if (mb) out.mb = mb;
  else delete out.mb;
  return out;
}

export const updateSection = ownerMutation({
  args: { update: sectionUpdateV },
  returns: v.null(),
  handler: async (ctx, args) => {
    let update = args.update;
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
    if (update.section === "company") update = { ...update, value: checkedCompany(update.value) };
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
