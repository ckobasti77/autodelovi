import type { Metadata } from "next";

import { SignInForm, SignOutButton } from "@/components/auth/SignInForm";
import { AuthFrame } from "@/components/auth/AuthFrame";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";
import { TEST_IDS } from "@/constants/testIds";
import { safeNextPath } from "@/lib/domain/redirect";
import { privateMetadata } from "@/lib/seo/metadata";
import { getViewer, type ServerViewer } from "@/lib/server/auth";

export const metadata: Metadata = privateMetadata("Prijava");

function roleLabel(viewer: ServerViewer): string {
  if (viewer.isOwner) return "vlasnik";
  if (viewer.isStaff) return "zaposleni";
  if (viewer.mechanicStatus === "approved")
    return viewer.tierName ? `majstor, ${viewer.tierName}` : "majstor";
  if (viewer.mechanicStatus === "pending") return "majstor, nalog čeka odobrenje";
  return "kupac";
}


export default async function SignInPage({ searchParams }: PageProps<"/prijava">) {
  const [viewer, params] = await Promise.all([getViewer(), searchParams]);
  // Only same-origin relative paths are allowed as `next` (no open redirects).
  const next = safeNextPath(params.next, "/prijava");

  if (viewer) {
    return (
      <AuthFrame title="Prijavljeni ste">
        <div className="flex flex-col gap-6">
          <p className="type-body text-ink-2" data-testid={TEST_IDS.authViewer} data-role={viewer.role}>
            {viewer.email ?? viewer.name ?? "Nalog"} · {roleLabel(viewer)}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="primary">
              <Link href={ROUTES.account} variant="unstyled">
                Moj nalog
              </Link>
            </Button>
            <SignOutButton />
          </div>
        </div>
      </AuthFrame>
    );
  }
  return (
    <AuthFrame
      title="Prijava"
      lead="Nalog nije obavezan za kupovinu — služi za istoriju porudžbina i sačuvana vozila."
      footer={
        <>
          <p>
            Nemate nalog?{" "}
            <Link href={`${ROUTES.signUp}${next !== "/prijava" ? `?next=${encodeURIComponent(next)}` : ""}`} variant="inline">
              Napravite nalog
            </Link>
          </p>
          <p>
            <Link href={ROUTES.forgotPassword} variant="inline">
              Zaboravljena lozinka
            </Link>
          </p>
        </>
      }
    >
      <SignInForm next={next} />
    </AuthFrame>
  );
}
