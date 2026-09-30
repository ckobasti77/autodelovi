import type { Metadata } from "next";

import { privateMetadata } from "@/lib/seo/metadata";
import { RevealText } from "@/components/text-reveal/RevealText";
import { UnsubscribeForm } from "@/components/notifications/UnsubscribeForm";

export const metadata: Metadata = {
  ...privateMetadata("Odjava obaveštenja"),
  referrer: "no-referrer",
};

/**
 * `/obavestenja/odjava/[token]` — link from the „Stiglo je“ e-mail. The token is the
 * capability; the page asks for one click (mail scanners open links, they do not click).
 */
export default async function UnsubscribePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return (
    <div className="px-page pb-(--space-section) pt-10">
      <div className="flex max-w-[40rem] flex-col gap-4">
        <RevealText as="h1" className="type-h1 text-ink-1">
          Odjava obaveštenja
        </RevealText>
        <UnsubscribeForm token={token} />
      </div>
    </div>
  );
}
