"use client";

import { useState } from "react";
import { ArrowCounterClockwiseIcon, CheckCircleIcon } from "@phosphor-icons/react/dist/ssr";

import { RevealText } from "@/components/text-reveal/RevealText";
import { Button } from "@/components/ui/Button";

/** Replays the LCP-safe variant by remounting it (the CSS keyframes restart). */
export function LcpRevealDemo() {
  const [run, setRun] = useState(0);
  return (
    <div className="flex flex-col gap-5 rounded-md border border-line p-6">
      <div key={run} className="flex flex-col gap-3">
        <RevealText as="p" className="type-display-xl text-ink-1">
          {"Rasklopi\nauto."}
        </RevealText>
        <RevealText as="p" className="max-w-[42ch] type-lead text-ink-2">
          Reči su podeljene na serveru; prvi kadar je čitljiv, pa LCP ne čeka hidrataciju.
        </RevealText>
      </div>
      <Button
        variant="secondary"
        size="sm"
        className="self-start"
        icon={<ArrowCounterClockwiseIcon size={16} />}
        onClick={() => setRun((n) => n + 1)}
      >
        Ponovi
      </Button>
    </div>
  );
}

/** Copy inside a flex row: the global reveal fades it as a block (word spans would become flex items). */
export function FlexLineSample() {
  return (
    <p className="flex items-center gap-2 type-body text-ink-2">
      <CheckCircleIcon size={18} aria-hidden="true" className="shrink-0 text-success" />
      Red u flex kutiji se otkriva kao celina, bez razmaka između reči.
    </p>
  );
}
