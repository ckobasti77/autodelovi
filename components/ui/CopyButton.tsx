"use client";

import { useEffect, useRef, useState } from "react";
import { CheckIcon, CopyIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { toast } from "@/components/ui/Toast";

async function writeClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for insecure contexts / older browsers.
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  }
}

export type CopyButtonProps = {
  value: string;
  /** Accessible name, e.g. „Kopiraj OEM broj 1K0 615 301 AA“. */
  label: string;
  /** Toast shown after copying (§8.5: „OEM broj kopiran“). */
  toastMessage?: string;
  /** Show the value next to the icon (mono). */
  showValue?: boolean;
  className?: string;
};

/** Copy button (§8.5, §9.22): Copy → Check for 1.2 s plus a toast. */
export function CopyButton({
  value,
  label,
  toastMessage = "Kopirano",
  showValue = false,
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const onClick = async () => {
    const ok = await writeClipboard(value);
    if (!ok) {
      toast.error("Kopiranje nije uspelo", { description: "Označite broj i kopirajte ga ručno." });
      return;
    }
    setCopied(true);
    toast.success(toastMessage);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={showValue ? undefined : label}
      title={showValue ? label : undefined}
      className={cn(
        "inline-flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-2 rounded-xs px-2 text-ink-2 transition-control hover:bg-surface-2 hover:text-ink-1 active:translate-y-px",
        className,
      )}
    >
      {showValue ? <span className="type-code-l text-ink-1">{value}</span> : null}
      <span aria-hidden="true" className={cn("inline-flex", copied && "text-success")}>
        {copied ? <CheckIcon size={18} weight="bold" /> : <CopyIcon size={18} />}
      </span>
      {showValue ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}
