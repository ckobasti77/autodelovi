/**
 * SKLOP database schema — mirrors docs/DATA-MODEL.md (§C1–§C11). Money is integer para
 * (1/100 RSD, incl. PDV unless the field name says Net); timestamps are ms since epoch.
 */
import { authTables } from "@convex-dev/auth/server";
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

import { importRowDataV } from "./lib/importValidators";
import { settingsFields } from "./lib/settingsSchema";
import {
  actorV,
  addressV,
  aggregateTypeV,
  attributionV,
  cartItemSourceV,
  categoryRuleV,
  companyV,
  consentV,
  contactV,
  deliveryMethodV,
  eventPayloadV,
  eventTypeV,
  fuelV,
  inquiryKindV,
  inquiryStatusV,
  manufacturerRuleV,
  mechanicStatusV,
  orderStatusV,
  paymentMethodV,
  personalRulesV,
  preferredChannelV,
  productSourceV,
  qualityV,
  quoteStatusV,
  referenceSourceV,
  roleV,
  serviceTypeV,
  stockReasonV,
  stockStateV,
  uploadPurposeV,
  userMechanicStatusV,
  vehicleSnapshotV,
} from "./lib/validators";

const orderCustomerTypeV = v.union(
  v.literal("guest"),
  v.literal("customer"),
  v.literal("mechanic"),
);

