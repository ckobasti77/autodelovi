"use client";

/**
 * „Sačuvaj u omiljeno“ toggle (product page buy box, favorites list). Signed-in viewers only;
 * anonymous visitors see nothing (favorites live on the account).
 */
import { useMutation, useQuery } from "convex/react";
import { useState } from "react";
import { StarIcon } from "@phosphor-icons/react/dist/ssr";

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useViewer } from "@/lib/auth/useViewer";
import { cn } from "@/lib/cn";
import { convexErrorMessage } from "@/lib/i18n/sr/shop";
import { toast } from "@/components/ui/Toast";
import { TEST_IDS } from "@/constants/testIds";

export function FavoriteButton({
  productId,
  productName,
  className,
}: {
  productId: string;
  productName: string;
  className?: string;
}) {
  const viewer = useViewer();
  const ids = useQuery(
    api.account.favoriteIds,
    viewer ? { productIds: [productId as Id<"products">] } : "skip",
  );
  const toggle = useMutation(api.account.toggleFavorite);
  const [busy, setBusy] = useState(false);
  if (!viewer || ids === undefined) return null;
  const on = ids.includes(productId as Id<"products">);
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={busy}
      data-testid={TEST_IDS.favoriteToggle}
      onClick={async () => {
        setBusy(true);
        try {
          const r = await toggle({ productId: productId as Id<"products"> });
          toast.success(r.favorite ? "Sačuvano u omiljeno." : "Uklonjeno iz omiljenog.");
        } catch (error) {
          toast.error(convexErrorMessage(error, "Izmena nije sačuvana."));
        } finally {
          setBusy(false);
        }
      }}
      className={cn(
        "inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-xs px-2 type-body-s font-medium transition-control disabled:cursor-wait",
        on ? "text-accent-text" : "text-ink-2 hover:text-ink-1",
        className,
      )}
    >
      <StarIcon size={20} weight={on ? "fill" : "regular"} aria-hidden="true" />
      {/* One inline run, so the name is „Sačuvaj u omiljeno: …“ without a space before the
          colon (separate flex children are joined with a space; A11Y-19). */}
      <span>
        {on ? "U omiljenom" : "Sačuvaj u omiljeno"}
        <span className="sr-only">: {productName}</span>
      </span>
    </button>
  );
}
