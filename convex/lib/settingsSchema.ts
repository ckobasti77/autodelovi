/**
 * Settings singleton validators (docs/DATA-MODEL.md §C2), one validator per section so
 * `settings.updateSection` can accept exactly one typed section per call.
 */
import { v, type Infer } from "convex/values";

import { deliveryMethodV, paymentMethodV } from "./validators";

export const companySettingsV = v.object({
  legalName: v.string(),
  displayName: v.optional(v.string()),
  pib: v.optional(v.string()),
  mb: v.optional(v.string()),
  address: v.object({ street: v.string(), city: v.string(), postalCode: v.string() }),
  phones: v.array(v.object({ label: v.string(), e164: v.string() })),
  viber: v.optional(v.string()),
  whatsapp: v.optional(v.string()),
  email: v.optional(v.string()),
  bankAccounts: v.array(v.object({ bank: v.string(), account: v.string() })),
  mapUrl: v.optional(v.string()),
  registryNote: v.optional(v.string()),
});

export const hoursSettingsV = v.array(
  v.object({ day: v.number(), open: v.string(), close: v.string(), closed: v.boolean() }),
);

export const holidaysSettingsV = v.array(v.object({ date: v.string(), note: v.string() }));

export const brandSettingsV = v.object({
  name: v.string(),
  tagline: v.string(),
  orderPrefix: v.string(),
  inquiryPrefix: v.string(),
});

export const trustFactsSettingsV = v.array(v.object({ label: v.string(), value: v.string() }));

export const commerceSettingsV = v.object({
  vatRateBp: v.number(),
  freeShippingOverPara: v.number(),
  lowStockDefault: v.number(),
  stockDecrementOn: v.union(v.literal("confirmed"), v.literal("created")),
  restockOnCancel: v.boolean(),
  quoteValidityDays: v.number(),
  minMarginBp: v.number(),
  autoCompleteDays: v.number(),
  shipCutoff: v.string(),
  etaText: v.string(),
});

export const deliveryMethodsSettingsV = v.array(
  v.object({
    code: deliveryMethodV,
    label: v.string(),
    description: v.string(),
    pricePara: v.number(),
    freeOverPara: v.optional(v.number()),
    active: v.boolean(),
    etaText: v.string(),
  }),
);

export const paymentMethodsSettingsV = v.array(
  v.object({
    code: paymentMethodV,
    label: v.string(),
    instructions: v.string(),
    active: v.boolean(),
    requires: v.union(v.literal("none"), v.literal("company"), v.literal("mechanic_credit")),
    deliveryCodes: v.array(deliveryMethodV),
  }),
);

export const couriersSettingsV = v.array(
  v.object({ code: v.string(), name: v.string(), trackingUrlTemplate: v.string() }),
);

export const notificationsSettingsV = v.object({
  staffEmails: v.array(v.string()),
  digestEnabled: v.boolean(),
  digestHour: v.number(),
  reminderAfterWorkingMinutes: v.number(),
  lowStockEmail: v.boolean(),
});

/**
 * E-mail delivery (step 18, owner). Optional so settings stored before step 18 validate;
 * missing ⇒ `EMAIL_MODE` from the deployment environment (default `log`).
 */
export const emailModeV = v.union(v.literal("log"), v.literal("test"), v.literal("live"));

export const emailSettingsV = v.object({
  mode: emailModeV,
  /** Sender display name; the address comes from `EMAIL_FROM` (verified domain). */
  fromName: v.optional(v.string()),
  /** Reply-To for customer e-mails; empty ⇒ company e-mail from settings. */
  replyTo: v.optional(v.string()),
});

export const seoSettingsV = v.object({
  titleSuffix: v.string(),
  defaultDescription: v.string(),
  ogImageStorageId: v.optional(v.id("_storage")),
  landingMin: v.object({ brand: v.number(), model: v.number(), generationPage: v.number() }),
  maxIndexableLandings: v.number(),
});

export const trackingSettingsV = v.object({
  ga4Id: v.optional(v.string()),
  gadsId: v.optional(v.string()),
  gadsLabels: v.object({
    purchase: v.optional(v.string()),
    lead: v.optional(v.string()),
    mechanicSignup: v.optional(v.string()),
  }),
  metaPixelId: v.optional(v.string()),
  metaCapiEnabled: v.boolean(),
  metaTestEventCode: v.optional(v.string()),
  gadsOfflineConversionName: v.optional(v.string()),
});

export const flagsSettingsV = v.object({
  publicPrices: v.boolean(),
  guestCheckout: v.boolean(),
  backInStock: v.boolean(),
  mechanicRegistration: v.boolean(),
  threeDHero: v.boolean(),
  quickOrder: v.boolean(),
  generationLandings: v.boolean(),
});

export const legalVersionsSettingsV = v.object({
  terms: v.string(),
  privacy: v.string(),
  cookies: v.string(),
});

export const settingsFields = {
  key: v.literal("global"),
  company: companySettingsV,
  hours: hoursSettingsV,
  holidays: holidaysSettingsV,
  brand: brandSettingsV,
  trustFacts: trustFactsSettingsV,
  commerce: commerceSettingsV,
  deliveryMethods: deliveryMethodsSettingsV,
  paymentMethods: paymentMethodsSettingsV,
  couriers: couriersSettingsV,
  notifications: notificationsSettingsV,
  email: v.optional(emailSettingsV),
  seo: seoSettingsV,
  tracking: trackingSettingsV,
  flags: flagsSettingsV,
  legalVersions: legalVersionsSettingsV,
  updatedAt: v.number(),
  updatedBy: v.optional(v.id("users")),
};

export const settingsV = v.object(settingsFields);
export type Settings = Infer<typeof settingsV>;

/** Section names editable through `settings.updateSection`. */
export type SettingsSection = Exclude<keyof Settings, "key" | "updatedAt" | "updatedBy">;
