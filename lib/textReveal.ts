/**
 * Word splitting for the text reveal (see .claude/rules/architecture.md → „Text Reveal“).
 *
 * `splitWords` MOVES each original text node into the first word span of its run and
 * creates new nodes only for the remaining words — it never clones — so React keeps the
 * handle to the text node it owns. `restoreWords` puts every original node back where it
 * was, with its original value, and removes everything the split created.
 *
 * Components that own their reveal timing (opted out with data-reveal="off") must use these
 * two functions instead of a local splitter.
 */
import { TEXT_REVEAL } from "@/constants/textRevealConfig";

type SplitRecord = {
  /** The original text node (moved, never cloned). */
  node: Text;
  /** Its value before splitting. */
  original: string;
  /** The first token the original node holds while split. */
  firstToken: string;
  /** Nodes inserted in place of the original, in document order (spans and whitespace). */
  inserted: Node[];
};

const records = new WeakMap<Element, SplitRecord[]>();

/** Subtrees whose text is never split (their text still fades with the parent). */
const NO_SPLIT =
  'script, style, noscript, template, svg, math, textarea, input, select, button, [data-reveal="off"], .sr-only';

/** Breaking whitespace only — a no-break space keeps „12.990 RSD“ inside one word span. */
const BREAKING_SPACE = /([ \t\n\r\f]+)/;
const WHITESPACE = /^[ \t\n\r\f]+$/;

export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

function collectTextNodes(root: Element): Text[] {
  const doc = root.ownerDocument;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (node.nodeType === Node.ELEMENT_NODE) {
        return (node as Element).matches(NO_SPLIT)
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_SKIP;
      }
      return (node as Text).data.trim() ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  const nodes: Text[] = [];
  for (let n = walker.nextNode(); n; n = walker.nextNode()) nodes.push(n as Text);
  return nodes;
}

/**
 * True when some text of `root` sits directly in a flex or grid container — word spans would
 * become flex/grid items there (every gap lands between words), so the element must fade as
 * a block instead.
 */
export function hasFlexOrGridText(root: Element): boolean {
  const view = root.ownerDocument.defaultView;
  if (!view) return false;
  for (const node of collectTextNodes(root)) {
    const parent = node.parentElement;
    if (!parent) continue;
    const display = view.getComputedStyle(parent).display;
    if (display.includes("flex") || display.includes("grid")) return true;
  }
  return false;
}

/**
 * Split every text node of `root` into `span.reveal-word` elements (whitespace stays as text
 * so lines still break naturally). Returns the word spans in document order. Calling it on an
 * already split element returns its existing spans.
 */
export function splitWords(root: Element): HTMLElement[] {
  const existing = records.get(root);
  if (existing) return wordSpans(existing);

  const doc = root.ownerDocument;
  const list: SplitRecord[] = [];

  for (const node of collectTextNodes(root)) {
    const parent = node.parentNode;
    if (!parent) continue;
    const original = node.data;
    const tokens = original.split(BREAKING_SPACE).filter((token) => token.length > 0);
    if (tokens.length === 0) continue;

    const next = node.nextSibling;
    const inserted: Node[] = [];
    tokens.forEach((token, index) => {
      let textNode: Text;
      if (index === 0) {
        node.data = token;
        textNode = node;
      } else {
        textNode = doc.createTextNode(token);
      }
      if (WHITESPACE.test(token)) {
        inserted.push(textNode);
        parent.insertBefore(textNode, next);
        return;
      }
      const span = doc.createElement("span");
      span.className = TEXT_REVEAL.classes.word;
      span.appendChild(textNode); // moves the original node on the first token
      inserted.push(span);
      parent.insertBefore(span, next);
    });

    list.push({ node, original, firstToken: tokens[0] ?? "", inserted });
  }

  records.set(root, list);
  root.setAttribute(TEXT_REVEAL.attrs.split, "");
  return wordSpans(list);
}

function wordSpans(list: SplitRecord[]): HTMLElement[] {
  const spans: HTMLElement[] = [];
  for (const record of list) {
    for (const node of record.inserted) {
      if (node.nodeType === Node.ELEMENT_NODE) spans.push(node as HTMLElement);
    }
  }
  return spans;
}

/** Undo `splitWords`: original text nodes back in place, created nodes removed. Safe to call twice. */
export function restoreWords(root: Element): void {
  const list = records.get(root);
  if (!list) return;
  records.delete(root);

  for (const record of list) {
    const { node, original, firstToken, inserted } = record;
    const anchor = inserted[0];
    const parent = anchor?.parentNode;
    if (anchor && parent && anchor !== node) parent.insertBefore(node, anchor);
    // If React rewrote the node while it was split, keep React's value.
    if (node.data === firstToken) node.data = original;
    for (const created of inserted) {
      if (created !== node && created.parentNode) created.parentNode.removeChild(created);
    }
  }
  root.removeAttribute(TEXT_REVEAL.attrs.split);
}

export function isSplit(root: Element): boolean {
  return records.has(root);
}

/* ── Deterministic shuffle for the server-rendered (LCP-safe) variant ─────────────── */

/** FNV-1a 32-bit hash — stable across server and client. */
export function hashText(text: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** mulberry32 PRNG seeded with a 32-bit integer. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Returns, for each of `count` words, its position in a shuffled order seeded by `seedText`
 * (a permutation of 0…count-1). Same text → same order on the server and in tests.
 */
export function shuffledOrder(count: number, seedText: string): number[] {
  const order = Array.from({ length: count }, (_, i) => i);
  const random = mulberry32(hashText(seedText));
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [order[i], order[j]] = [order[j] as number, order[i] as number];
  }
  return order;
}
