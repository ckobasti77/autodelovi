/**
 * Sample template data for the admin gallery, test sends and snapshot tests. Fixed dates
 * keep snapshots stable; company data is never here (it comes from settings via the context).
 */
import type {
  BackInStockEmailData,
  EmailLine,
  InquiryEmailData,
  MechanicEmailData,
  OrderEmailData,
  PasswordResetEmailData,
  StaffDigestEmailData,
  StaffInquiryEmailData,
  StaffInviteEmailData,
  StaffLowStockEmailData,
  StaffMechanicEmailData,
  StaffOrderEmailData,
  StaffQuoteEmailData,
  StaffReminderEmailData,
} from "./types";

/** 29.09.2026. 10:42 in Belgrade. */
const AT = Date.UTC(2026, 8, 29, 8, 42);
const DAY = 86_400_000;
const TOKEN = "primer-tokena-za-pregled-sablona";

const LINES: EmailLine[] = [
  {
    name: "Set zupčastog kaiša sa vodenom pumpom",
    sku: "04L198119A",
    manufacturer: "INA",
    quantity: 1,
    unitPricePara: 1_899_000,
    lineTotalPara: 1_899_000,
  },
  {
    name: "Kočioni disk prednji, 312 mm",
    sku: "5Q0615301F",
    manufacturer: "ATE",
    quantity: 2,
    unitPricePara: 649_000,
    lineTotalPara: 1_298_000,
  },
  {
    name: "Filter ulja",
    sku: "03N115562B",
    manufacturer: "MANN-FILTER",
    quantity: 1,
    unitPricePara: 129_000,
    lineTotalPara: 129_000,
  },
];

function order(siteUrl: string, patch: Partial<OrderEmailData> = {}): OrderEmailData {
  const itemsPara = LINES.reduce((s, l) => s + l.lineTotalPara, 0);
  const deliveryPara = 0;
  const totalPara = itemsPara + deliveryPara;
  return {
    number: "SK-2026-000187",
    statusUrl: `${siteUrl}/porudzbina/${TOKEN}`,
    status: "nova",
    createdAt: AT,
    firstName: "Petar",
    customerType: "guest",
    lines: LINES,
    moreLines: 0,
    totals: {
      itemsRetailPara: itemsPara,
      discountPara: 0,
      itemsPara,
      deliveryPara,
      totalPara,
      vatPara: Math.round((totalPara * 2000) / 12000),
    },
    delivery: {
      method: "courier",
      label: "Kurirska služba",
      address: "Bulevar oslobođenja 12, 21000 Novi Sad",
    },
    payment: {
      method: "cod",
      label: "Pouzećem",
      instructions: "Plaćate kuriru gotovinom pri preuzimanju paketa.",
      reference: "97 2026000187",
    },
    hasBackorder: false,
    complaintsUrl: `${siteUrl}/reklamacije-i-povrat`,
    termsUrl: `${siteUrl}/uslovi-koriscenja`,
    ...patch,
  };
}

function inquiry(siteUrl: string, withQuote: boolean): InquiryEmailData {
  return {
    number: "UP-2026-000045",
    statusUrl: `${siteUrl}/upit/${TOKEN}`,
    name: "Marko Jovanović",
    createdAt: AT,
    vehicleLabel: "Volkswagen Golf VII 2.0 TDI (2015)",
    vin: "WVWZZZAUZFW123456",
    messageExcerpt: "Treba mi turbina, stara duva ulje. Motor CRLB.",
    requestedCodes: ["04L253016H"],
    photoCount: 2,
    preferredChannel: "viber",
    ...(withQuote
      ? {
          quote: {
            version: 1,
            validUntil: AT + 7 * DAY,
            lines: [
              {
                name: "Turbopunjač, reparirani",
                sku: "04L253016H",
                manufacturer: "Garrett",
                quantity: 1,
                unitPricePara: 8_990_000,
                lineTotalPara: 8_990_000,
                availabilityNote: "Po porudžbini, 2–3 radna dana",
              },
              {
                name: "Set dihtunga za turbinu",
                sku: "03L198015A",
                manufacturer: "Elring",
                quantity: 1,
                unitPricePara: 490_000,
                lineTotalPara: 490_000,
              },
            ],
            totalPara: 9_480_000,
            deliveryNote: "Staru turbinu vratite pri preuzimanju — kaucija se ne naplaćuje.",
          },
        }
      : {}),
  };
}

