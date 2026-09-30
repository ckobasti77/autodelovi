/**
 * `{{key}}` / `{{key|fallback}}` placeholders in content Markdown (convex/seedData/content.ts).
 * A line with a required placeholder whose value is empty is removed, so an unfilled PIB
 * never shows as „PIB: “. No visible placeholder text ever reaches the page.
 */
const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*(?:\|([^}]*))?\}\}/g;

export function fillPlaceholders(md: string, values: Record<string, string>): string {
  const lines = md.split("\n");
  const out: string[] = [];
  for (const line of lines) {
    let drop = false;
    const filled = line.replace(TOKEN, (_, key: string, fallback: string | undefined) => {
      const value = values[key]?.trim();
      if (value) return value;
      if (fallback !== undefined) return fallback.trim();
      drop = true;
      return "";
    });
    if (!drop) out.push(filled);
  }
  return out.join("\n");
}
