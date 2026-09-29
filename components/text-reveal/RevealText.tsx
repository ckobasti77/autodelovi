/**
 * LCP-safe text reveal for above-the-fold copy (DESIGN-SYSTEM §8.6, ARCHITECTURE §G6).
 *
 * Server Component: the words are split during server rendering into `span.rw` with a
 * deterministic shuffled index `--i` (seeded by the text) and the word count `--n`; a pure
 * CSS keyframe (inlined by the root layout) starts at first paint from a readable frame
 * (opacity .35 + blur), so neither hydration nor JS delays the Largest Contentful Paint.
 * The wrapper opts out of the site-wide pass (`data-reveal="off"`). Reduced motion and
 * print show the text without animation.
 *
 * Use for the hero statement, page H1 and intro on the first screen. Everything below the
 * fold is handled by TextRevealGlobal automatically — never add another text entrance.
 */
import { Fragment, type CSSProperties, type HTMLAttributes } from "react";

import { TEXT_REVEAL } from "@/constants/textRevealConfig";
import { shuffledOrder } from "@/lib/textReveal";

type RevealTag = "h1" | "h2" | "h3" | "p" | "span" | "div";

type CustomProperties = CSSProperties & Record<`--${string}`, string | number>;

export type RevealTextProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  as?: RevealTag;
  /** Plain text only — the split needs a string. A newline forces a line break. */
  children: string;
};

export function RevealText({ as: Tag = "p", children, style, ...rest }: RevealTextProps) {
  const lines = children
    .split("\n")
    // Collapse breaking whitespace only; no-break spaces (U+00A0) stay inside their word.
    .map((line) => line.replace(/[ \t\r\f]+/g, " ").trim())
    .filter(Boolean);
  const text = lines.join(" ");
  const words = text ? text.split(" ") : [];
  const order = shuffledOrder(words.length, text);
  // Index of the first word of every line after the first: a <br> goes before it.
  const breaks = new Set<number>();
  let seen = 0;
  lines.forEach((line, index) => {
    if (index > 0) breaks.add(seen);
    seen += line.split(" ").length;
  });
  const wrapperStyle: CustomProperties = { ...style, "--n": Math.max(words.length, 1) };

  return (
    <Tag {...rest} data-reveal="off" style={wrapperStyle}>
      {words.map((word, index) => (
        <Fragment key={index}>
          {breaks.has(index) ? <br /> : index > 0 ? " " : null}
          <span
            className={TEXT_REVEAL.classes.lcpWord}
            style={{ "--i": order[index] ?? 0 } as CustomProperties}
          >
            {word}
          </span>
        </Fragment>
      ))}
    </Tag>
  );
}
