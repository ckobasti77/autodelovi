import type { Metadata } from "next";

import { SignInForm, SignOutButton } from "@/components/auth/SignInForm";
import { RevealText } from "@/components/text-reveal/RevealText";
import { TEST_IDS } from "@/constants/testIds";
import { getViewer, type ServerViewer } from "@/lib/server/auth";

export const metadata: Metadata = {
  title: "Prijava",
  robots: { index: false, follow: false },
};

function roleLabel(viewer: ServerViewer): string {
  if (viewer.isOwner) return "vlasnik";
  if (viewer.isStaff) return "zaposleni";
  if (viewer.mechanicStatus === "approved")
    return viewer.tierName ? `majstor, ${viewer.tierName}` : "majstor";
  if (viewer.mechanicStatus === "pending") return "majstor, nalog čeka odobrenje";
  return "kupac";
}

/** Only same-site relative paths are allowed as `next` (no open redirects). */
function safeNext(value: string | string[] | undefined): string {
  const next = Array.isArray(value) ? value[0] : value;
  return next && next.startsWith("/") && !next.startsWith("//") ? next : "/prijava";
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [viewer, params] = await Promise.all([getViewer(), searchParams]);
  const next = safeNext(params.next);

  return (
    <section className="px-page py-section" aria-labelledby="signin-title">
      <div className="mx-auto flex w-full max-w-[26rem] flex-col gap-8">
        <RevealText as="h1" id="signin-title" className="type-h1 text-ink-1">
          {viewer ? "Prijavljeni ste" : "Prijava"}
        </RevealText>
        {viewer ? (
          <div className="flex flex-col gap-6">
            <p
              className="type-body text-ink-2"
              data-testid={TEST_IDS.authViewer}
              data-role={viewer.role}
            >
              {viewer.email ?? viewer.name ?? "Nalog"} · {roleLabel(viewer)}
            </p>
            <SignOutButton />
          </div>
        ) : (
          <SignInForm next={next} />
        )}
      </div>
    </section>
  );
}
