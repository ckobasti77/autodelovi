"use client";

import { useState } from "react";
import { PlusIcon } from "@phosphor-icons/react/dist/ssr";

import { RevealGroup } from "@/components/reveal/Reveal";
import { Button } from "@/components/ui/Button";

type Item = { slug: string; name: string };

const FIRST = 2;

/** „Prikaži još“: items appended after load are picked up by the reveal engine. */
export function RevealMore({ items }: { items: Item[] }) {
  const [count, setCount] = useState(FIRST);
  const done = count >= items.length;
  return (
    <div className="flex flex-col gap-4">
      <RevealGroup
        as="ul"
        data-testid="reveal-more"
        className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-(--gutter) lg:grid-cols-4"
      >
        {items.slice(0, count).map((item) => (
          <li key={item.slug} className="rounded-md border border-line bg-surface-1 p-4">
            <h3 className="type-h4 text-ink-1">{item.name}</h3>
            <p className="type-code-s text-ink-3">{item.slug}</p>
          </li>
        ))}
      </RevealGroup>
      <Button
        variant="secondary"
        className="self-start"
        icon={<PlusIcon size={20} />}
        disabled={done}
        data-testid="reveal-more-button"
        onClick={() => setCount(items.length)}
      >
        Prikaži još
      </Button>
    </div>
  );
}
