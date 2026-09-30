/**
 * Shared validators (docs/DATA-MODEL.md §C0). Imported by schema.ts and function args.
 */
import { v, type Infer } from "convex/values";

export const touchV = v.object({
  source: v.optional(v.string()),
  medium: v.optional(v.string()),
  campaign: v.optional(v.string()),
  term: v.optional(v.string()),
  content: v.optional(v.string()),
  gclid: v.optional(v.string()),
  gbraid: v.optional(v.string()),
  wbraid: v.optional(v.string()),
  fbclid: v.optional(v.string()),
  msclkid: v.optional(v.string()),
  referrer: v.optional(v.string()),
  landingPath: v.optional(v.string()),
  at: v.number(),
});

export const attributionV = v.object({
  first: v.optional(touchV),
  last: v.optional(touchV),
  fbp: v.optional(v.string()),
  fbc: v.optional(v.string()),
  gaClientId: v.optional(v.string()),
  consentAnalytics: v.boolean(),
  consentAds: v.boolean(),
});
export type Attribution = Infer<typeof attributionV>;

export const contactV = v.object({
  firstName: v.string(),
  lastName: v.string(),
  email: v.string(),
  phone: v.string(),
});
export type Contact = Infer<typeof contactV>;

export const addressV = v.object({
  street: v.string(),
  city: v.string(),
  postalCode: v.string(),
  note: v.optional(v.string()),
});
export type Address = Infer<typeof addressV>;

export const companyV = v.object({
  name: v.string(),
  pib: v.string(),
  mb: v.optional(v.string()),
  address: v.optional(addressV),
});
export type Company = Infer<typeof companyV>;

export const vehicleSnapshotV = v.object({
  brandId: v.optional(v.id("vehicleBrands")),
  modelId: v.optional(v.id("vehicleModels")),
  generationId: v.optional(v.id("vehicleGenerations")),
  engineId: v.optional(v.id("engines")),
  year: v.optional(v.number()),
  vin: v.optional(v.string()),
  label: v.string(),
});
export type VehicleSnapshot = Infer<typeof vehicleSnapshotV>;

export const consentV = v.object({
  termsVersion: v.string(),
  privacyVersion: v.string(),
  acceptedAt: v.number(),
  marketingEmail: v.boolean(),
  analytics: v.boolean(),
  ads: v.boolean(),
});
export type Consent = Infer<typeof consentV>;

export const actorTypeV = v.union(
  v.literal("customer"),
  v.literal("mechanic"),
  v.literal("staff"),
  v.literal("owner"),
  v.literal("system"),
);

export const actorV = v.object({
  type: actorTypeV,
  userId: v.optional(v.id("users")),
  name: v.optional(v.string()),
});
export type Actor = Infer<typeof actorV>;

export const qualityV = v.union(v.literal("original"), v.literal("oem"), v.literal("aftermarket"));
export type Quality = Infer<typeof qualityV>;

export const stockStateV = v.union(
  v.literal("in_stock"),
  v.literal("low_stock"),
  v.literal("out_of_stock"),
  v.literal("on_order"),
);

export const orderStatusV = v.union(
  v.literal("nova"),
  v.literal("potvrdjena"),
  v.literal("ceka_deo"),
  v.literal("spremna_za_preuzimanje"),
  v.literal("poslata"),
  v.literal("preuzeta"),
  v.literal("isporucena"),
  v.literal("zavrsena"),
  v.literal("otkazana"),
);

export const inquiryStatusV = v.union(
  v.literal("nov"),
  v.literal("u_obradi"),
  v.literal("ponuda_poslata"),
  v.literal("prihvacena"),
  v.literal("odbijena"),
  v.literal("istekla"),
);

export const quoteStatusV = v.union(
  v.literal("draft"),
  v.literal("sent"),
  v.literal("accepted"),
  v.literal("declined"),
  v.literal("expired"),
  v.literal("superseded"),
);

export const deliveryMethodV = v.union(v.literal("pickup"), v.literal("courier"));
export type DeliveryMethodCode = Infer<typeof deliveryMethodV>;

export const paymentMethodV = v.union(
  v.literal("cod"),
  v.literal("pickup_cash"),
  v.literal("pickup_card"),
  v.literal("bank_transfer"),
  v.literal("deferred"),
);
export type PaymentMethodCode = Infer<typeof paymentMethodV>;

export const roleV = v.union(v.literal("customer"), v.literal("staff"), v.literal("owner"));
export type Role = Infer<typeof roleV>;

export const mechanicStatusV = v.union(
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("suspended"),
);

export const userMechanicStatusV = v.union(
  v.literal("none"),
  v.literal("pending"),
  v.literal("approved"),
  v.literal("rejected"),
  v.literal("suspended"),
);

export const referenceSourceV = v.union(v.literal("seed"), v.literal("admin"), v.literal("import"));
export const productSourceV = v.union(v.literal("seed"), v.literal("import"), v.literal("manual"));

export const categoryRuleV = v.object({ categoryId: v.id("categories"), discountBp: v.number() });
export const manufacturerRuleV = v.object({
  manufacturerId: v.id("manufacturers"),
  discountBp: v.number(),
});

export const personalRulesV = v.object({
  defaultDiscountBp: v.optional(v.number()),
  categoryRules: v.optional(v.array(categoryRuleV)),
  manufacturerRules: v.optional(v.array(manufacturerRuleV)),
});

