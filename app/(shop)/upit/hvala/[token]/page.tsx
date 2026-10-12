import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ArrowRightIcon, CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import { contactLinkList } from "@/config/site";
import { INQUIRY_STATUS_LABEL, INQUIRY_STATUS_TONE } from "@/lib/i18n/sr/shop";
import { tokenPageMetadata } from "@/lib/seo/metadata";
import { contactFromSettings } from "@/lib/settings/public";
import { fetchPublic } from "@/lib/server/convex";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Link } from "@/components/ui/Link";
import { Reveal } from "@/components/reveal/Reveal";
import { RevealText } from "@/components/text-reveal/RevealText";
import { ContactActions } from "@/components/shell/ContactActions";
import { InquirySteps } from "@/components/inquiry/InquirySteps";
import { InquirySummary } from "@/components/inquiry/InquirySummary";
import { LeadTracker } from "@/components/inquiry/LeadTracker";
import { ROUTES } from "@/constants/routes";

export const metadata: Metadata = tokenPageMetadata("Upit je primljen");

/**
 * Inquiry thank-you: a record page (sans H1, UI-BOOST §8) — the number, what happens next with
 * the one action (the inquiry page, where the quote appears), and what was sent beside it.
 */
export default async function InquiryThanksPage({ params }: PageProps<"/upit/hvala/[token]">) {
  const { token } = await params;
  const [inquiry, settings] = await Promise.all([
    fetchPublic(api.inquiries.getByToken, { token }),
    getSettingsPublic(),
  ]);
  if (!inquiry) notFound();
  // Fresh from the form the status is „Primljen“: the green check is the confirmation.
  const received = inquiry.status === "nov";
  const contacts = contactLinkList(contactFromSettings(settings), `Upit ${inquiry.number}`);
  return (
    <div className="px-page pb-(--space-section) pt-8 lg:pt-10">
      <LeadTracker leadType="inquiry" leadId={inquiry.number} />
      <div className="flex max-w-[48rem] flex-col gap-3">
        <Badge
          tone={received ? "success" : INQUIRY_STATUS_TONE[inquiry.status]}
          size="text"
          icon={received ? <CheckCircleIcon size={14} weight="fill" /> : undefined}
          className="self-start"
        >
          {INQUIRY_STATUS_LABEL[inquiry.status]}
        </Badge>
        <RevealText as="h1" className="type-h1 text-ink-1">
          Upit je primljen.
        </RevealText>
        <p className="type-lead text-ink-2" data-reveal="off">
          Broj upita je{" "}
          <span className="type-code-l text-ink-1" data-testid="inquiry-number">
            {inquiry.number}
          </span>
          . Odgovaramo u toku radnog dana.
        </p>
      </div>
      <div className="mt-block grid gap-4 lg:grid-cols-12 lg:gap-x-(--gutter)">
        <div className="flex min-w-0 flex-col gap-4 lg:col-span-7">
          <Reveal as="section" eager aria-labelledby="next-title" className="panel p-5 sm:p-6">
            <h2 id="next-title" className="type-h4 text-ink-1">
              Šta dalje
            </h2>
            <InquirySteps reached={1} className="mt-4" />
            <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:gap-5">
              <Button
                asChild
                variant="primary"
                trailingIcon={<ArrowRightIcon size={16} />}
                className="w-full shrink-0 sm:w-auto"
              >
                <Link href={ROUTES.inquiryStatus(token)} variant="unstyled" reloadDocument>
                  Stranica upita
                </Link>
              </Button>
              <p className="type-body-s text-ink-2">
                Ponudu vidite i na stranici upita — sačuvajte link.
              </p>
            </div>
          </Reveal>
          {contacts.length ? (
            <Reveal as="section" eager index={2} className="flex flex-col gap-2 panel p-5 sm:p-6">
              <h2 className="type-h4 text-ink-1">Brže je telefonom?</h2>
              <ContactActions links={contacts} location="inquiry_thanks" />
            </Reveal>
          ) : null}
        </div>
        <Reveal as="aside" eager index={1} className="self-start panel p-5 sm:p-6 lg:col-span-5">
          <InquirySummary inquiry={inquiry} />
        </Reveal>
      </div>
    </div>
  );
}
