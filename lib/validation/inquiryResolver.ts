/**
 * The inquiry form's resolver, imported on demand by `InquiryForm` (see `lazyResolver`): zod and
 * the schema are ~30 KB gzip that /upit would otherwise download and evaluate while hydrating
 * (PERF-01).
 */
import { zodResolver } from "@hookform/resolvers/zod";

import { inquirySchema } from "@/lib/validation/inquiry";

export const inquiryResolver = zodResolver(inquirySchema);
