/**
 * Mechanic registration schema (`/za-majstore/registracija`): the same rules
 * `mechanics.register` enforces in Convex, with DESIGN-SYSTEM §11.4 messages. Account fields
 * are required only when the visitor is not signed in yet.
 */
import { z } from "zod";

import {
  isValidEmail,
  isValidMb,
  isValidPib,
  normalizeEmail,
  normalizeMb,
  normalizePib,
} from "@/lib/domain/identifiers";
import { normalizePhone } from "@/lib/format/phone";
import { ERRORS } from "@/lib/i18n/sr/shop";

export const SERVICE_TYPE_VALUES = [
  "mehanika",
  "elektrika",
  "limarija",
  "vulkanizer",
  "dijagnostika",
  "klima",
  "ostalo",
] as const;

export function passwordProblem(password: string): string | null {
  if (password.length < 10) return "Lozinka mora imati najmanje 10 znakova.";
  if (!/\p{L}/u.test(password) || !/\d/.test(password))
    return "Lozinka mora sadržati bar jedno slovo i jednu cifru.";
  return null;
}

export function mechanicRegistrationSchema(opts: { needsAccount: boolean }) {
  return z
    .object({
      email: z.string().trim(),
      password: z.string(),
      companyName: z.string().trim().min(1, ERRORS.required("naziv servisa ili firme")).max(120),
      pib: z
        .string()
        .trim()
        .refine((v) => isValidPib(normalizePib(v)), ERRORS.pib),
      mb: z
        .string()
        .trim()
        .refine((v) => isValidMb(normalizeMb(v)), ERRORS.mb),
      contactPerson: z.string().trim().min(1, ERRORS.required("ime i prezime kontakt osobe")).max(80),
      phone: z
        .string()
        .trim()
        .min(1, ERRORS.required("broj telefona"))
        .refine((v) => normalizePhone(v) !== null, ERRORS.phone),
      city: z.string().trim().min(1, ERRORS.required("mesto")).max(60),
      address: z.string().trim().min(1, ERRORS.required("adresu servisa")).max(160),
      serviceTypes: z.array(z.enum(SERVICE_TYPE_VALUES)).min(1, "Izaberite bar jednu vrstu servisa."),
      brandsServiced: z.array(z.string()).max(5, "Najviše 5 marki."),
      terms: z.boolean(),
    })
    .superRefine((d, ctx) => {
      if (opts.needsAccount) {
        if (!isValidEmail(normalizeEmail(d.email)))
          ctx.addIssue({ code: "custom", path: ["email"], message: ERRORS.email });
        const pw = passwordProblem(d.password);
        if (pw) ctx.addIssue({ code: "custom", path: ["password"], message: pw });
      }
      if (!d.terms)
        ctx.addIssue({
          code: "custom",
          path: ["terms"],
          message: "Potrebna je saglasnost sa uslovima korišćenja.",
        });
    });
}

export type MechanicRegistrationValues = z.infer<ReturnType<typeof mechanicRegistrationSchema>>;

/** Form field order (error summary, focus of the first invalid field). */
export const REGISTRATION_FIELDS = [
  "email",
  "password",
  "companyName",
  "pib",
  "mb",
  "contactPerson",
  "phone",
  "city",
  "address",
  "serviceTypes",
  "brandsServiced",
  "terms",
] as const satisfies readonly (keyof MechanicRegistrationValues)[];
