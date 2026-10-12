import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { AuthFrame, AuthSteps } from "@/components/auth/AuthFrame";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";
import { privateMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privateMetadata("Zaboravljena lozinka");

/** The reset as it happens (the same facts the form states: 8 digits, 15 minutes). */
const STEPS = [
  "Upišete e-poštu naloga.",
  "Na nju stiže kod od 8 cifara; važi 15 minuta.",
  "Upišete kod i novu lozinku — odmah ste prijavljeni.",
] as const;

export default function ForgotPasswordPage() {
  return (
    <AuthFrame
      title="Nova lozinka"
      aside={<AuthSteps steps={STEPS} />}
      asideLabel="Kako ide promena lozinke"
      footer={
        <p>
          Setili ste se?{" "}
          <Link href={ROUTES.signIn} variant="inline">
            Prijava
          </Link>
        </p>
      }
    >
      <ResetPasswordForm />
    </AuthFrame>
  );
}
