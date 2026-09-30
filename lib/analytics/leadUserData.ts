/**
 * Hands a lead's hashed Enhanced Conversions data from the form to the thank-you page
 * (`LeadTracker`) through sessionStorage — raw e-mail/phone never leave the form.
 */
import { googleUserData, type RawUserData } from "@/lib/analytics/hash";

export async function storeLeadUserData(leadId: string, user: RawUserData): Promise<void> {
  try {
    const hashed = await googleUserData(user);
    if (hashed) sessionStorage.setItem(`sk_ud_${leadId}`, JSON.stringify(hashed));
  } catch {
    // Storage or WebCrypto unavailable — the lead is still tracked without user data.
  }
}
