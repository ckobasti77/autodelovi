/**
 * Admin wording (DESIGN-SYSTEM §3.6, §11): compact status labels for tables, sources,
 * channels, stock reasons, audit entities. Staff-facing, Serbian Latin.
 */
import type { BadgeTone } from "@/components/ui/Badge";
import type { InquiryStatus, OrderStatus } from "@/lib/i18n/sr/shop";

/** Admin order labels: „Nova“ needs action (accent), compact forms for tables. */
export const ADMIN_ORDER_STATUS: Readonly<Record<OrderStatus, { label: string; tone: BadgeTone }>> =
  {
    nova: { label: "Nova", tone: "accent" },
    potvrdjena: { label: "Potvrđena", tone: "info" },
    ceka_deo: { label: "Čeka deo", tone: "warning" },
    spremna_za_preuzimanje: { label: "Za preuzimanje", tone: "info" },
    poslata: { label: "Poslata", tone: "info" },
    preuzeta: { label: "Preuzeta", tone: "success" },
    isporucena: { label: "Isporučena", tone: "success" },
    zavrsena: { label: "Završena", tone: "neutral" },
    otkazana: { label: "Otkazana", tone: "danger" },
  };

/** Verb for a transition button („Potvrdi“, „Označi kao poslato“ …). */
export const ORDER_TRANSITION_VERB: Readonly<Record<OrderStatus, string>> = {
  nova: "Vrati u nove",
  potvrdjena: "Potvrdi",
  ceka_deo: "Čeka deo",
  spremna_za_preuzimanje: "Spremna za preuzimanje",
  poslata: "Označi kao poslato",
  preuzeta: "Označi kao preuzeto",
  isporucena: "Označi kao isporučeno",
  zavrsena: "Završi",
  otkazana: "Otkaži porudžbinu",
};

export const ADMIN_INQUIRY_STATUS: Readonly<
  Record<InquiryStatus, { label: string; tone: BadgeTone }>
> = {
  nov: { label: "Nov", tone: "accent" },
  u_obradi: { label: "U obradi", tone: "info" },
  ponuda_poslata: { label: "Ponuda poslata", tone: "info" },
  prihvacena: { label: "Prihvaćena", tone: "success" },
  odbijena: { label: "Zatvoren", tone: "neutral" },
  istekla: { label: "Istekla", tone: "warning" },
};

export const INQUIRY_KIND_LABEL = {
  vin: "Po broju šasije",
  part: "Traži deo",
  not_found: "Nije pronađeno",
  product_question: "Pitanje o artiklu",
  quick_order_missing: "Brza porudžbina",
} as const;

export const CUSTOMER_TYPE_LABEL = {
  guest: "Gost",
  customer: "Kupac",
  mechanic: "Majstor",
} as const;

export const ORDER_SOURCE_LABEL = {
  web: "Sajt",
  inquiry: "Upit",
  admin: "Administracija",
  quick_order: "Brza porudžbina",
  reorder: "Ponovljena",
} as const;

/** Traffic channels (lib/domain/attribution) — the admin „Izvor“ column and filters. */
export const CHANNEL_LABEL: Readonly<Record<string, string>> = {
  google_ads: "Google Ads",
  meta_ads: "Meta oglasi",
  microsoft_ads: "Microsoft Ads",
  organic: "Pretraživač",
  email: "E-pošta",
  viber: "Viber",
  campaign: "Kampanja",
  referral: "Drugi sajt",
  direct: "Direktno",
};

export const PAYMENT_STATUS_LABEL = {
  unpaid: "Nije plaćeno",
  paid: "Plaćeno",
  refunded: "Vraćeno",
} as const;

export const STOCK_STATE_LABEL = {
  in_stock: "Na stanju",
  low_stock: "Malo na stanju",
  out_of_stock: "Nema na stanju",
  on_order: "Po porudžbini",
} as const;

export const STOCK_STATE_TONE: Readonly<Record<keyof typeof STOCK_STATE_LABEL, BadgeTone>> = {
  in_stock: "success",
  low_stock: "warning",
  out_of_stock: "neutral",
  on_order: "info",
};

