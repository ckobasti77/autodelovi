"use server";

/**
 * Consent choice (SEO-ADS §J6): sets `sk_consent` (180 days) and, with a granted category,
 * the 90-day attribution cookie. Works as a plain form post too (no JavaScript): the banner's
 * buttons submit `choice=all|none|custom` plus the two checkboxes.
 */
import { cookies } from "next/headers";

import type { ConsentChoice, ConsentRecord } from "@/lib/analytics/consent";
import { writeConsent } from "@/lib/server/trackingCookies";

export async function saveConsent(choice: ConsentChoice): Promise<ConsentRecord> {
  const clean = { analytics: choice.analytics === true, ads: choice.ads === true };
  return writeConsent(await cookies(), clean);
}

export async function saveConsentForm(formData: FormData): Promise<void> {
  const choice = formData.get("choice");
  const clean =
    choice === "all"
      ? { analytics: true, ads: true }
      : choice === "none"
        ? { analytics: false, ads: false }
        : { analytics: formData.get("analytics") === "on", ads: formData.get("ads") === "on" };
  writeConsent(await cookies(), clean);
}
