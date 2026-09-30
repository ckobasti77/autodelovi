import type { Metadata } from "next";

import { ResetPasswordForm } from "@/components/auth/AuthForms";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";
import { privateMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privateMetadata("Zaboravljena lozinka");

export default function ForgotPasswordPage() {
  return (
    <AuthFrame
      title="Nova lozinka"
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
