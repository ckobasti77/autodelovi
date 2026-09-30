import { Resend } from "@convex-dev/resend";
import { httpRouter } from "convex/server";

import { components, internal } from "./_generated/api";
import { httpAction } from "./_generated/server";
import { auth } from "./auth";

const http = httpRouter();

// Convex Auth: OIDC discovery, JWKS and OAuth callback routes.
auth.addHttpRoutes(http);

/**
 * Resend delivery webhook (NOTIFICATIONS §I1): signature-verified with RESEND_WEBHOOK_SECRET
 * by the component, which updates its own tables and calls `notify.onEmailEvent`.
 * Without the secret the route answers 503 instead of throwing.
 */
http.route({
  path: "/resend-webhook",
  method: "POST",
  handler: httpAction(async (ctx, req) => {
    if (!process.env.RESEND_WEBHOOK_SECRET?.trim()) {
      return new Response("Webhook secret is not configured.", { status: 503 });
    }
    const resend = new Resend(components.resend, { onEmailEvent: internal.notify.onEmailEvent });
    try {
      return await resend.handleResendEventWebhook(ctx, req);
    } catch {
      return new Response("Invalid webhook.", { status: 400 });
    }
  }),
});

export default http;