export default defineSchema({
  ...authTables,

  // §C1 Identity and access ------------------------------------------------------------
  users: defineTable({
    // Convex Auth fields
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // SKLOP fields (optional so Convex Auth inserts validate)
    role: v.optional(roleV),
    status: v.optional(v.union(v.literal("active"), v.literal("blocked"))),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    phoneE164: v.optional(v.string()),
    mechanicStatus: v.optional(userMechanicStatusV),
    mechanicProfileId: v.optional(v.id("mechanicProfiles")),
    marketingConsent: v.optional(v.boolean()),
    lastSeenAt: v.optional(v.number()),
    isDemo: v.optional(v.boolean()),
    isTest: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("phone", ["phone"])
    .index("by_role", ["role"])
    .index("by_mechanicStatus", ["mechanicStatus"])
    .index("by_isDemo", ["isDemo"]),

  staffInvites: defineTable({
    emailLower: v.string(),
    role: v.union(v.literal("staff"), v.literal("owner")),
    tokenHash: v.string(),
    expiresAt: v.number(),
    createdBy: v.id("users"),
    acceptedAt: v.optional(v.number()),
    acceptedBy: v.optional(v.id("users")),
    revokedAt: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_emailLower", ["emailLower"]),

  /** Staff notes on a customer account (append-only; step 15). */
  customerNotes: defineTable({
    userId: v.id("users"),
    message: v.string(),
    actor: actorV,
    at: v.number(),
  }).index("by_userId_and_at", ["userId", "at"]),

  // §C2 Settings and content -----------------------------------------------------------
  settings: defineTable(settingsFields).index("by_key", ["key"]),

  contentPages: defineTable({
    slug: v.string(),
    title: v.string(),
    bodyMd: v.string(),
    version: v.number(),
    published: v.boolean(),
    needsLegalReview: v.boolean(),
    updatedAt: v.number(),
    updatedBy: v.optional(v.id("users")),
  }).index("by_slug", ["slug"]),

  faqs: defineTable({
    scope: v.string(),
    question: v.string(),
    answerMd: v.string(),
    sortOrder: v.number(),
    active: v.boolean(),
  }).index("by_scope_and_sortOrder", ["scope", "sortOrder"]),

  counters: defineTable({ name: v.string(), value: v.number() }).index("by_name", ["name"]),

  redirects: defineTable({
    fromPath: v.string(),
    toPath: v.string(),
    kind: v.union(v.literal("product"), v.literal("category"), v.literal("manual")),
    hits: v.number(),
  }).index("by_fromPath", ["fromPath"]),

  adLandings: defineTable({
    slug: v.string(),
    title: v.string(),
    headline: v.string(),
    subhead: v.optional(v.string()),
    bodyMd: v.optional(v.string()),
    categoryId: v.optional(v.id("categories")),
    brandId: v.optional(v.id("vehicleBrands")),
    modelId: v.optional(v.id("vehicleModels")),
    generationId: v.optional(v.id("vehicleGenerations")),
    productIds: v.array(v.id("products")),
    indexable: v.boolean(),
    active: v.boolean(),
    updatedAt: v.number(),
  }).index("by_slug", ["slug"]),

  // §C3 Vehicles -----------------------------------------------------------------------
  vehicleBrands: defineTable({
    name: v.string(),
    slug: v.string(),
    aliases: v.array(v.string()),
    wmi: v.array(v.string()),
    sortOrder: v.number(),
    active: v.boolean(),
    source: referenceSourceV,
  })
    .index("by_slug", ["slug"])
    .index("by_sortOrder", ["sortOrder"]),

  vehicleModels: defineTable({
    brandId: v.id("vehicleBrands"),
    name: v.string(),
    slug: v.string(),
    aliases: v.array(v.string()),
    sortOrder: v.number(),
    active: v.boolean(),
    source: referenceSourceV,
  })
    .index("by_brandId_and_slug", ["brandId", "slug"])
    .index("by_brandId_and_sortOrder", ["brandId", "sortOrder"]),

  vehicleGenerations: defineTable({
    brandId: v.id("vehicleBrands"),
    modelId: v.id("vehicleModels"),
    name: v.string(),
    code: v.optional(v.string()),
    vinModelCodes: v.array(v.string()),
    slug: v.string(),
    aliases: v.array(v.string()),
    yearFrom: v.number(),
    yearTo: v.optional(v.number()),
    platform: v.optional(v.string()),
    sortOrder: v.number(),
    active: v.boolean(),
    source: referenceSourceV,
  })
    .index("by_modelId_and_slug", ["modelId", "slug"])
    .index("by_modelId_and_yearFrom", ["modelId", "yearFrom"])
    .index("by_slug", ["slug"]),

  engines: defineTable({
    name: v.string(),
    slug: v.string(),
    codes: v.array(v.string()),
    fuel: fuelV,
    displacementCc: v.optional(v.number()),
    powerKw: v.number(),
    powerHp: v.number(),
    source: referenceSourceV,
  }).index("by_slug", ["slug"]),

  generationEngines: defineTable({
    generationId: v.id("vehicleGenerations"),
    engineId: v.id("engines"),
    yearFrom: v.optional(v.number()),
    yearTo: v.optional(v.number()),
  })
    .index("by_generationId", ["generationId"])
    .index("by_engineId", ["engineId"])
    .index("by_generationId_and_engineId", ["generationId", "engineId"]),

  // §C4 Catalog ------------------------------------------------------------------------
  categories: defineTable({
    slug: v.string(),
    name: v.string(),
    kind: v.union(v.literal("system"), v.literal("category"), v.literal("subcategory")),
    parentId: v.optional(v.id("categories")),
    systemSlug: v.string(),
    partKey: v.optional(v.string()),
    relatedSlugs: v.array(v.string()),
    sortOrder: v.number(),
    active: v.boolean(),
    intro: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    thumbnailPath: v.optional(v.string()),
    thumbnailStorageId: v.optional(v.id("_storage")),
    googleCategoryId: v.optional(v.number()),
    productCount: v.number(),
    inStockCount: v.number(),
    updatedAt: v.number(),
    source: referenceSourceV,
  })
    .index("by_slug", ["slug"])
    .index("by_parentId_and_sortOrder", ["parentId", "sortOrder"])
    .index("by_kind_and_sortOrder", ["kind", "sortOrder"])
    .index("by_systemSlug_and_sortOrder", ["systemSlug", "sortOrder"]),

  manufacturers: defineTable({
    name: v.string(),
    slug: v.string(),
    aliases: v.array(v.string()),
    isVagGenuine: v.boolean(),
    defaultQuality: qualityV,
    country: v.optional(v.string()),
    description: v.optional(v.string()),
    active: v.boolean(),
    productCount: v.number(),
    source: referenceSourceV,
  })
    .index("by_slug", ["slug"])
    .index("by_name", ["name"]),

  products: defineTable({
    sku: v.string(),
    slug: v.string(),
    name: v.string(),
    categoryId: v.id("categories"),
    systemSlug: v.string(),
    manufacturerId: v.id("manufacturers"),
    manufacturerName: v.string(),
    quality: qualityV,
    mpn: v.optional(v.string()),
    oemPrimary: v.optional(v.string()),
    ean: v.optional(v.string()),
    retailPricePara: v.number(),
    stockQty: v.number(),
    stockState: stockStateV,
    lowStockThreshold: v.optional(v.number()),
    leadTimeDays: v.optional(v.number()),
    allowBackorder: v.boolean(),
    primaryImageId: v.optional(v.id("_storage")),
    imageCount: v.number(),
    universal: v.boolean(),
    fitmentCount: v.number(),
    fitmentSummary: v.optional(v.string()),
    searchText: v.string(),
    popularity: v.number(),
    active: v.boolean(),
    deletedAt: v.optional(v.number()),
    isDemo: v.boolean(),
    source: productSourceV,
    importBatchId: v.optional(v.id("importBatches")),
    lastImportBatchId: v.optional(v.id("importBatches")),
    updatedAt: v.number(),
    contentUpdatedAt: v.number(),
  })
    .index("by_sku", ["sku"])
    .index("by_slug", ["slug"])
    .index("by_categoryId_and_active_and_popularity", ["categoryId", "active", "popularity"])
    .index("by_categoryId_and_active_and_retailPricePara", [
      "categoryId",
      "active",
      "retailPricePara",
    ])
    .index("by_categoryId_and_active_and_updatedAt", ["categoryId", "active", "updatedAt"])
    .index("by_manufacturerId_and_active", ["manufacturerId", "active"])
    .index("by_active_and_contentUpdatedAt", ["active", "contentUpdatedAt"])
    .index("by_stockState_and_active", ["stockState", "active"])
    .index("by_importBatchId", ["importBatchId"])
    .index("by_isDemo", ["isDemo"])
    .index("by_categoryId_and_universal_and_active", ["categoryId", "universal", "active"])
    .searchIndex("search_products", {
      searchField: "searchText",
      filterFields: [
        "active",
        "categoryId",
        "systemSlug",
        "manufacturerId",
        "quality",
        "stockState",
      ],
    }),

  productContent: defineTable({
    productId: v.id("products"),
    description: v.optional(v.string()),
    specs: v.array(
      v.object({ label: v.string(), value: v.string(), unit: v.optional(v.string()) }),
    ),
    oemNumbers: v.array(
      v.object({ raw: v.string(), normalized: v.string(), brand: v.optional(v.string()) }),
    ),
    crossNumbers: v.array(
      v.object({ manufacturer: v.string(), raw: v.string(), normalized: v.string() }),
    ),
    images: v.array(
      v.object({
        storageId: v.id("_storage"),
        alt: v.string(),
        width: v.number(),
        height: v.number(),
        sourceUrl: v.optional(v.string()),
      }),
    ),
    notes: v.optional(v.string()),
    seoTitle: v.optional(v.string()),
    seoDescription: v.optional(v.string()),
    weightGrams: v.optional(v.number()),
    warrantyMonths: v.optional(v.number()),
    updatedAt: v.number(),
  }).index("by_productId", ["productId"]),

  productPrivate: defineTable({
    productId: v.id("products"),
    costNetPara: v.optional(v.number()),
    supplierName: v.optional(v.string()),
    supplierSku: v.optional(v.string()),
    internalNote: v.optional(v.string()),
    updatedAt: v.number(),
  }).index("by_productId", ["productId"]),

  productCodes: defineTable({
    code: v.string(),
    kind: v.union(
      v.literal("oem"),
      v.literal("cross"),
      v.literal("mpn"),
      v.literal("sku"),
      v.literal("ean"),
    ),
    productId: v.id("products"),
    raw: v.string(),
    label: v.optional(v.string()),
    active: v.boolean(),
    categoryId: v.id("categories"),
  })
    .index("by_code", ["code"])
    .index("by_productId", ["productId"]),

  fitments: defineTable({
    productId: v.id("products"),
    brandId: v.id("vehicleBrands"),
    modelId: v.id("vehicleModels"),
    generationId: v.id("vehicleGenerations"),
    engineId: v.optional(v.id("engines")),
    yearFrom: v.optional(v.number()),
    yearTo: v.optional(v.number()),
    note: v.optional(v.string()),
    categoryId: v.id("categories"),
    active: v.boolean(),
    manufacturerId: v.id("manufacturers"),
    quality: qualityV,
  })
    .index("by_productId", ["productId"])
    .index("by_generationId_and_categoryId_and_active", ["generationId", "categoryId", "active"])
    .index("by_modelId_and_categoryId_and_active", ["modelId", "categoryId", "active"])
    .index("by_brandId_and_categoryId_and_active", ["brandId", "categoryId", "active"])
    .index("by_engineId", ["engineId"]),

  // §C5 Pricing and B2B ----------------------------------------------------------------
  priceTiers: defineTable({
    name: v.string(),
    slug: v.string(),
    defaultDiscountBp: v.number(),
    categoryRules: v.array(categoryRuleV),
    manufacturerRules: v.array(manufacturerRuleV),
    minMarginBp: v.optional(v.number()),
    active: v.boolean(),
    sortOrder: v.number(),
    isDefault: v.boolean(),
    publicDescription: v.optional(v.string()),
  })
    .index("by_slug", ["slug"])
    .index("by_sortOrder", ["sortOrder"]),

  mechanicProfiles: defineTable({
    userId: v.id("users"),
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
    tierId: v.optional(v.id("priceTiers")),
    personalRules: v.optional(personalRulesV),
    creditEnabled: v.boolean(),
    creditLimitPara: v.optional(v.number()),
    paymentTermsDays: v.number(),
    internalNote: v.optional(v.string()),
    rejectionReason: v.optional(v.string()),
    reviewedAt: v.optional(v.number()),
    reviewedBy: v.optional(v.id("users")),
    attribution: v.optional(attributionV),
    consent: consentV,
    isDemo: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_userId", ["userId"])
    .index("by_status", ["status"])
    .index("by_pib", ["pib"])
    .index("by_isDemo", ["isDemo"]),

  savedVehicles: defineTable({
    userId: v.id("users"),
    label: v.optional(v.string()),
    brandId: v.optional(v.id("vehicleBrands")),
    modelId: v.optional(v.id("vehicleModels")),
    generationId: v.optional(v.id("vehicleGenerations")),
    engineId: v.optional(v.id("engines")),
    year: v.optional(v.number()),
    vin: v.optional(v.string()),
    plate: v.optional(v.string()),
    note: v.optional(v.string()),
  }).index("by_userId", ["userId"]),

  favorites: defineTable({
    userId: v.id("users"),
    productId: v.id("products"),
  }).index("by_userId_and_productId", ["userId", "productId"]),

  // §C6 Carts and orders ---------------------------------------------------------------
  carts: defineTable({
    ownerType: v.union(v.literal("user"), v.literal("guest")),
    userId: v.optional(v.id("users")),
    guestTokenHash: v.optional(v.string()),
    status: v.union(
      v.literal("active"),
      v.literal("merged"),
      v.literal("converted"),
      v.literal("abandoned"),
    ),
    updatedAt: v.number(),
    expiresAt: v.optional(v.number()),
    isDemo: v.optional(v.boolean()),
  })
    .index("by_userId_and_status", ["userId", "status"])
    .index("by_guestTokenHash", ["guestTokenHash"])
    .index("by_status_and_updatedAt", ["status", "updatedAt"])
    .index("by_isDemo", ["isDemo"]),

  cartItems: defineTable({
    cartId: v.id("carts"),
    productId: v.id("products"),
    quantity: v.number(),
    source: cartItemSourceV,
    addedAt: v.number(),
  })
    .index("by_cartId", ["cartId"])
    .index("by_cartId_and_productId", ["cartId", "productId"]),

  orders: defineTable({
    number: v.string(),
    year: v.number(),
    seq: v.number(),
    publicTokenHash: v.string(),
    status: orderStatusV,
    customerType: orderCustomerTypeV,
    userId: v.optional(v.id("users")),
    mechanicProfileId: v.optional(v.id("mechanicProfiles")),
    tierSnapshot: v.optional(v.object({ tierId: v.id("priceTiers"), name: v.string() })),
    contact: contactV,
    company: v.optional(companyV),
    delivery: v.object({
      method: deliveryMethodV,
      pricePara: v.number(),
      address: v.optional(addressV),
      courierCode: v.optional(v.string()),
      trackingNumber: v.optional(v.string()),
      trackingUrl: v.optional(v.string()),
    }),
    payment: v.object({
      method: paymentMethodV,
      status: v.union(v.literal("unpaid"), v.literal("paid"), v.literal("refunded")),
      paidAt: v.optional(v.number()),
      dueAt: v.optional(v.number()),
      reference: v.string(),
    }),
    totals: v.object({
      itemsRetailPara: v.number(),
      discountPara: v.number(),
      itemsPara: v.number(),
      deliveryPara: v.number(),
      totalPara: v.number(),
      vatPara: v.number(),
      currency: v.literal("RSD"),
    }),
    itemCount: v.number(),
    hasBackorder: v.boolean(),
    vehicle: v.optional(vehicleSnapshotV),
    customerNote: v.optional(v.string()),
    consent: consentV,
    attribution: v.optional(attributionV),
    source: v.union(
      v.literal("web"),
      v.literal("inquiry"),
      v.literal("admin"),
      v.literal("quick_order"),
      v.literal("reorder"),
    ),
    inquiryId: v.optional(v.id("inquiries")),
    quoteId: v.optional(v.id("quotes")),
    cancelReason: v.optional(v.string()),
    cancelledBy: v.optional(actorV),
    confirmedAt: v.optional(v.number()),
    readyAt: v.optional(v.number()),
    shippedAt: v.optional(v.number()),
    pickedUpAt: v.optional(v.number()),
    deliveredAt: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    cancelledAt: v.optional(v.number()),
    stockCommitted: v.boolean(),
    lastStaffActionAt: v.optional(v.number()),
    reminderLevel: v.number(),
    searchText: v.string(),
    isDemo: v.boolean(),
    isTest: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_number", ["number"])
    .index("by_publicTokenHash", ["publicTokenHash"])
    .index("by_status", ["status"])
    .index("by_userId", ["userId"])
    .index("by_mechanicProfileId", ["mechanicProfileId"])
    .index("by_contact_email", ["contact.email"])
    .index("by_inquiryId", ["inquiryId"])
    .index("by_isDemo", ["isDemo"])
    .index("by_updatedAt", ["updatedAt"])
    .searchIndex("search_orders", {
      searchField: "searchText",
      filterFields: ["status", "customerType"],
    }),

  orderItems: defineTable({
    orderId: v.id("orders"),
    productId: v.optional(v.id("products")),
    sku: v.string(),
    name: v.string(),
    manufacturerName: v.string(),
    quality: v.optional(qualityV),
    oem: v.optional(v.string()),
    quantity: v.number(),
    unitRetailPara: v.number(),
    unitPricePara: v.number(),
    discountBp: v.number(),
    lineTotalPara: v.number(),
    availabilityAtOrder: stockStateV,
    leadTimeDays: v.optional(v.number()),
    isCustomLine: v.boolean(),
    note: v.optional(v.string()),
    /** Units actually taken from stock when the order committed (restocked on cancel). */
    committedQty: v.optional(v.number()),
  })
    .index("by_orderId", ["orderId"])
    .index("by_productId", ["productId"]),

  orderEvents: defineTable({
    orderId: v.id("orders"),
    type: v.union(
      v.literal("created"),
      v.literal("status_changed"),
      v.literal("edited"),
      v.literal("note"),
      v.literal("tracking_set"),
      v.literal("payment_marked"),
      v.literal("email_sent"),
      v.literal("email_failed"),
      v.literal("reminder"),
    ),
    fromStatus: v.optional(orderStatusV),
    toStatus: v.optional(orderStatusV),
    message: v.optional(v.string()),
    visibleToCustomer: v.boolean(),
    actor: actorV,
    at: v.number(),
  }).index("by_orderId_and_at", ["orderId", "at"]),

  // §C7 Inquiries and quotes -----------------------------------------------------------
  inquiries: defineTable({
    number: v.string(),
    year: v.number(),
    seq: v.number(),
    publicTokenHash: v.string(),
    status: inquiryStatusV,
    kind: inquiryKindV,
    vin: v.optional(v.string()),
    vinInfo: v.optional(
      v.object({
        wmi: v.string(),
        brandGuess: v.optional(v.string()),
        modelYearHint: v.optional(v.number()),
        modelCode: v.optional(v.string()),
      }),
    ),
    vehicle: v.optional(vehicleSnapshotV),
    message: v.string(),
    categorySlugs: v.array(v.string()),
    productId: v.optional(v.id("products")),
    searchQuery: v.optional(v.string()),
    requestedCodes: v.array(v.string()),
    photos: v.array(v.id("_storage")),
    contact: v.object({
      name: v.string(),
      email: v.optional(v.string()),
      phone: v.optional(v.string()),
      preferredChannel: preferredChannelV,
    }),
    userId: v.optional(v.id("users")),
    mechanicProfileId: v.optional(v.id("mechanicProfiles")),
    assignedTo: v.optional(v.id("users")),
    attribution: v.optional(attributionV),
    consent: consentV,
    orderId: v.optional(v.id("orders")),
    currentQuoteId: v.optional(v.id("quotes")),
    firstResponseAt: v.optional(v.number()),
    closedReason: v.optional(v.string()),
    lastStaffActionAt: v.optional(v.number()),
    reminderLevel: v.number(),
    searchText: v.string(),
    isDemo: v.boolean(),
    isTest: v.optional(v.boolean()),
    updatedAt: v.number(),
  })
    .index("by_number", ["number"])
    .index("by_publicTokenHash", ["publicTokenHash"])
    .index("by_status", ["status"])
    .index("by_userId", ["userId"])
    .index("by_vin", ["vin"])
    .index("by_assignedTo_and_status", ["assignedTo", "status"])
    .index("by_isDemo", ["isDemo"])
    .searchIndex("search_inquiries", {
      searchField: "searchText",
      filterFields: ["status", "kind"],
    }),

  inquiryEvents: defineTable({
    inquiryId: v.id("inquiries"),
    type: v.union(
      v.literal("created"),
      v.literal("status_changed"),
      v.literal("assigned"),
      v.literal("quote_sent"),
      v.literal("quote_accepted"),
      v.literal("quote_declined"),
      v.literal("renewal_requested"),
      v.literal("note"),
      v.literal("email_sent"),
    ),
    fromStatus: v.optional(inquiryStatusV),
    toStatus: v.optional(inquiryStatusV),
    message: v.optional(v.string()),
    visibleToCustomer: v.boolean(),
    actor: actorV,
    at: v.number(),
  }).index("by_inquiryId_and_at", ["inquiryId", "at"]),

  quotes: defineTable({
    inquiryId: v.id("inquiries"),
    version: v.number(),
    status: quoteStatusV,
    validUntil: v.number(),
    lines: v.array(
      v.object({
        productId: v.optional(v.id("products")),
        sku: v.optional(v.string()),
        name: v.string(),
        manufacturer: v.optional(v.string()),
        quality: v.optional(qualityV),
        quantity: v.number(),
        unitPricePara: v.number(),
        availability: v.union(v.literal("in_stock"), v.literal("on_order")),
        leadTimeDays: v.optional(v.number()),
        note: v.optional(v.string()),
      }),
    ),
    deliveryNote: v.optional(v.string()),
    totalPara: v.number(),
    sentAt: v.optional(v.number()),
    sentBy: v.optional(v.id("users")),
    acceptedAt: v.optional(v.number()),
    declinedAt: v.optional(v.number()),
    declineReason: v.optional(v.string()),
    orderId: v.optional(v.id("orders")),
    isDemo: v.optional(v.boolean()),
  })
    .index("by_inquiryId_and_version", ["inquiryId", "version"])
    .index("by_status_and_validUntil", ["status", "validUntil"]),

  // §C8 Stock, subscriptions, search ---------------------------------------------------
  stockMovements: defineTable({
    productId: v.id("products"),
    delta: v.number(),
    qtyBefore: v.number(),
    qtyAfter: v.number(),
    reason: stockReasonV,
    refType: v.optional(v.union(v.literal("order"), v.literal("import"), v.literal("manual"))),
    refId: v.optional(v.string()),
    actor: actorV,
    note: v.optional(v.string()),
    importBatchId: v.optional(v.id("importBatches")),
    at: v.number(),
  })
    .index("by_productId_and_at", ["productId", "at"])
    .index("by_at", ["at"])
    .index("by_importBatchId", ["importBatchId"]),

  priceChanges: defineTable({
    productId: v.id("products"),
    oldRetailPara: v.number(),
    newRetailPara: v.number(),
    oldCostNetPara: v.optional(v.number()),
    newCostNetPara: v.optional(v.number()),
    reason: v.union(
      v.literal("manual"),
      v.literal("import"),
      v.literal("import_rollback"),
      v.literal("bulk"),
    ),
    actor: actorV,
    importBatchId: v.optional(v.id("importBatches")),
    at: v.number(),
  })
    .index("by_productId_and_at", ["productId", "at"])
    .index("by_at", ["at"]),

  backInStockSubscriptions: defineTable({
    productId: v.id("products"),
    email: v.string(),
    userId: v.optional(v.id("users")),
    status: v.union(v.literal("active"), v.literal("notified"), v.literal("cancelled")),
    unsubscribeTokenHash: v.string(),
    consentAt: v.number(),
    notifiedAt: v.optional(v.number()),
    isDemo: v.optional(v.boolean()),
  })
    .index("by_productId_and_status", ["productId", "status"])
    .index("by_email", ["email"])
    .index("by_unsubscribeTokenHash", ["unsubscribeTokenHash"])
    .index("by_isDemo", ["isDemo"]),

  searchLogs: defineTable({
    query: v.string(),
    normalized: v.string(),
    kind: v.union(v.literal("code"), v.literal("text"), v.literal("mixed")),
    resultsCount: v.number(),
    exactCodeHit: v.boolean(),
    userType: v.union(
      v.literal("anon"),
      v.literal("customer"),
      v.literal("mechanic"),
      v.literal("staff"),
    ),
    generationId: v.optional(v.id("vehicleGenerations")),
    source: v.union(
      v.literal("header"),
      v.literal("search_page"),
      v.literal("quick_order"),
      v.literal("three_d"),
      v.literal("landing"),
    ),
    sessionHash: v.optional(v.string()),
    at: v.number(),
  })
    .index("by_at", ["at"])
    .index("by_normalized_and_at", ["normalized", "at"]),

  searchDaily: defineTable({
    day: v.string(),
    normalized: v.string(),
    sample: v.string(),
    count: v.number(),
    zeroCount: v.number(),
    lastAt: v.number(),
  })
    .index("by_day_and_normalized", ["day", "normalized"])
    .index("by_normalized_and_day", ["normalized", "day"]),

  // §C9 Events, notifications, e-mail --------------------------------------------------
  domainEvents: defineTable({
    type: eventTypeV,
    aggregateType: aggregateTypeV,
    aggregateId: v.string(),
    payload: eventPayloadV,
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("dead"),
    ),
    attempts: v.number(),
    nextAttemptAt: v.number(),
    lastError: v.optional(v.string()),
    dedupeKey: v.string(),
    actor: v.optional(actorV),
    capiContext: v.optional(
      v.object({ ip: v.string(), userAgent: v.string(), eventSourceUrl: v.string() }),
    ),
    processedAt: v.optional(v.number()),
  })
    .index("by_status_and_nextAttemptAt", ["status", "nextAttemptAt"])
    .index("by_dedupeKey", ["dedupeKey"])
    .index("by_aggregateType_and_aggregateId", ["aggregateType", "aggregateId"]),

  notifications: defineTable({
    userId: v.id("users"),
    kind: v.string(),
    title: v.string(),
    body: v.string(),
    href: v.string(),
    eventId: v.optional(v.id("domainEvents")),
    read: v.boolean(),
    readAt: v.optional(v.number()),
    isDemo: v.optional(v.boolean()),
  })
    .index("by_userId_and_read", ["userId", "read"])
    .index("by_userId", ["userId"])
    .index("by_isDemo", ["isDemo"]),

  notificationDeliveries: defineTable({
    eventId: v.id("domainEvents"),
    channel: v.union(
      v.literal("email"),
      v.literal("inapp"),
      v.literal("meta_capi"),
      v.literal("revalidate"),
    ),
    recipient: v.string(),
    templateKey: v.optional(v.string()),
    status: v.union(
      v.literal("pending"),
      v.literal("sent"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    attempts: v.number(),
    lastError: v.optional(v.string()),
    providerRef: v.optional(v.string()),
    sentAt: v.optional(v.number()),
  })
    .index("by_eventId_and_channel_and_recipient", ["eventId", "channel", "recipient"])
    .index("by_status", ["status"]),

  staffPreferences: defineTable({
    userId: v.id("users"),
    email: v.object({
      orderNew: v.boolean(),
      inquiryNew: v.boolean(),
      mechanicNew: v.boolean(),
      lowStock: v.boolean(),
      reminders: v.boolean(),
      digest: v.boolean(),
    }),
    inApp: v.object({
      orderNew: v.boolean(),
      inquiryNew: v.boolean(),
      mechanicNew: v.boolean(),
      lowStock: v.boolean(),
      reminders: v.boolean(),
    }),
    updatedAt: v.number(),
  }).index("by_userId", ["userId"]),

  emailLog: defineTable({
    to: v.array(v.string()),
    subject: v.string(),
    templateKey: v.string(),
    html: v.optional(v.string()),
    text: v.string(),
    preheader: v.optional(v.string()),
    mode: v.union(v.literal("log"), v.literal("test"), v.literal("live")),
    status: v.union(
      v.literal("logged"),
      v.literal("queued"),
      v.literal("sent"),
      v.literal("delivered"),
      v.literal("delivery_delayed"),
      v.literal("bounced"),
      v.literal("complained"),
      v.literal("failed"),
      v.literal("opened"),
      v.literal("clicked"),
    ),
    resendEmailId: v.optional(v.string()),
    error: v.optional(v.string()),
    eventId: v.optional(v.id("domainEvents")),
    relatedType: v.optional(
      v.union(
        v.literal("order"),
        v.literal("inquiry"),
        v.literal("mechanic"),
        v.literal("user"),
        v.literal("product"),
        v.literal("digest"),
        v.literal("test"),
        v.literal("auth"),
      ),
    ),
    relatedId: v.optional(v.string()),
    updatedAt: v.number(),
  })
    .index("by_status", ["status"])
    .index("by_relatedType_and_relatedId", ["relatedType", "relatedId"])
    .index("by_resendEmailId", ["resendEmailId"]),

  // §C10 Import ------------------------------------------------------------------------
  importBatches: defineTable({
    fileName: v.string(),
    fileSize: v.number(),
    fileSha256: v.optional(v.string()),
    sourceFileId: v.optional(v.id("_storage")),
    format: v.union(v.literal("xlsx"), v.literal("xls"), v.literal("csv")),
    encoding: v.optional(v.union(v.literal("utf-8"), v.literal("windows-1250"))),
    delimiter: v.optional(v.string()),
    sheetName: v.optional(v.string()),
    headerRow: v.number(),
    numberFormat: v.union(v.literal("sr"), v.literal("en")),
    mode: v.union(v.literal("full"), v.literal("stock_price")),
    deactivateMissing: v.boolean(),
    mapping: v.array(v.object({ column: v.number(), header: v.string(), field: v.string() })),
    presetId: v.optional(v.id("importMappingPresets")),
    status: v.union(
      v.literal("staging"),
      v.literal("validated"),
      v.literal("committing"),
      v.literal("committed"),
      v.literal("failed"),
      v.literal("rolling_back"),
      v.literal("rolled_back"),
      v.literal("cancelled"),
    ),
    counts: v.object({
      total: v.number(),
      create: v.number(),
      update: v.number(),
      unchanged: v.number(),
      skip: v.number(),
      error: v.number(),
      warning: v.number(),
      committed: v.number(),
      failed: v.number(),
      deactivated: v.number(),
      created: v.optional(v.number()),
      updated: v.optional(v.number()),
      rollbackSkipped: v.optional(v.number()),
    }),
    progress: v.object({
      stagedRows: v.number(),
      committedRows: v.number(),
      rolledBackRows: v.number(),
    }),
    createdBy: v.id("users"),
    validatedAt: v.optional(v.number()),
    committedAt: v.optional(v.number()),
    rolledBackAt: v.optional(v.number()),
    rolledBackBy: v.optional(v.id("users")),
    cursor: v.optional(v.string()),
    note: v.optional(v.string()),
    // Step 16 (docs/IMPORT.md §K4): who started it, value maps from the wizard, commit phase,
    // deactivate-missing count, image progress and the failure reason.
    actor: v.optional(actorV),
    rollbackActor: v.optional(actorV),
    warnAmbiguous: v.optional(v.boolean()),
    valueMaps: v.optional(
      v.object({
        category: v.record(v.string(), v.id("categories")),
        manufacturer: v.record(v.string(), v.union(v.id("manufacturers"), v.literal("new"))),
      }),
    ),
    phase: v.optional(
      v.union(v.literal("rows"), v.literal("deactivate"), v.literal("finalize"), v.literal("done")),
    ),
    missing: v.optional(
      v.object({
        scanned: v.number(),
        count: v.number(),
        done: v.boolean(),
        cursor: v.optional(v.string()),
      }),
    ),
    images: v.optional(v.object({ total: v.number(), done: v.number(), failed: v.number() })),
    failureReason: v.optional(v.string()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_createdBy", ["createdBy"]),

  importRows: defineTable({
    batchId: v.id("importBatches"),
    rowNumber: v.number(),
    sku: v.optional(v.string()),
    // Normalised fields present in the file (lib/import/row.ts); empty cells are absent.
    data: importRowDataV,
    /** Original mapped cells, kept for rows with errors or warnings (error report). */
    raw: v.optional(v.record(v.string(), v.union(v.string(), v.number(), v.boolean(), v.null()))),
    action: v.union(
      v.literal("create"),
      v.literal("update"),
      v.literal("unchanged"),
      v.literal("skip"),
      v.literal("error"),
    ),
    errors: v.array(
      v.object({ code: v.string(), field: v.optional(v.string()), message: v.string() }),
    ),
    warnings: v.array(
      v.object({ code: v.string(), field: v.optional(v.string()), message: v.string() }),
    ),
    productId: v.optional(v.id("products")),
    matchKey: v.optional(v.union(v.literal("sku"), v.literal("oem_manufacturer"))),
    changedFields: v.array(v.string()),
    committed: v.boolean(),
    commitError: v.optional(v.string()),
  })
    .index("by_batchId_and_rowNumber", ["batchId", "rowNumber"])
    .index("by_batchId_and_action", ["batchId", "action"])
    .index("by_batchId_and_sku", ["batchId", "sku"])
    .index("by_batchId_and_productId", ["batchId", "productId"]),

  importChanges: defineTable({
    batchId: v.id("importBatches"),
    productId: v.id("products"),
    action: v.union(v.literal("create"), v.literal("update"), v.literal("deactivate")),
    // Changed-field snapshots of arbitrary product fields (step 16 owns the shape).
    before: v.optional(v.record(v.string(), v.any())),
    after: v.record(v.string(), v.any()),
    rowNumber: v.optional(v.number()),
    productUpdatedAtAfter: v.number(),
    rolledBack: v.boolean(),
    rollbackSkippedReason: v.optional(v.string()),
  })
    .index("by_batchId", ["batchId"])
    .index("by_productId", ["productId"]),

  importMappingPresets: defineTable({
    name: v.string(),
    mapping: v.array(v.object({ headerNormalized: v.string(), field: v.string() })),
    createdBy: v.id("users"),
    isDefault: v.boolean(),
    updatedAt: v.number(),
  }).index("by_name", ["name"]),

  imageFetchJobs: defineTable({
    batchId: v.optional(v.id("importBatches")),
    productId: v.id("products"),
    url: v.string(),
    status: v.union(
      v.literal("pending"),
      v.literal("done"),
      v.literal("failed"),
      v.literal("skipped"),
    ),
    attempts: v.number(),
    error: v.optional(v.string()),
    storageId: v.optional(v.id("_storage")),
    position: v.optional(v.number()),
    updatedAt: v.optional(v.number()),
  })
    .index("by_status", ["status"])
    .index("by_batchId", ["batchId"])
    .index("by_batchId_and_status", ["batchId", "status"])
    .index("by_batchId_and_productId", ["batchId", "productId"]),

  // §C11 Records, files, analytics -----------------------------------------------------
  auditLog: defineTable({
    actor: actorV,
    action: v.string(),
    entityType: v.string(),
    entityId: v.string(),
    summary: v.string(),
    diff: v.optional(
      v.array(
        v.object({
          field: v.string(),
          before: v.optional(v.string()),
          after: v.optional(v.string()),
        }),
      ),
    ),
    at: v.number(),
  })
    .index("by_entityType_and_entityId_and_at", ["entityType", "entityId", "at"])
    .index("by_actor_userId_and_at", ["actor.userId", "at"])
    .index("by_at", ["at"])
    .index("by_action_and_at", ["action", "at"]),

  uploads: defineTable({
    storageId: v.id("_storage"),
    purpose: uploadPurposeV,
    uploaderKey: v.string(),
    status: v.union(v.literal("pending"), v.literal("attached"), v.literal("rejected")),
    contentType: v.optional(v.string()),
    size: v.optional(v.number()),
    attachedTo: v.optional(v.object({ type: v.string(), id: v.string() })),
    checkedAt: v.optional(v.number()),
    rejectReason: v.optional(v.string()),
  })
    .index("by_storageId", ["storageId"])
    .index("by_status", ["status"]),

  consentRecords: defineTable({
    consentId: v.string(),
    choices: v.object({ analytics: v.boolean(), ads: v.boolean() }),
    policyVersion: v.string(),
    at: v.number(),
    uaHash: v.optional(v.string()),
    userId: v.optional(v.id("users")),
  }).index("by_consentId", ["consentId"]),

  landingStats: defineTable({
    categoryId: v.id("categories"),
    brandId: v.id("vehicleBrands"),
    modelId: v.optional(v.id("vehicleModels")),
    productCount: v.number(),
    inStockCount: v.number(),
    minPricePara: v.number(),
    maxPricePara: v.number(),
    manufacturerCount: v.number(),
    generationIds: v.array(v.id("vehicleGenerations")),
    indexable: v.boolean(),
    reason: v.optional(v.string()),
    dirty: v.boolean(),
    updatedAt: v.number(),
  })
    .index("by_categoryId_and_brandId_and_modelId", ["categoryId", "brandId", "modelId"])
    .index("by_indexable", ["indexable"])
    .index("by_dirty", ["dirty"]),

  statsDaily: defineTable({
    day: v.string(),
    ordersCount: v.number(),
    ordersValuePara: v.number(),
    cancelledCount: v.number(),
    inquiriesCount: v.number(),
    registrationsCount: v.number(),
    zeroSearches: v.number(),
    byCategory: v.record(v.string(), v.object({ count: v.number(), valuePara: v.number() })),
  }).index("by_day", ["day"]),

  cronRuns: defineTable({
    job: v.string(),
    localKey: v.string(),
    ranAt: v.number(),
  }).index("by_job_and_localKey", ["job", "localKey"]),
});
