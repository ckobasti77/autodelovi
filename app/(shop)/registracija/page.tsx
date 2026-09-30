import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { SignUpForm } from "@/components/auth/AuthForms";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";
import { privateMetadata } from "@/lib/seo/metadata";
import { getViewer } from "@/lib/server/auth";

export const metadata: Metadata = privateMetadata("Registracija");

function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  return next && next.startsWith("/") && !next.startsWith("//") ? next : ROUTES.account;
}

export default async function SignUpPage({ searchParams }: PageProps<"/registracija">) {
  const [viewer, params] = await Promise.all([getViewer(), searchParams]);
  if (viewer) redirect(ROUTES.account);
  return (
    <AuthFrame
      title="Novi nalog"
      lead="Porudžbine, upiti i vozila na jednom mestu. Korpa ostaje sačuvana."
      footer={
        <p>
          Već imate nalog?{" "}
          <Link href={ROUTES.signIn} variant="inline">
            Prijavite se
          </Link>
        </p>
      }
    >
      <SignUpForm next={safeNext(params.next)} />
    </AuthFrame>
  );
}
