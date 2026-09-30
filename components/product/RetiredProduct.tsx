import { ArchiveIcon, ChatCircleTextIcon } from "@phosphor-icons/react/dist/ssr";

import type { FunctionReturnType } from "convex/server";
import type { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Link } from "@/components/ui/Link";
import { ROUTES } from "@/constants/routes";

type Retired = NonNullable<FunctionReturnType<typeof api.catalog.products.retired>>;

/** A product that is no longer sold: 200 + alternatives, never a dead end (ROUTES §B1). */
export function RetiredProduct({ retired }: { retired: Retired }) {
  return (
    <div className="px-page py-section">
      <EmptyState
        icon={<ArchiveIcon size={44} />}
        as="h1"
        title="Artikal više nije u ponudi"
        action={
          <>
            {retired.category ? (
              <Button asChild variant="primary">
                <Link href={ROUTES.category(retired.category.slug)} variant="unstyled">
                  Zamena: {retired.category.name}
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="secondary" icon={<ChatCircleTextIcon size={20} />}>
              <Link
                href={ROUTES.inquiryWith({ q: retired.oemPrimary ?? retired.name })}
                variant="unstyled"
              >
                Pošaljite upit
              </Link>
            </Button>
          </>
        }
      >
        {retired.name} ({retired.manufacturerName}
        {retired.oemPrimary ? `, OEM ${retired.oemPrimary}` : ""}) više ne prodajemo. Pogledajte
        zamenu u kategoriji ili nam pošaljite upit — proverićemo kod dobavljača.
      </EmptyState>
    </div>
  );
}
