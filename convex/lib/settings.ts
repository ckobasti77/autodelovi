/**
 * Settings singleton: defaults (docs/DATA-MODEL.md §C2, DECISIONS „chosen defaults“) and a
 * typed getter. Company data is empty by default — the UI hides empty parts (HUMAN-TODO).
 * Queries cannot insert, so `getSettings` falls back to the defaults until the seed runs.
 */
import type { QueryCtx } from "../_generated/server";
import { withoutSystemFields } from "./docs";
import { BRAND_ALTERNATE_NAME, BRAND_NAME, DEFAULT_TITLE_SUFFIX } from "../../lib/domain/brand";
import type { Settings } from "./settingsSchema";

export const DEFAULT_SETTINGS: Omit<Settings, "updatedAt"> = {
  key: "global",
  company: {
    legalName: "",
    address: { street: "", city: "", postalCode: "" },
    phones: [],
    bankAccounts: [],
  },
  hours: [
    { day: 1, open: "08:00", close: "17:00", closed: false },
    { day: 2, open: "08:00", close: "17:00", closed: false },
    { day: 3, open: "08:00", close: "17:00", closed: false },
    { day: 4, open: "08:00", close: "17:00", closed: false },
    { day: 5, open: "08:00", close: "17:00", closed: false },
    { day: 6, open: "08:00", close: "14:00", closed: false },
    { day: 0, open: "00:00", close: "00:00", closed: true },
  ],
  holidays: [],
  brand: {
    name: BRAND_NAME,
    alternateName: BRAND_ALTERNATE_NAME,
    tagline: "Rasklopi auto. Nađi deo.",
    orderPrefix: "SK",
    inquiryPrefix: "UP",
  },
  trustFacts: [],
  commerce: {
    vatRateBp: 2_000,
    freeShippingOverPara: 1_000_000,
    lowStockDefault: 3,
    stockDecrementOn: "confirmed",
    restockOnCancel: true,
    quoteValidityDays: 7,
    minMarginBp: 800,
    autoCompleteDays: 15,
    // Empty until the owner confirms an hour: the same-day dispatch sentence stays hidden.
    shipCutoff: "",
    etaText: "Isporuka za 1–2 radna dana",
  },
  deliveryMethods: [
    {
      code: "pickup",
      label: "Lično preuzimanje",
      description: "Deo preuzimate u radnji kada vam javimo da je spreman.",
      pricePara: 0,
      active: true,
      etaText: "Obično isti ili sledeći radni dan",
    },
    {
      code: "courier",
      label: "Kurirska služba",
      description: "Plaćanje pouzećem ili virmanom; kurir dostavlja na adresu.",
      pricePara: 45_000,
      freeOverPara: 1_000_000,
      active: true,
      etaText: "1–2 radna dana",
    },
  ],
  paymentMethods: [
    {
      code: "cod",
      label: "Pouzećem",
      instructions: "Plaćate kuriru gotovinom pri preuzimanju paketa.",
      active: true,
      requires: "none",
      deliveryCodes: ["courier"],
    },
    {
      code: "pickup_cash",
      label: "Gotovinom pri preuzimanju",
      instructions: "Plaćate u radnji kada preuzimate deo.",
      active: true,
      requires: "none",
      deliveryCodes: ["pickup"],
    },
    {
      code: "pickup_card",
      label: "Karticom pri preuzimanju",
      instructions: "Plaćate karticom u radnji kada preuzimate deo.",
      active: true,
      requires: "none",
      deliveryCodes: ["pickup"],
    },
    {
      code: "bank_transfer",
      label: "Virmanom uz predračun",
      instructions: "Šaljemo predračun; deo rezervišemo do uplate.",
      active: true,
      requires: "company",
      deliveryCodes: ["pickup", "courier"],
    },
    {
      code: "deferred",
      label: "Odloženo plaćanje",
      instructions: "Za majstore sa odobrenim odloženim plaćanjem, po dogovorenom roku.",
      active: true,
      requires: "mechanic_credit",
      deliveryCodes: ["pickup", "courier"],
    },
  ],
  // Tracking URL templates (`…{broj}…`) are confirmed by the owner (HUMAN-TODO §2).
  couriers: [
    { code: "dexpress", name: "D Express", trackingUrlTemplate: "" },
    { code: "bex", name: "BEX", trackingUrlTemplate: "" },
    { code: "aks", name: "AKS", trackingUrlTemplate: "" },
    { code: "postexpress", name: "Post Express", trackingUrlTemplate: "" },
  ],
  notifications: {
    staffEmails: [],
    digestEnabled: true,
    digestHour: 8,
    reminderAfterWorkingMinutes: 120,
    lowStockEmail: true,
  },
  seo: {
    titleSuffix: DEFAULT_TITLE_SUFFIX,
    defaultDescription:
      "Delovi za Volkswagen, Audi, Škoda, SEAT i Cupra: pretraga po OEM broju i vozilu, cene sa PDV-om, stanje i dostava.",
    landingMin: { brand: 8, model: 6, generationPage: 10 },
    maxIndexableLandings: 300,
  },
  tracking: {
    gadsLabels: {},
    metaCapiEnabled: false,
  },
  flags: {
    publicPrices: true,
    guestCheckout: true,
    backInStock: true,
    mechanicRegistration: true,
    threeDHero: true,
    quickOrder: true,
    generationLandings: false,
  },
  legalVersions: { terms: "2026-09-29", privacy: "2026-09-29", cookies: "2026-09-29" },
};

export async function getSettingsDoc(ctx: QueryCtx) {
  return await ctx.db
    .query("settings")
    .withIndex("by_key", (q) => q.eq("key", "global"))
    .unique();
}

/** Stored settings, or the defaults when the seed has not run yet. */
export async function getSettings(ctx: QueryCtx): Promise<Settings> {
  const doc = await getSettingsDoc(ctx);
  if (!doc) return { ...DEFAULT_SETTINGS, updatedAt: 0 };
  return withoutSystemFields(doc);
}
