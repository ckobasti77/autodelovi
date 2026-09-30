"use client";

import { PrinterIcon } from "@phosphor-icons/react/dist/ssr";

import { Button } from "@/components/ui/Button";

export function PrintButton() {
  return (
    <Button variant="primary" icon={<PrinterIcon size={20} />} onClick={() => window.print()}>
      Štampaj predračun
    </Button>
  );
}
