/**
 * E-mail delivery configuration (NOTIFICATIONS §I1 „E-mail modes“).
 *
 * Requested mode: settings `email.mode` (owner, admin) → `EMAIL_MODE` (deployment env) → `log`.
 * The effective mode is downgraded to `log` when what the mode needs is missing:
 * `test` needs `RESEND_API_KEY`; `live` also needs `EMAIL_FROM` (an address on a domain
 * verified in Resend). In `log` the Resend component is never called.
 */
import {
  emailFrom,
  emailModeFromEnv,
  linkTokenSecretIsSet,
  resendConfigured,
  siteUrl,
  type EmailMode,
} from "./env";
import type { Settings } from "./settingsSchema";

export const RESEND_TEST_RECIPIENT = "delivered@resend.dev";
const RESEND_TEST_SENDER = "onboarding@resend.dev";

export type EmailDeliveryConfig = {
  requested: EmailMode;
  requestedFrom: "settings" | "env" | "default";
  effective: EmailMode;
  /** `Name <address>` used as From (empty in log mode when nothing is configured). */
  from: string;
  replyTo: string | null;
  siteUrl: string;
  capabilities: {
    apiKey: boolean;
    webhookSecret: boolean;
    fromAddress: boolean;
    linkSecret: boolean;
  };
  /** Serbian warnings for the admin outbox banner. */
  warnings: string[];
};

function displayName(settings: Settings): string {
  const name = settings.email?.fromName?.trim() || settings.brand.name.trim() || "SKLOP";
  return name.replace(/[<>"]/g, "");
}

function withName(name: string, from: string): string {
  if (!from) return "";
  return /<[^>]+>/.test(from) ? from : `${name} <${from}>`;
}

export function resolveEmailConfig(settings: Settings): EmailDeliveryConfig {
  const env = emailModeFromEnv();
  const requested: EmailMode = settings.email?.mode ?? env ?? "log";
  const requestedFrom = settings.email?.mode ? "settings" : env ? "env" : "default";
  const resend = resendConfigured();
  const fromEnv = emailFrom();
  const capabilities = {
    apiKey: resend.apiKey,
    webhookSecret: resend.webhookSecret,
    fromAddress: fromEnv !== "",
    linkSecret: linkTokenSecretIsSet(),
  };
  const warnings: string[] = [];
  let effective: EmailMode = requested;
  if (requested !== "log" && !capabilities.apiKey) {
    effective = "log";
    warnings.push("Nedostaje RESEND_API_KEY — poruke se samo beleže (režim „Samo zapis“).");
  }
  if (requested === "live" && capabilities.apiKey && !capabilities.fromAddress) {
    effective = "log";
    warnings.push("Nedostaje EMAIL_FROM (adresa na verifikovanom domenu) — poruke se samo beleže.");
  }
  if (effective !== "log" && !capabilities.webhookSecret) {
    warnings.push(
      "Nedostaje RESEND_WEBHOOK_SECRET — status isporuke (isporučeno, odbijeno) se ne ažurira.",
    );
  }
  if (!capabilities.linkSecret) {
    warnings.push(
      "Nedostaje LINK_TOKEN_SECRET — linkovi ka statusu porudžbine koriste razvojni ključ.",
    );
  }
  const name = displayName(settings);
  const from =
    effective === "live"
      ? withName(name, fromEnv)
      : effective === "test"
        ? `${name} <${RESEND_TEST_SENDER}>`
        : withName(name, fromEnv);
  const replyTo = settings.email?.replyTo?.trim() || settings.company.email?.trim() || null;
  return {
    requested,
    requestedFrom,
    effective,
    from,
    replyTo,
    siteUrl: siteUrl(),
    capabilities,
    warnings,
  };
}

/** Which modes the owner may pick right now (the others are shown disabled with a reason). */
export function availableModes(config: EmailDeliveryConfig): Record<EmailMode, string | null> {
  return {
    log: null,
    test: config.capabilities.apiKey ? null : "Potreban je RESEND_API_KEY.",
    live: !config.capabilities.apiKey
      ? "Potreban je RESEND_API_KEY."
      : !config.capabilities.fromAddress
        ? "Potrebna je adresa pošiljaoca EMAIL_FROM na verifikovanom domenu."
        : null,
  };
}
