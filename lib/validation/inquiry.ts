/**
 * VIN / part inquiry schema (ARCHITECTURE §A2) — mirrors `inquiries.submit` in Convex: a name,
 * phone or e-mail (the one matching the reply channel), a message, an optional valid VIN.
 */
import { z } from "zod";

import { isValidEmail, normalizeEmail } from "@/lib/domain/identifiers";
import { validateVin } from "@/lib/domain/vin";
import { normalizePhone } from "@/lib/format/phone";
import { ERRORS } from "@/lib/i18n/sr/shop";

export const CHANNELS = ["phone", "viber", "whatsapp", "email"] as const;

export const inquirySchema = z
  .object({
    vin: z.string().trim(),
    brandSlug: z.string(),
    modelSlug: z.string(),
    generationSlug: z.string(),
    year: z.string().trim(),
    message: z
      .string()
      .trim()
      .min(3, "Napišite šta vam treba — naziv dela ili kvar.")
      .max(2000, "Najviše 2.000 znakova."),
    name: z.string().trim().min(1, ERRORS.required("ime")).max(80),
    phone: z.string().trim(),
    email: z.string().trim(),
    channel: z.enum(CHANNELS),
    consent: z.boolean(),
  })
  .superRefine((d, ctx) => {
    if (d.vin && !validateVin(d.vin).valid) ctx.addIssue({ code: "custom", path: ["vin"], message: ERRORS.vin });
    if (d.year && !/^(19[5-9]\d|20\d\d)$/.test(d.year))
      ctx.addIssue({ code: "custom", path: ["year"], message: "Godište ima 4 cifre, npr. 2016." });
    const phoneOk = d.phone ? normalizePhone(d.phone) !== null : false;
    const emailOk = d.email ? isValidEmail(normalizeEmail(d.email)) : false;
    if (d.phone && !phoneOk) ctx.addIssue({ code: "custom", path: ["phone"], message: ERRORS.phone });
    if (d.email && !emailOk) ctx.addIssue({ code: "custom", path: ["email"], message: ERRORS.email });
    if (d.channel === "email" && !d.email)
      ctx.addIssue({ code: "custom", path: ["email"], message: "Za odgovor e-poštom upišite e-mail adresu." });
    if (d.channel !== "email" && !d.phone)
      ctx.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Za odgovor telefonom ili porukom upišite broj telefona.",
      });
    if (!d.consent)
      ctx.addIssue({
        code: "custom",
        path: ["consent"],
        message: "Potrebna je saglasnost da podatke koristimo za odgovor na upit.",
      });
  });

export type InquiryValues = z.infer<typeof inquirySchema>;
