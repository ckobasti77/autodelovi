import { EMAIL_LOGO } from "./html";

const LOGO_SRC = new RegExp(
  `src="[^"]*?${EMAIL_LOGO.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`,
  "g",
);

/**
 * E-mail markup for the admin previews (template gallery, logged messages): the header logo is
 * taken from the address the admin is open on instead of the public site address written into
 * the message. A message carries `SITE_URL`, which does not answer before the domain is live, on
 * a staging address or on a developer's machine — the preview would show a broken image there.
 * Only the preview changes; the stored and the sent message keep the absolute address that mail
 * clients need.
 */
export function emailPreviewHtml(html: string): string {
  return html.replace(LOGO_SRC, `src="${EMAIL_LOGO.path}"`);
}
