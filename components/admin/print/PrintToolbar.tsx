"use client";

import { useRouter } from "next/navigation";
import { ArrowLeftIcon, PrinterIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/Button";

/** Back + print, hidden on paper. */
export function PrintToolbar() {
  const router = useRouter();
  return (
    <div className="flex items-center justify-between gap-3 print:hidden">
      <Button
        variant="ghost"
        size="sm"
        icon={<ArrowLeftIcon size={16} />}
        onClick={() => (history.length > 1 ? router.back() : window.close())}
      >
        Nazad
      </Button>
      <Button icon={<PrinterIcon size={20} />} onClick={() => window.print()}>
        Štampaj
      </Button>
    </div>
  );
}
