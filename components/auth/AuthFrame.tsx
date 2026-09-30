import type { ReactNode } from "react";

import { RevealText } from "@/components/text-reveal/RevealText";

/** Shared frame of the auth pages: title, lead, the form, secondary links. */
export function AuthFrame({
  title,
  lead,
  children,
  footer,
}: {
  title: string;
  lead?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <section className="px-page py-section" aria-labelledby="auth-title">
      <div className="mx-auto flex w-full max-w-[28rem] flex-col gap-8">
        <div className="flex flex-col gap-3">
          <RevealText as="h1" id="auth-title" className="type-h1 text-ink-1">
            {title}
          </RevealText>
          {lead ? (
            <RevealText as="p" className="type-body text-ink-2">
              {lead}
            </RevealText>
          ) : null}
        </div>
        {children}
        {footer ? (
          <div className="flex flex-col gap-2 border-t border-line pt-6 type-body-s text-ink-2" data-reveal="off">
            {footer}
          </div>
        ) : null}
      </div>
    </section>
  );
}
