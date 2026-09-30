import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { contactLinkList } from "@/config/site";
import { privateMetadata } from "@/lib/seo/metadata";
import { contactFromSettings } from "@/lib/settings/public";
import { fetchPublic } from "@/lib/server/convex";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { Link } from "@/components/ui/Link";
import { RevealText } from "@/components/text-reveal/RevealText";
import { ContactActions } from "@/components/shell/ContactActions";
import { LeadTracker } from "@/components/inquiry/LeadTracker";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = privateMetadata("Upit je primljen");

export default async function InquiryThanksPage({ params }: PageProps<"/upit/hvala/[token]">) {
  const { token } = await params;
  const [inquiry, settings] = await Promise.all([
    fetchPublic(api.inquiries.getByToken, { token }),
    getSettingsPublic(),
  ]);
  if (!inquiry) notFound();
  return (
    <div className="px-page pb-(--space-section) pt-10">
      <LeadTracker leadType="inquiry" leadId={inquiry.number} />
      <div className="flex max-w-[48rem] flex-col gap-4">
        <CheckCircleIcon size={40} weight="fill" aria-hidden="true" className="text-success" />
        <RevealText as="h1" className="type-display-l uppercase text-ink-1">
          Upit je primljen.
        </RevealText>
        <p className="type-lead text-ink-2" data-reveal="off">
          Broj upita je <span className="type-code-l text-ink-1" data-testid="inquiry-number">{inquiry.number}</span>.
          Odgovaramo u toku radnog dana.
        </p>
        <p className="type-body text-ink-2">
          Ponudu vidite i na{" "}
          <Link href={ROUTES.inquiryStatus(token)} variant="inline">
            stranici upita
          </Link>{" "}
          — sačuvajte link.
        </p>
        <ContactActions links={contactLinkList(contactFromSettings(settings))} location="inquiry_thanks" />
      </div>
    </div>
  );
}