export const STOCK_REASON_LABEL = {
  manual: "Ručna izmena",
  order_confirmed: "Potvrđena porudžbina",
  order_created: "Nova porudžbina",
  order_cancelled: "Otkazana porudžbina",
  order_edited: "Izmena porudžbine",
  import: "Uvoz",
  import_rollback: "Poništen uvoz",
  correction: "Korekcija (popis)",
  receipt: "Prijem robe",
  return: "Povrat",
} as const;

export const COMPANY_FIELD_LABEL = {
  legalName: "pun naziv firme",
  pib: "PIB",
  address: "adresa sedišta",
  phone: "telefon",
  bankAccount: "tekući račun",
} as const;

export const ACTOR_TYPE_LABEL = {
  system: "Sistem",
  owner: "Vlasnik",
  staff: "Zaposleni",
  customer: "Kupac",
  mechanic: "Majstor",
  guest: "Gost",
} as const;

export const ENTITY_TYPE_LABEL: Readonly<Record<string, string>> = {
  order: "Porudžbina",
  inquiry: "Upit",
  product: "Artikal",
  category: "Kategorija",
  manufacturer: "Proizvođač",
  mechanic: "Majstor",
  mechanicProfile: "Majstor",
  user: "Korisnik",
  settings: "Podešavanja",
  tier: "Cenovni razred",
  priceTier: "Cenovni razred",
  staffInvite: "Pozivnica",
  contentPage: "Stranica",
  vehicleBrand: "Marka",
  vehicleModel: "Model",
  vehicleGeneration: "Generacija",
  engine: "Motor",
  system: "Sistem",
};

export const EMAIL_STATUS_LABEL: Readonly<Record<string, { label: string; tone: BadgeTone }>> = {
  logged: { label: "Zabeleženo", tone: "neutral" },
  queued: { label: "U redu", tone: "info" },
  sent: { label: "Poslato", tone: "info" },
  delivered: { label: "Isporučeno", tone: "success" },
  delivery_delayed: { label: "Kasni", tone: "warning" },
  bounced: { label: "Odbijeno", tone: "danger" },
  complained: { label: "Prijavljeno", tone: "danger" },
  failed: { label: "Greška", tone: "danger" },
  opened: { label: "Otvoreno", tone: "success" },
  clicked: { label: "Kliknuto", tone: "success" },
};

export const EMAIL_MODE_LABEL = {
  log: "Samo zapis",
  test: "Test",
  live: "Uživo",
} as const;

export const SEARCH_SOURCE_LABEL: Readonly<Record<string, string>> = {
  header: "Zaglavlje",
  search_page: "Stranica pretrage",
  quick_order: "Brza porudžbina",
  three_d: "3D auto",
  landing: "Odredišna strana",
};

export const USER_TYPE_LABEL: Readonly<Record<string, string>> = {
  anon: "Posetilac",
  customer: "Kupac",
  mechanic: "Majstor",
  staff: "Zaposleni",
};

export const ROLE_LABEL = {
  owner: "Vlasnik",
  staff: "Zaposleni",
  customer: "Kupac",
} as const;

export const WEEKDAY_LABEL = [
  "Nedelja",
  "Ponedeljak",
  "Utorak",
  "Sreda",
  "Četvrtak",
  "Petak",
  "Subota",
];

export const FUEL_LABEL = {
  benzin: "Benzin",
  dizel: "Dizel",
  hibrid: "Hibrid",
  elektro: "Elektro",
  cng: "CNG",
  lpg: "LPG",
} as const;

/** Standard admin microcopy (DESIGN-SYSTEM §11). */
export const ADMIN_COPY = {
  saved: "Sačuvano.",
  conflict: "Podaci su u međuvremenu izmenjeni. Osvežite prikaz.",
  genericError: "Nije sačuvano. Pokušajte ponovo.",
  loadMore: "Učitaj još",
  undo: "Poništi",
  cancel: "Odustani",
  ownerOnly: "Ovo menja samo vlasnik.",
} as const;
