/**
 * Template e-mails that do not come from an outbox event: password reset codes, staff
 * invites, „Pošalji probnu poruku“. Same renderer and mailer as the dispatcher.
 */
import type { MutationCtx } from "../_generated/server";
import { emailContext } from "../../lib/email/context";
import { renderTemplate, type TemplateDataMap, type TemplateKey } from "../../lib/email/registry";
import { siteUrl } from "./env";
import { sendEmail, type RelatedType, type SendEmailResult } from "./mailer";
import { getSettings } from "./settings";

export async function sendTemplateNow<K extends TemplateKey>(
  ctx: MutationCtx,
  key: K,
  data: TemplateDataMap[K],
  to: readonly string[],
  opts: {
    related?: { type: RelatedType; id?: string };
    subjectPrefix?: string;
    forceLog?: boolean;
  } = {},
): Promise<SendEmailResult> {
  const settings = await getSettings(ctx);
  const rendered = renderTemplate(key, data, emailContext(settings, siteUrl()));
  const subject = opts.subjectPrefix
    ? `${opts.subjectPrefix}${rendered.subject}`
    : rendered.subject;
  return await sendEmail(ctx, settings, {
    to,
    rendered: { ...rendered, subject },
    templateKey: key,
    ...(opts.related ? { related: opts.related } : {}),
    ...(opts.forceLog ? { forceLog: true } : {}),
  });
}
