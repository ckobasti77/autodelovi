/**
 * Template catalogue without renderers: Serbian label, audience group and trigger per key.
 * Client components (admin outbox, gallery) import this instead of the registry so the
 * renderers and samples stay out of the browser bundle.
 */
export type TemplateGroup = "orders" | "inquiries" | "mechanics" | "account" | "staff";

export type TemplateInfo = { label: string; group: TemplateGroup; trigger: string };

export const TEMPLATE_INFO = {
  order_received: {
    label: "Porudžbina primljena",
    group: "orders",
    trigger: "Kupac pošalje porudžbinu (i kad prihvati ponudu).",
  },
  order_confirmed: {
    label: "Porudžbina potvrđena (predračun)",
    group: "orders",
    trigger: "Status → potvrđena. Uz virman ide predračun i poziv na broj.",
  },
  order_backordered: {
    label: "Porudžbina čeka deo",
    group: "orders",
    trigger: "Status → čeka deo.",
  },
  order_ready_pickup: {
    label: "Spremna za preuzimanje",
    group: "orders",
    trigger: "Status → spremna za preuzimanje.",
  },
  order_shipped: {
    label: "Porudžbina poslata",
    group: "orders",
    trigger: "Status → poslata (kurir i broj pošiljke).",
  },
  order_delivered: {
    label: "Isporučena / preuzeta",
    group: "orders",
    trigger: "Status → isporučena ili preuzeta (reklamacije i odustanak).",
  },
  order_cancelled: {
    label: "Porudžbina otkazana",
    group: "orders",
    trigger: "Status → otkazana (sa razlogom).",
  },
  inquiry_received: {
    label: "Upit primljen",
    group: "inquiries",
    trigger: "Kupac pošalje upit (VIN, deo, brza porudžbina).",
  },
  quote_ready: {
    label: "Ponuda spremna",
    group: "inquiries",
    trigger: "Osoblje pošalje ponudu (link za prihvatanje).",
  },
  quote_expiring: {
    label: "Ponuda uskoro ističe",
    group: "inquiries",
    trigger: "24 sata pre isteka poslate ponude.",
  },
  back_in_stock: {
    label: "Deo je ponovo na stanju",
    group: "inquiries",
    trigger: "Artikal sa prijavama „Javi mi kad stigne“ dobije zalihu.",
  },
  mechanic_registration_received: {
    label: "Registracija majstora primljena",
    group: "mechanics",
    trigger: "Servis pošalje registraciju.",
  },
  mechanic_approved: {
    label: "Majstor odobren (razred)",
    group: "mechanics",
    trigger: "Osoblje odobri registraciju ili ponovo aktivira nalog.",
  },
  mechanic_rejected: {
    label: "Registracija odbijena",
    group: "mechanics",
    trigger: "Osoblje odbije registraciju (sa razlogom).",
  },
  mechanic_suspended: {
    label: "Majstorski nalog pauziran",
    group: "mechanics",
    trigger: "Osoblje pauzira majstorski nalog.",
  },
  password_reset_code: {
    label: "Kod za novu lozinku",
    group: "account",
    trigger: "Korisnik zatraži novu lozinku.",
  },
  staff_invite: {
    label: "Pozivnica za administraciju",
    group: "account",
    trigger: "Vlasnik pozove zaposlenog (samo kad je slanje uživo).",
  },
  staff_order_new: {
    label: "Osoblje: nova porudžbina",
    group: "staff",
    trigger: "Stigne nova porudžbina.",
  },
  staff_inquiry_new: {
    label: "Osoblje: novi upit",
    group: "staff",
    trigger: "Stigne novi upit.",
  },
  staff_mechanic_new: {
    label: "Osoblje: nova registracija majstora",
    group: "staff",
    trigger: "Servis pošalje registraciju.",
  },
  staff_quote_accepted: {
    label: "Osoblje: ponuda prihvaćena",
    group: "staff",
    trigger: "Kupac prihvati ponudu (nastaje porudžbina).",
  },
  staff_quote_renewal: {
    label: "Osoblje: traži se nova ponuda",
    group: "staff",
    trigger: "Kupac zatraži obnovljenu ponudu posle isteka.",
  },
  staff_low_stock: {
    label: "Osoblje: malo na stanju",
    group: "staff",
    trigger: "Najviše jednom na sat, za artikle koji su pali na prag.",
  },
  staff_daily_digest: {
    label: "Osoblje: dnevni pregled",
    group: "staff",
    trigger: "Svakog dana u zadati sat (podrazumevano 08:00).",
  },
  staff_reminder: {
    label: "Osoblje: podsetnik",
    group: "staff",
    trigger: "Porudžbina ili upit bez odgovora duže od zadatog radnog vremena.",
  },
} as const satisfies Record<string, TemplateInfo>;

export type TemplateKey = keyof typeof TEMPLATE_INFO;

export const TEMPLATE_KEYS = Object.keys(TEMPLATE_INFO) as TemplateKey[];

export const TEMPLATE_GROUP_LABEL: Record<TemplateGroup, string> = {
  orders: "Porudžbine",
  inquiries: "Upiti i ponude",
  mechanics: "Majstori",
  account: "Nalog",
  staff: "Osoblje",
};

export function isTemplateKey(value: string): value is TemplateKey {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_INFO, value);
}

export function templateLabel(key: string): string {
  return isTemplateKey(key) ? TEMPLATE_INFO[key].label : key;
}