function mechanic(siteUrl: string, patch: Partial<MechanicEmailData> = {}): MechanicEmailData {
  return {
    companyName: "Auto servis Primer",
    contactPerson: "Nikola Petrović",
    email: "servis@primer.rs",
    portalUrl: `${siteUrl}/majstor`,
    loginUrl: `${siteUrl}/prijava`,
    registrationUrl: `${siteUrl}/za-majstore/registracija`,
    ...patch,
  };
}

export const SAMPLES = {
  orderCourierCod: (siteUrl: string): OrderEmailData => order(siteUrl),
  orderBankTransfer: (siteUrl: string): OrderEmailData =>
    order(siteUrl, {
      status: "potvrdjena",
      customerType: "customer",
      company: { name: "Primer d.o.o.", pib: "101234567" },
      payment: {
        method: "bank_transfer",
        label: "Virmanom uz predračun",
        instructions: "Deo rezervišemo do uplate.",
        reference: "97 2026000187",
      },
      bank: {
        recipient: "Naziv firme iz podešavanja",
        accounts: [{ bank: "Banka iz podešavanja", account: "000-0000000000000-00" }],
        reference: "97 2026000187",
        amountPara: 3_326_000,
      },
      proformaUrl: `${siteUrl}/porudzbina/${TOKEN}/predracun`,
    }),
  orderBackorder: (siteUrl: string): OrderEmailData =>
    order(siteUrl, {
      status: "ceka_deo",
      hasBackorder: true,
      lines: [
        { ...LINES[0]!, availabilityNote: "Po porudžbini, 3–5 radnih dana" },
        LINES[1]!,
        LINES[2]!,
      ],
    }),
  orderPickup: (siteUrl: string): OrderEmailData =>
    order(siteUrl, {
      status: "spremna_za_preuzimanje",
      delivery: { method: "pickup", label: "Lično preuzimanje" },
      payment: {
        method: "pickup_cash",
        label: "Gotovinom pri preuzimanju",
        instructions: "Plaćate u radnji kada preuzimate deo.",
        reference: "97 2026000187",
      },
    }),
  orderShipped: (siteUrl: string): OrderEmailData =>
    order(siteUrl, {
      status: "poslata",
      delivery: {
        method: "courier",
        label: "Kurirska služba",
        address: "Bulevar oslobođenja 12, 21000 Novi Sad",
        courierName: "D Express",
        trackingNumber: "DE123456789RS",
      },
    }),
  orderDelivered: (siteUrl: string): OrderEmailData => order(siteUrl, { status: "isporucena" }),
  orderCancelled: (siteUrl: string): OrderEmailData =>
    order(siteUrl, {
      status: "otkazana",
      cancelReason: "Kupac je odustao telefonom.",
    }),
  inquiry: (siteUrl: string): InquiryEmailData => inquiry(siteUrl, false),
  inquiryWithQuote: (siteUrl: string): InquiryEmailData => inquiry(siteUrl, true),
  backInStock: (siteUrl: string): BackInStockEmailData => ({
    productName: "Kočione pločice prednje",
    sku: "DEMO-KP-0142",
    manufacturer: "TRW",
    pricePara: 459_000,
    stockLabel: "Na stanju",
    productUrl: `${siteUrl}/deo/kocione-plocice-prednje-trw`,
    unsubscribeUrl: `${siteUrl}/obavestenja/odjava/${TOKEN}`,
  }),
  mechanic: (siteUrl: string): MechanicEmailData => mechanic(siteUrl),
  mechanicApproved: (siteUrl: string): MechanicEmailData =>
    mechanic(siteUrl, {
      tierName: "Majstor Plus",
      discountLabel: "15 %",
      creditEnabled: true,
      paymentTermsDays: 15,
    }),
  mechanicRejected: (siteUrl: string): MechanicEmailData =>
    mechanic(siteUrl, { reason: "PIB ne odgovara nazivu firme u APR-u." }),
  passwordReset: (siteUrl: string): PasswordResetEmailData => ({
    code: "48213905",
    expiresAt: AT + 15 * 60_000,
    resetUrl: `${siteUrl}/zaboravljena-lozinka`,
  }),
  staffInvite: (siteUrl: string): StaffInviteEmailData => ({
    inviteUrl: `${siteUrl}/admin/pozivnica/${TOKEN}`,
    role: "staff",
    expiresAt: AT + 7 * DAY,
  }),
  staffOrder: (siteUrl: string): StaffOrderEmailData => ({
    number: "SK-2026-000187",
    adminUrl: `${siteUrl}/admin/porudzbine/SK-2026-000187`,
    customerName: "Petar Petrović",
    customerType: "mechanic",
    companyName: "Auto servis Primer",
    tierName: "Majstor Plus",
    phone: "+381641234567",
    email: "petar@primer.rs",
    totalPara: 3_326_000,
    itemCount: 4,
    lines: LINES,
    moreLines: 0,
    deliveryLabel: "Kurirska služba",
    paymentLabel: "Odloženo plaćanje",
    note: "Pozvati pre slanja.",
    hasBackorder: false,
    source: "Google Ads · kočioni-diskovi",
  }),
  staffInquiry: (siteUrl: string): StaffInquiryEmailData => ({
    number: "UP-2026-000045",
    adminUrl: `${siteUrl}/admin/upiti/UP-2026-000045`,
    name: "Marko Jovanović",
    phone: "+381601234567",
    email: "marko@primer.rs",
    preferredChannel: "viber",
    vehicleLabel: "Golf VII",
    vin: "WVWZZZAUZFW123456",
    categoryLabels: ["turbina"],
    messageExcerpt: "Treba mi turbina, stara duva ulje. Motor CRLB.",
    requestedCodes: ["04L253016H"],
    photoCount: 2,
    isMechanic: false,
  }),
  staffMechanic: (siteUrl: string): StaffMechanicEmailData => ({
    companyName: "Auto servis Primer",
    pib: "101234567",
    city: "Kragujevac",
    contactPerson: "Nikola Petrović",
    phone: "+381641234567",
    email: "servis@primer.rs",
    serviceTypes: ["mehanika", "dijagnostika"],
    adminUrl: `${siteUrl}/admin/majstori`,
  }),
  staffQuoteAccepted: (siteUrl: string): StaffQuoteEmailData => ({
    number: "UP-2026-000045",
    adminUrl: `${siteUrl}/admin/porudzbine/SK-2026-000188`,
    customerName: "Marko Jovanović",
    orderNumber: "SK-2026-000188",
    totalPara: 9_480_000,
  }),
  staffQuoteRenewal: (siteUrl: string): StaffQuoteEmailData => ({
    number: "UP-2026-000045",
    adminUrl: `${siteUrl}/admin/upiti/UP-2026-000045`,
    customerName: "Marko Jovanović",
  }),
  staffLowStock: (siteUrl: string): StaffLowStockEmailData => ({
    items: [
      {
        sku: "DEMO-KD-0031",
        name: "Kočioni disk prednji, 288 mm",
        qty: 1,
        url: `${siteUrl}/admin/lager`,
      },
      { sku: "DEMO-FU-0007", name: "Filter ulja", qty: 0, url: `${siteUrl}/admin/lager` },
      { sku: "DEMO-SV-0112", name: "Svećica, iridijum", qty: 2, url: `${siteUrl}/admin/lager` },
    ],
    total: 3,
    adminUrl: `${siteUrl}/admin/lager`,
  }),
  staffDigest: (siteUrl: string): StaffDigestEmailData => ({
    day: AT - DAY,
    orders: { count: 7, valuePara: 12_540_000, cancelled: 1 },
    inquiriesReceived: 4,
    registrations: 1,
    openOrders: [
      {
        number: "SK-2026-000186",
        ageLabel: "3 h 20 min",
        url: `${siteUrl}/admin/porudzbine/SK-2026-000186`,
      },
    ],
    openOrderCount: 1,
    openInquiries: [
      {
        number: "UP-2026-000044",
        ageLabel: "5 h 10 min",
        url: `${siteUrl}/admin/upiti/UP-2026-000044`,
      },
      {
        number: "UP-2026-000045",
        ageLabel: "40 min",
        url: `${siteUrl}/admin/upiti/UP-2026-000045`,
      },
    ],
    openInquiryCount: 2,
    pendingMechanics: [{ companyName: "Auto servis Primer", url: `${siteUrl}/admin/majstori` }],
    lowStockCount: 12,
    outOfStockCount: 3,
    zeroSearches: [
      { query: "5Q0 407 271", count: 4 },
      { query: "letva volana passat b8", count: 2 },
    ],
    dashboardUrl: `${siteUrl}/admin`,
    stockUrl: `${siteUrl}/admin/lager`,
    searchesUrl: `${siteUrl}/admin/pretrage`,
  }),
  staffReminder: (siteUrl: string): StaffReminderEmailData => ({
    target: "inquiry",
    number: "UP-2026-000044",
    level: 1,
    ageLabel: "2 h 5 min",
    customerName: "Jelena Ilić",
    url: `${siteUrl}/admin/upiti/UP-2026-000044`,
  }),
} as const;