export const cartItemSourceV = v.union(
  v.literal("catalog"),
  v.literal("three_d"),
  v.literal("quick_order"),
  v.literal("reorder"),
  v.literal("quote"),
  v.literal("search"),
);

export const inquiryKindV = v.union(
  v.literal("vin"),
  v.literal("part"),
  v.literal("not_found"),
  v.literal("product_question"),
  v.literal("quick_order_missing"),
);

export const preferredChannelV = v.union(
  v.literal("phone"),
  v.literal("viber"),
  v.literal("whatsapp"),
  v.literal("email"),
);

export const serviceTypeV = v.union(
  v.literal("mehanika"),
  v.literal("elektrika"),
  v.literal("limarija"),
  v.literal("vulkanizer"),
  v.literal("dijagnostika"),
  v.literal("klima"),
  v.literal("ostalo"),
);

export const fuelV = v.union(
  v.literal("benzin"),
  v.literal("dizel"),
  v.literal("hibrid"),
  v.literal("elektro"),
  v.literal("cng"),
  v.literal("lpg"),
);

export const stockReasonV = v.union(
  v.literal("manual"),
  v.literal("order_confirmed"),
  v.literal("order_created"),
  v.literal("order_cancelled"),
  v.literal("order_edited"),
  v.literal("import"),
  v.literal("import_rollback"),
  v.literal("correction"),
  v.literal("receipt"),
  v.literal("return"),
);

export const uploadPurposeV = v.union(
  v.literal("inquiry_photo"),
  v.literal("product_image"),
  v.literal("import_file"),
  v.literal("category_image"),
  v.literal("content_image"),
);

// Domain events (docs/NOTIFICATIONS.md §I2) --------------------------------------------

export const eventTypeV = v.union(
  v.literal("order.created"),
  v.literal("order.status_changed"),
  v.literal("order.edited"),
  v.literal("inquiry.created"),
  v.literal("inquiry.status_changed"),
  v.literal("quote.sent"),
  v.literal("quote.accepted"),
  v.literal("quote.declined"),
  v.literal("quote.renewal_requested"),
  v.literal("quote.expired"),
  v.literal("mechanic.registered"),
  v.literal("mechanic.approved"),
  v.literal("mechanic.rejected"),
  v.literal("mechanic.suspended"),
  v.literal("mechanic.reopened"),
  v.literal("stock.low"),
  v.literal("stock.back_in_stock"),
  v.literal("product.changed"),
  v.literal("category.changed"),
  v.literal("settings.changed"),
  v.literal("content.changed"),
  v.literal("user.registered"),
  v.literal("import.completed"),
);
export type EventType = Infer<typeof eventTypeV>;

export const aggregateTypeV = v.union(
  v.literal("order"),
  v.literal("inquiry"),
  v.literal("quote"),
  v.literal("mechanic"),
  v.literal("product"),
  v.literal("category"),
  v.literal("settings"),
  v.literal("content"),
  v.literal("stock"),
  v.literal("import"),
  v.literal("user"),
  v.literal("system"),
);
export type AggregateType = Infer<typeof aggregateTypeV>;

/** Typed payloads, discriminated by `kind` (one shape per aggregate). */
export const orderEventPayloadV = v.object({
  kind: v.literal("order"),
  orderId: v.id("orders"),
  number: v.string(),
  totalPara: v.optional(v.number()),
  customerType: v.optional(
    v.union(v.literal("guest"), v.literal("customer"), v.literal("mechanic")),
  ),
  from: v.optional(orderStatusV),
  to: v.optional(orderStatusV),
  reason: v.optional(v.string()),
});

export const inquiryEventPayloadV = v.object({
  kind: v.literal("inquiry"),
  inquiryId: v.id("inquiries"),
  number: v.string(),
  quoteId: v.optional(v.id("quotes")),
  version: v.optional(v.number()),
  orderId: v.optional(v.id("orders")),
  from: v.optional(inquiryStatusV),
  to: v.optional(inquiryStatusV),
  reason: v.optional(v.string()),
});

export const mechanicEventPayloadV = v.object({
  kind: v.literal("mechanic"),
  profileId: v.id("mechanicProfiles"),
  userId: v.id("users"),
  companyName: v.string(),
  tierName: v.optional(v.string()),
  reason: v.optional(v.string()),
});

export const stockEventPayloadV = v.object({
  kind: v.literal("stock"),
  productId: v.id("products"),
  sku: v.string(),
  name: v.string(),
  qty: v.number(),
  threshold: v.optional(v.number()),
});

export const catalogEventPayloadV = v.object({
  kind: v.literal("catalog"),
  productId: v.optional(v.id("products")),
  categoryId: v.optional(v.id("categories")),
  slug: v.optional(v.string()),
  section: v.optional(v.string()),
  fields: v.optional(v.array(v.string())),
});

export const userEventPayloadV = v.object({
  kind: v.literal("user"),
  userId: v.id("users"),
});

export const importEventPayloadV = v.object({
  kind: v.literal("import"),
  batchId: v.id("importBatches"),
  fileName: v.string(),
  created: v.number(),
  updated: v.number(),
  failed: v.number(),
  deactivated: v.number(),
});

export const eventPayloadV = v.union(
  orderEventPayloadV,
  inquiryEventPayloadV,
  mechanicEventPayloadV,
  stockEventPayloadV,
  catalogEventPayloadV,
  userEventPayloadV,
  importEventPayloadV,
);
export type EventPayload = Infer<typeof eventPayloadV>;
