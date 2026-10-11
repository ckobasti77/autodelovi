/**
 * Block reveal primitives (DESIGN-SYSTEM §8.8, .claude/rules/architecture.md → „Reveal“).
 *
 * Server Components that only write attributes; the one engine in the root layout
 * (TextRevealGlobal) does the work. Copy needs none of this — headings and paragraphs arrive
 * word by word on their own. Use these for what is not copy:
 *
 *   <Reveal>…a CTA block, an image, a form group…</Reveal>
 *
 *   <RevealGroup as="ul" className="grid …">          // children enter as a staggered batch
 *     {items.map((item, i) => (
 *       <RevealItem as="li" key={item.id} index={i} eager={i < 4}>…</RevealItem>
 *     ))}
 *   </RevealGroup>
 *
 * The same thing as attributes, where a wrapper element is not wanted:
 * `data-reveal="block"` on one element, `data-reveal-group` on a container (its direct children
 * are the items), `data-reveal-eager` on a block or item that is on the first screen.
 *
 * Rules:
 * - Mark the thing that moves and never nest: a block inside a block is not revealed twice, and
 *   copy inside a block arrives with the block (no word split).
 * - Everything on the first screen is `eager`: a CSS-only entrance from a visible frame, so the
 *   LCP element is never hidden. Everything else is hidden until its centre crosses the line.
 * - Never on chrome (header, dialogs, menus, toasts) and never on an element GSAP transforms.
 */
import type { CSSProperties, HTMLAttributes, ReactNode } from "react";

import { BLOCK_REVEAL } from "@/constants/revealConfig";

type RevealTag =
  "div" | "section" | "article" | "aside" | "header" | "footer" | "ul" | "ol" | "li" | "dl" | "figure" | "nav" | "span" | "p";

type CustomProperties = CSSProperties & Record<`--${string}`, string | number>;

type BaseProps = Omit<HTMLAttributes<HTMLElement>, "children"> & {
  as?: RevealTag;
  children?: ReactNode;
};

export type RevealProps = BaseProps & {
  /** On the first screen: CSS-only entrance from a visible frame (never hidden, LCP-safe). */
  eager?: boolean;
  /** Position in an eager sequence: delays the entrance by `index` steps. */
  index?: number;
  /** `fade` drops the lift (wide tables, panels). */
  variant?: "rise" | "fade";
};

function eagerDelay(index: number | undefined): CustomProperties | undefined {
  if (!index || index <= 0) return undefined;
  const { stepMs, budgetMs } = BLOCK_REVEAL.eager;
  // An eager sequence is short by definition; the budget caps a long one.
  return { [BLOCK_REVEAL.delayVar]: `${Math.min(index * stepMs, budgetMs)}ms` };
}

/** One block that enters once when its centre crosses the reveal line. */
export function Reveal({
  as = "div",
  eager = false,
  index,
  variant = "rise",
  style,
  children,
  ...rest
}: RevealProps) {
  // Every allowed tag takes the same HTML attributes; typing it as one keeps the JSX simple.
  const Tag = as as "div";
  const attributes = {
    "data-reveal": "block",
    ...(eager ? { [BLOCK_REVEAL.attrs.eager]: "" } : {}),
    ...(variant === "fade" ? { [BLOCK_REVEAL.attrs.variant]: "fade" } : {}),
  };
  return (
    <Tag {...rest} {...attributes} style={eager ? { ...style, ...eagerDelay(index) } : style}>
      {children}
    </Tag>
  );
}

export type RevealGroupProps = BaseProps;

/**
 * A container whose direct children enter as one staggered batch (row by row in a grid). The
 * children may be plain elements; use `RevealItem` when the first ones are on the first screen.
 */
export function RevealGroup({ as = "div", children, ...rest }: RevealGroupProps) {
  const Tag = as as "div";
  return (
    <Tag {...rest} {...{ [BLOCK_REVEAL.attrs.group]: "" }}>
      {children}
    </Tag>
  );
}

export type RevealItemProps = BaseProps & {
  /** On the first screen: CSS-only entrance from a visible frame (never hidden, LCP-safe). */
  eager?: boolean;
  /** Position among the eager items: delays the entrance by `index` steps. */
  index?: number;
};

/** A direct child of `RevealGroup`. Only needed to mark the first items `eager`. */
export function RevealItem({
  as = "div",
  eager = false,
  index,
  style,
  children,
  ...rest
}: RevealItemProps) {
  const Tag = as as "div";
  return (
    <Tag
      {...rest}
      {...(eager ? { [BLOCK_REVEAL.attrs.eager]: "" } : {})}
      style={eager ? { ...style, ...eagerDelay(index) } : style}
    >
      {children}
    </Tag>
  );
}
