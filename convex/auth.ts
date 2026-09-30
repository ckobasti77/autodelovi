/**
 * Convex Auth (docs/SECURITY.md §D1): e-mail + password with a reset code.
 * Roles are never read from sign-up params — `users.role` is set only by the owner seed,
 * staff invites and owner actions.
 */
import { Email } from "@convex-dev/auth/providers/Email";
import { Password } from "@convex-dev/auth/providers/Password";
import { convexAuth } from "@convex-dev/auth/server";
import type { GenericActionCtx } from "convex/server";
import { ConvexError } from "convex/values";

import { internal } from "./_generated/api";
import type { DataModel } from "./_generated/dataModel";
import { isValidEmail, normalizeEmail } from "../lib/domain/identifiers";
import { enforceRateLimit } from "./lib/rateLimits";

export const PASSWORD_MIN_LENGTH = 10;

/** ≥ 10 characters with at least one letter and one digit. */
export function validatePassword(password: string): void {
  if (password.length < PASSWORD_MIN_LENGTH) {
    throw new ConvexError({
      code: "WEAK_PASSWORD",
      message: "Lozinka mora imati najmanje 10 znakova.",
    });
  }
  if (!/\p{L}/u.test(password) || !/\d/.test(password)) {
    throw new ConvexError({
      code: "WEAK_PASSWORD",
      message: "Lozinka mora sadržati bar jedno slovo i jednu cifru.",
    });
  }
}

/** 8-digit numeric reset code (paired with the e-mail, so short codes are acceptable). */
async function generateResetCode(): Promise<string> {
  const bytes = new Uint32Array(1);
  crypto.getRandomValues(bytes);
  return String(bytes[0] % 100_000_000).padStart(8, "0");
}

const PasswordResetCode = Email({
  id: "password-reset",
  maxAge: 15 * 60,
  generateVerificationToken: generateResetCode,
  // The runtime passes the action ctx as a second (undocumented) argument.
  async sendVerificationRequest(
    params: { identifier: string; token: string; expires: Date },
    ctx?: GenericActionCtx<DataModel>,
  ) {
    if (!ctx) throw new Error("Password reset needs the Convex action context.");
    await ctx.runMutation(internal.authEmails.sendPasswordResetCode, {
      email: params.identifier,
      code: params.token,
      expiresAt: params.expires.getTime(),
    });
  },
});

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password<DataModel>({
      profile(params) {
        const email = normalizeEmail(String(params.email ?? ""));
        if (!isValidEmail(email)) {
          throw new ConvexError({
            code: "INVALID_EMAIL",
            message: "Upišite ispravnu e-mail adresu.",
          });
        }
        const name = typeof params.name === "string" ? params.name.trim().slice(0, 120) : undefined;
        return { email, ...(name ? { name } : {}) };
      },
      validatePasswordRequirements: validatePassword,
      reset: PasswordResetCode,
    }),
  ],
  session: {
    totalDurationMs: 30 * 24 * 60 * 60 * 1000,
    inactiveDurationMs: 14 * 24 * 60 * 60 * 1000,
  },
  jwt: { durationMs: 60 * 60 * 1000 },
  signIn: { maxFailedAttempsPerHour: 10 },
  callbacks: {
    // New accounts: sign-ups come through the Next /api/auth proxy (one server IP), so the cap
    // is global — a burst of 30, then 60 per hour; throwing rolls the new user back. Every new
    // account is an explicit customer (the admin customer list reads the `by_role` index).
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      if (existingUserId !== null) return;
      await enforceRateLimit(ctx, "signUpGlobal", "global");
      await ctx.db.patch("users", userId, { role: "customer" });
    },
    async beforeSessionCreation(ctx, { userId }) {
      const user = await ctx.db.get("users", userId);
      if (user && (user as { status?: string }).status === "blocked") {
        throw new ConvexError({ code: "BLOCKED", message: "Nalog je blokiran. Pozovite nas." });
      }
    },
  },
});
