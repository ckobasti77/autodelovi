import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { api } from "@/convex/_generated/api";
import { tokenPageMetadata } from "@/lib/seo/metadata";
import { fetchPublic } from "@/lib/server/convex";
import { getSettingsPublic } from "@/lib/server/catalog-cache";
import { RevealText } from "@/components/text-reveal/RevealText";
import { InquiryStatusView } from "@/components/inquiry/InquiryStatusView";

export const metadata: Metadata = tokenPageMetadata("Upit i ponuda");

/** Inquiry status + quote with accept / decline / renewal (ARCHITECTURE §A2). */
export default async function InquiryStatusPage({ params }: PageProps<"/upit/[token]">) {
  const { token } = await params;
  const [inquiry, settings] = await Promise.all([
    fetchPublic(api.inquiries.getByToken, { token }),
    getSettingsPublic(),
  ]);
  if (!inquiry) notFound();
  return (
    <div className="px-page pb-(--space-section) pt-8">
      <RevealText as="h1" className="type-h1 text-ink-1">
        Upit i ponuda
      </RevealText>
      <div className="mt-6">
        <InquiryStatusView
          token={token}
          initial={inquiry}
          config={{
            deliveryMethods: settings.deliveryMethods.map((d) => ({
              code: d.code,
              label: d.label,
              pricePara: d.pricePara,
            })),
            paymentMethods: settings.paymentMethods.map((p) => ({
              code: p.code,
              label: p.label,
              requires: p.requires,
              deliveryCodes: p.deliveryCodes,
            })),
            legal: { terms: settings.legalVersions.terms, privacy: settings.legalVersions.privacy },
          }}
        />
      </div>
    </div>
  );
}
