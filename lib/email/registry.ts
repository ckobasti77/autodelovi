/**
 * Template registry: key → Serbian label, audience group, renderer and a realistic sample
 * (admin gallery previews, „Pošalji probnu poruku“, snapshot tests). Keys are stored in
 * `emailLog.templateKey` and `notificationDeliveries.templateKey` — never rename one.
 */
import type { EmailContext } from "./context";
import type { RenderedEmail } from "./html";
import { SAMPLES } from "./samples";
import {
  backInStock,
  inquiryReceived,
  mechanicApproved,
  mechanicRegistrationReceived,
  mechanicRejected,
  mechanicSuspended,
  passwordResetCode,
  quoteExpiring,
  quoteReady,
  staffInvite,
} from "./templates/customer";
import {
  orderBackordered,
  orderCancelled,
  orderConfirmed,
  orderDelivered,
  orderReadyPickup,
  orderReceived,
  orderShipped,
} from "./templates/order";
import {
  staffDailyDigest,
  staffInquiryNew,
  staffLowStock,
  staffMechanicNew,
  staffOrderNew,
  staffQuoteAccepted,
  staffQuoteRenewal,
  staffReminder,
} from "./templates/staff";
import type {
  BackInStockEmailData,
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

export type TemplateDataMap = {
  order_received: OrderEmailData;
  order_confirmed: OrderEmailData;
  order_backordered: OrderEmailData;
  order_ready_pickup: OrderEmailData;
  order_shipped: OrderEmailData;
  order_delivered: OrderEmailData;
  order_cancelled: OrderEmailData;
  inquiry_received: InquiryEmailData;
  quote_ready: InquiryEmailData;
  quote_expiring: InquiryEmailData;
  back_in_stock: BackInStockEmailData;
  mechanic_registration_received: MechanicEmailData;
  mechanic_approved: MechanicEmailData;
  mechanic_rejected: MechanicEmailData;
  mechanic_suspended: MechanicEmailData;
  password_reset_code: PasswordResetEmailData;
  staff_invite: StaffInviteEmailData;
  staff_order_new: StaffOrderEmailData;
  staff_inquiry_new: StaffInquiryEmailData;
  staff_mechanic_new: StaffMechanicEmailData;
  staff_quote_accepted: StaffQuoteEmailData;
  staff_quote_renewal: StaffQuoteEmailData;
  staff_low_stock: StaffLowStockEmailData;
  staff_daily_digest: StaffDigestEmailData;
  staff_reminder: StaffReminderEmailData;
};

export type TemplateKey = keyof TemplateDataMap;

export type TemplateGroup = "orders" | "inquiries" | "mechanics" | "account" | "staff";

export type TemplateDef<K extends TemplateKey> = {
  key: K;
  label: string;
  group: TemplateGroup;
  /** When it is sent (Serbian, one line for the gallery). */
  trigger: string;
  render: (data: TemplateDataMap[K], ctx: EmailContext) => RenderedEmail;
  sample: (siteUrl: string) => TemplateDataMap[K];
};

type Registry = { [K in TemplateKey]: TemplateDef<K> };

/** Mutable on purpose: tests replace a renderer to simulate failures (see notify.test.ts). */
export const TEMPLATES: Registry = {
  order_received: {
    key: "order_received",
    label: "Porudžbina primljena",
    group: "orders",
    trigger: "Kupac pošalje porudžbinu (i kad prihvati ponudu).",
    render: orderReceived,
    sample: SAMPLES.orderCourierCod,
  },
  order_confirmed: {
    key: "order_confirmed",
    label: "Porudžbina potvrđena (predračun)",
    group: "orders",
    trigger: "Status → potvrđena. Uz virman ide predračun i poziv na broj.",
    render: orderConfirmed,
    sample: SAMPLES.orderBankTransfer,
  },
  order_backordered: {
    key: "order_backordered",
    label: "Porudžbina čeka deo",
    group: "orders",
    trigger: "Status → čeka deo.",
    render: orderBackordered,
    sample: SAMPLES.orderBackorder,
  },
  order_ready_pickup: {
    key: "order_ready_pickup",
    label: "Spremna za preuzimanje",
    group: "orders",
    trigger: "Status → spremna za preuzimanje.",
    render: orderReadyPickup,
    sample: SAMPLES.orderPickup,
  },
  order_shipped: {
    key: "order_shipped",
    label: "Porudžbina poslata",
    group: "orders",
    trigger: "Status → poslata (kurir i broj pošiljke).",
    render: orderShipped,
    sample: SAMPLES.orderShipped,
  },
  order_delivered: {
    key: "order_delivered",
    label: "Isporučena / preuzeta",
    group: "orders",
    trigger: "Status → isporučena ili preuzeta (reklamacije i odustanak).",
    render: orderDelivered,
    sample: SAMPLES.orderDelivered,
  },
  order_cancelled: {
    key: "order_cancelled",
    label: "Porudžbina otkazana",
    group: "orders",
    trigger: "Status → otkazana (sa razlogom).",
    render: orderCancelled,
    sample: SAMPLES.orderCancelled,
  },
  inquiry_received: {
    key: "inquiry_received",
    label: "Upit primljen",
    group: "inquiries",
    trigger: "Kupac pošalje upit (VIN, deo, brza porudžbina).",
    render: inquiryReceived,
    sample: SAMPLES.inquiry,
  },
  quote_ready: {
    key: "quote_ready",
    label: "Ponuda spremna",
    group: "inquiries",
    trigger: "Osoblje pošalje ponudu (link za prihvatanje).",
    render: quoteReady,
    sample: SAMPLES.inquiryWithQuote,
  },
  quote_expiring: {
    key: "quote_expiring",
    label: "Ponuda uskoro ističe",
    group: "inquiries",
    trigger: "24 sata pre isteka poslate ponude.",
    render: quoteExpiring,
    sample: SAMPLES.inquiryWithQuote,
  },
  back_in_stock: {
    key: "back_in_stock",
    label: "Deo je ponovo na stanju",
    group: "inquiries",
    trigger: "Artikal sa prijavama „Javi mi kad stigne“ dobije zalihu.",
    render: backInStock,
    sample: SAMPLES.backInStock,
  },
  mechanic_registration_received: {
    key: "mechanic_registration_received",
    label: "Registracija majstora primljena",
    group: "mechanics",
    trigger: "Servis pošalje registraciju.",
    render: mechanicRegistrationReceived,
    sample: SAMPLES.mechanic,
  },
  mechanic_approved: {
    key: "mechanic_approved",
    label: "Majstor odobren (razred)",
    group: "mechanics",
    trigger: "Osoblje odobri registraciju ili ponovo aktivira nalog.",
    render: mechanicApproved,
    sample: SAMPLES.mechanicApproved,
  },
  mechanic_rejected: {
    key: "mechanic_rejected",
    label: "Registracija odbijena",
    group: "mechanics",
    trigger: "Osoblje odbije registraciju (sa razlogom).",
    render: mechanicRejected,
    sample: SAMPLES.mechanicRejected,
  },
  mechanic_suspended: {
    key: "mechanic_suspended",
    label: "Majstorski nalog pauziran",
    group: "mechanics",
    trigger: "Osoblje pauzira majstorski nalog.",
    render: mechanicSuspended,
    sample: SAMPLES.mechanic,
  },
  password_reset_code: {
    key: "password_reset_code",
    label: "Kod za novu lozinku",
    group: "account",
    trigger: "Korisnik zatraži novu lozinku.",
    render: passwordResetCode,
    sample: SAMPLES.passwordReset,
  },
  staff_invite: {
    key: "staff_invite",
    label: "Pozivnica za administraciju",
    group: "account",
    trigger: "Vlasnik pozove zaposlenog (samo kad je slanje uživo).",
    render: staffInvite,
    sample: SAMPLES.staffInvite,
  },
  staff_order_new: {
    key: "staff_order_new",
    label: "Osoblje: nova porudžbina",
    group: "staff",
    trigger: "Stigne nova porudžbina.",
    render: staffOrderNew,
    sample: SAMPLES.staffOrder,
  },
  staff_inquiry_new: {
    key: "staff_inquiry_new",
    label: "Osoblje: novi upit",
    group: "staff",
    trigger: "Stigne novi upit.",
    render: staffInquiryNew,
    sample: SAMPLES.staffInquiry,
  },
  staff_mechanic_new: {
    key: "staff_mechanic_new",
    label: "Osoblje: nova registracija majstora",
    group: "staff",
    trigger: "Servis pošalje registraciju.",
    render: staffMechanicNew,
    sample: SAMPLES.staffMechanic,
  },
  staff_quote_accepted: {
    key: "staff_quote_accepted",
    label: "Osoblje: ponuda prihvaćena",
    group: "staff",
    trigger: "Kupac prihvati ponudu (nastaje porudžbina).",
    render: staffQuoteAccepted,
    sample: SAMPLES.staffQuoteAccepted,
  },
  staff_quote_renewal: {
    key: "staff_quote_renewal",
    label: "Osoblje: traži se nova ponuda",
    group: "staff",
    trigger: "Kupac zatraži obnovljenu ponudu posle isteka.",
    render: staffQuoteRenewal,
    sample: SAMPLES.staffQuoteRenewal,
  },
  staff_low_stock: {
    key: "staff_low_stock",
    label: "Osoblje: malo na stanju",
    group: "staff",
    trigger: "Najviše jednom na sat, za artikle koji su pali na prag.",
    render: staffLowStock,
    sample: SAMPLES.staffLowStock,
  },
  staff_daily_digest: {
    key: "staff_daily_digest",
    label: "Osoblje: dnevni pregled",
    group: "staff",
    trigger: "Svakog dana u zadati sat (podrazumevano 08:00).",
    render: staffDailyDigest,
    sample: SAMPLES.staffDigest,
  },
  staff_reminder: {
    key: "staff_reminder",
    label: "Osoblje: podsetnik",
    group: "staff",
    trigger: "Porudžbina ili upit bez odgovora duže od zadatog radnog vremena.",
    render: staffReminder,
    sample: SAMPLES.staffReminder,
  },
};

export const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[];

export const TEMPLATE_GROUP_LABEL: Record<TemplateGroup, string> = {
  orders: "Porudžbine",
  inquiries: "Upiti i ponude",
  mechanics: "Majstori",
  account: "Nalog",
  staff: "Osoblje",
};

export function isTemplateKey(value: string): value is TemplateKey {
  return Object.prototype.hasOwnProperty.call(TEMPLATES, value);
}

/** Renders a template with typed data (the only entry point used by Convex). */
export function renderTemplate<K extends TemplateKey>(
  key: K,
  data: TemplateDataMap[K],
  ctx: EmailContext,
): RenderedEmail {
  const def = TEMPLATES[key] as TemplateDef<K>;
  return def.render(data, ctx);
}

/** Renders a template with its sample data (gallery, test send). */
export function renderSample(key: TemplateKey, ctx: EmailContext): RenderedEmail {
  const def = TEMPLATES[key] as TemplateDef<typeof key>;
  return (def.render as (d: unknown, c: EmailContext) => RenderedEmail)(def.sample(ctx.siteUrl), ctx);
}
