/**
 * The only code that writes `emailLog` rows and talks to the Resend component.
 *
 * - `log`: render → store (status `logged`); the component is never called (it throws without
 *   `RESEND_API_KEY`).
 * - `test`: component with `testMode: true`; recipients rewritten to delivered@resend.dev
 *   (the real address is kept in `originalTo`).
 * - `live`: real recipients, `EMAIL_FROM` on a verified domain.
 * Demo and e2e aggregates are always logged, never sent.
 */
import { Resend } from "@convex-dev/resend";

import { components, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { RenderedEmail } from "../../lib/email/html";
import { isValidEmail, normalizeEmail } from "../../lib/domain/identifiers";
import { RESEND_TEST_RECIPIENT, resolveEmailConfig } from "./emailConfig";
import type { EmailMode } from "./env";
import type { Settings } from "./settingsSchema";

export type RelatedType = "order" | "inquiry" | "mechanic" | "user" | "product" | "digest" | "test" | "auth";

export type SendEmailInput = {
  to: readonly string[];
  rendered: RenderedEmail;
  templateKey: string;
  related?: { type: RelatedType; id?: string };
  eventId?: Id<"domainEvents">;
  /** Demo / e2e aggregates: always `log`. */
  forceLog?: boolean;
  isDemo?: boolean;
  /** Dedupes enqueues in the Resend component (retries collapse to one send). */
  idempotencyKey?: string;
  /** Update this row instead of inserting (delivery retries keep one outbox row). */
  existingLogId?: Id<"emailLog">;
  resentFrom?: Id<"emailLog">;
};

export type SendEmailResult =
  | { ok: true; emailLogId: Id<"emailLog">; mode: EmailMode }
  | { ok: false; emailLogId: Id<"emailLog"> | null; mode: EmailMode; error: string; permanent: boolean };

/** HTML is capped so a runaway template can never hit the document size limit. */
const MAX_HTML = 400_000;

export function validRecipients(to: readonly string[]): string[] {
  const out: string[] = [];
  for (const raw of to) {
    const email = normalizeEmail(raw);
    if (isValidEmail(email) && !out.includes(email)) out.push(email);
  }
  return out.slice(0, 10);
}

export async function sendEmail(
  ctx: MutationCtx,
  settings: Settings,
  input: SendEmailInput,
): Promise<SendEmailResult> {
  const config = resolveEmailConfig(settings);
  const mode: EmailMode = input.forceLog ? "log" : config.effective;
  const recipients = validRecipients(input.to);
  if (recipients.length === 0) {
    return {
      ok: false,
      emailLogId: null,
      mode,
      error: "Nema ispravne e-mail adrese primaoca.",
      permanent: true,
    };
  }
  const now = Date.now();
  const html =
    input.rendered.html && input.rendered.html.length <= MAX_HTML ? input.rendered.html : undefined;
  const deliveredTo = mode === "test" ? [RESEND_TEST_RECIPIENT] : recipients;
  const row = {
    to: deliveredTo,
    ...(mode === "test" ? { originalTo: recipients } : {}),
    subject: input.rendered.subject,
    templateKey: input.templateKey,
    ...(html ? { html } : {}),
    text: input.rendered.text,
    preheader: input.rendered.preheader,
    mode,
    status: mode === "log" ? ("logged" as const) : ("queued" as const),
    ...(input.eventId ? { eventId: input.eventId } : {}),
    ...(input.related ? { relatedType: input.related.type } : {}),
    ...(input.related?.id ? { relatedId: input.related.id } : {}),
    ...(input.isDemo ? { isDemo: true } : {}),
    ...(input.resentFrom ? { resentFrom: input.resentFrom } : {}),
    updatedAt: now,
  };
  let emailLogId: Id<"emailLog">;
  if (input.existingLogId && (await ctx.db.get("emailLog", input.existingLogId))) {
    emailLogId = input.existingLogId;
    await ctx.db.patch("emailLog", emailLogId, { ...row, error: undefined, resendEmailId: undefined });
  } else {
    emailLogId = await ctx.db.insert("emailLog", row);
  }
  if (mode === "log") return { ok: true, emailLogId, mode };

  try {
    const resend = new Resend(components.resend, {
      testMode: mode === "test",
      onEmailEvent: internal.notify.onEmailEvent,
    });
    const resendId = await resend.sendEmail(ctx, {
      from: config.from,
      to: deliveredTo,
      subject: input.rendered.subject,
      ...(html ? { html } : {}),
      text: input.rendered.text,
      ...(config.replyTo ? { replyTo: [config.replyTo] } : {}),
      ...(input.idempotencyKey ? { idempotencyKey: input.idempotencyKey } : {}),
    });
    await ctx.db.patch("emailLog", emailLogId, { resendEmailId: resendId, updatedAt: Date.now() });
    return { ok: true, emailLogId, mode };
  } catch (error) {
    // The component call is a subtransaction: its writes rolled back, ours stay.
    const message = (error instanceof Error ? error.message : String(error)).slice(0, 500);
    await ctx.db.patch("emailLog", emailLogId, {
      status: "failed",
      error: message,
      updatedAt: Date.now(),
    });
    return { ok: false, emailLogId, mode, error: message, permanent: false };
  }
}
