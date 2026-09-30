/**
 * Checkout form schema (ARCHITECTURE §G4): the same rules Convex enforces in
 * `validateCheckout` (convex/lib/orders.ts), with the Serbian messages of DESIGN-SYSTEM §11.4.
 * The client validates step by step; the server re-validates everything.
 */
import { z } from "zod";

import {
  isValidEmail,
  isValidMb,
  isValidPib,
  isValidPostalCode,
  normalizeEmail,
  normalizeMb,
  normalizePib,
} from "@/lib/domain/identifiers";
import { validateVin } from "@/lib/domain/vin";
import { normalizePhone } from "@/lib/format/phone";
import { ERRORS } from "@/lib/i18n/sr/shop";

export const PAYMENT_CODES = ["cod", "pickup_cash", "pickup_card", "bank_transfer", "deferred"] as const;
export const DELIVERY_CODES = ["pickup", "courier"] as const;

export const checkoutSchema = z
  .object({
    firstName: z.string().trim().min(1, ERRORS.required("ime")).max(60),
    lastName: z.string().trim().min(1, ERRORS.required("prezime")).max(60),
    phone: z
      .string()
      .trim()
      .min(1, ERRORS.required("broj telefona"))
      .refine((v) => normalizePhone(v) !== null, ERRORS.phone),
    email: z
      .string()
      .trim()
      .min(1, ERRORS.required("e-mail adresu"))
      .refine((v) => isValidEmail(normalizeEmail(v)), ERRORS.email),
    isCompany: z.boolean(),
    companyName: z.string().trim().max(120),
    pib: z.string().trim(),
    mb: z.string().trim(),
    deliveryMethod: z.enum(DELIVERY_CODES),
    street: z.string().trim().max(120),
    city: z.string().trim().max(60),
    postalCode: z.string().trim(),
    addressNote: z.string().trim().max(200),
    paymentMethod: z.enum(PAYMENT_CODES),
    vin: z.string().trim(),
    useVehicle: z.boolean(),
    note: z.string().trim().max(1000, "Napomena može imati najviše 1.000 znakova."),
    terms: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.isCompany) {
      if (!d.companyName) ctx.addIssue({ code: "custom", path: ["companyName"], message: ERRORS.required("naziv firme") });
      if (!isValidPib(normalizePib(d.pib))) ctx.addIssue({ code: "custom", path: ["pib"], message: ERRORS.pib });
      if (d.mb && !isValidMb(normalizeMb(d.mb))) ctx.addIssue({ code: "custom", path: ["mb"], message: ERRORS.mb });
    }
    if (d.deliveryMethod === "courier") {
      if (!d.street) ctx.addIssue({ code: "custom", path: ["street"], message: ERRORS.required("ulicu i broj") });
      if (!d.city) ctx.addIssue({ code: "custom", path: ["city"], message: ERRORS.required("mesto") });
      if (!isValidPostalCode(d.postalCode))
        ctx.addIssue({ code: "custom", path: ["postalCode"], message: ERRORS.postalCode });
    }
    if (d.paymentMethod === "bank_transfer" && !d.isCompany) {
      ctx.addIssue({
        code: "custom",
        path: ["paymentMethod"],
        message: "Virman uz predračun je za firme — u koraku Kontakt uključite „Kupujem kao firma“.",
      });
    }
    if (d.vin && !validateVin(d.vin).valid) ctx.addIssue({ code: "custom", path: ["vin"], message: ERRORS.vin });
    if (!d.terms)
      ctx.addIssue({ code: "custom", path: ["terms"], message: "Potrebna je saglasnost sa uslovima kupovine." });
  });

export type CheckoutValues = z.infer<typeof checkoutSchema>;

export const CHECKOUT_STEPS = [
  { id: "contact", label: "Kontakt" },
  { id: "delivery", label: "Dostava" },
  { id: "payment", label: "Plaćanje" },
  { id: "review", label: "Pregled" },
] as const;

/** Fields validated when leaving each step. */
export const STEP_FIELDS: readonly (readonly (keyof CheckoutValues)[])[] = [
  ["firstName", "lastName", "phone", "email", "isCompany", "companyName", "pib", "mb"],
  ["deliveryMethod", "street", "city", "postalCode", "addressNote"],
  ["paymentMethod"],
  ["vin", "note", "terms"],
];

/** Step index that owns a Convex error field path (`contact.email` → 0). */
export function stepForServerField(field: string | null): number {
  if (!field) return 3;
  if (field.startsWith("contact") || field.startsWith("company")) return 0;
  if (field.startsWith("delivery")) return 1;
  if (field.startsWith("payment")) return 2;
  return 3;
}

/** Convex error field path → form field name. */
export function formFieldForServerField(field: string | null): keyof CheckoutValues | null {
  const map: Record<string, keyof CheckoutValues> = {
    "contact.firstName": "firstName",
    "contact.lastName": "lastName",
    "contact.email": "email",
    "contact.phone": "phone",
    "company.name": "companyName",
    "company.pib": "pib",
    "company.mb": "mb",
    "delivery.address": "street",
    "delivery.address.postalCode": "postalCode",
    "delivery.method": "deliveryMethod",
    "payment.method": "paymentMethod",
    "vehicle.vin": "vin",
    consent: "terms",
  };
  return field ? (map[field] ?? null) : null;
}
