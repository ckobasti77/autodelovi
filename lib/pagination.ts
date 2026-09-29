export type PageToken = number | "gap";

/**
 * Page numbers to render: always the first and last page, the current page with `siblings`
 * neighbours on each side, and a gap where pages are skipped (a gap never hides a single
 * page — that page is shown instead). `paginationRange(6, 12)` → [1, "gap", 5, 6, 7, "gap", 12].
 */
export function paginationRange(current: number, total: number, siblings = 1): PageToken[] {
  if (!Number.isFinite(total) || total < 1) return [];
  const page = Math.min(Math.max(1, Math.round(current)), total);
  const start = Math.max(2, page - siblings);
  const end = Math.min(total - 1, page + siblings);

  const tokens: PageToken[] = [1];
  if (start > 3) tokens.push("gap");
  else for (let p = 2; p < start; p++) tokens.push(p);

  for (let p = start; p <= end; p++) tokens.push(p);

  if (end < total - 2) tokens.push("gap");
  else for (let p = end + 1; p < total; p++) tokens.push(p);

  if (total > 1) tokens.push(total);
  return tokens;
}
