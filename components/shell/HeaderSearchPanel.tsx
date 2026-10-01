"use client";

import { Dialog } from "@/components/ui/Dialog";
import { SearchBox } from "@/components/shell/SearchBox";
import { TEST_IDS } from "@/constants/testIds";

/**
 * The header search dialog body (top-anchored Dialog + OEM SearchBox). Loaded on intent by
 * `HeaderSearch` (PERF-01/PERF-11): radix Dialog, the combobox and its Convex hooks stay out
 * of the first load of every page.
 */
export function HeaderSearchPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title="Pretraga delova" position="top" size="md">
      <SearchBox
        variant="header"
        autoFocus
        testId={TEST_IDS.headerSearchInput}
        inlineResults
        onNavigate={() => onOpenChange(false)}
      />
      <p className="mt-3 type-caption font-normal text-ink-3">
        Broj upišite kako god ga imate&nbsp;— razmaci, tačke i crtice ne smetaju.
      </p>
    </Dialog>
  );
}
