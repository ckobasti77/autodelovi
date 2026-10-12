import type { Metadata } from "next";

import {
  BareShell,
  NOT_FOUND_TITLE,
  NotFoundContent,
  NotFoundSearchForm,
} from "@/components/shell/NotFoundContent";
import { privateMetadata } from "@/lib/seo/metadata";

export const metadata: Metadata = privateMetadata(NOT_FOUND_TITLE);

/**
 * Global 404 for URLs no route matches (server-rendered with status 404) and the fallback for
 * route groups without their own not-found (the ads landing, the admin). Deliberately
 * server-only and light: Next lists this file in every route's client manifest and serializes it
 * into every RSC payload, so it must not pull in the shop header's client islands (PERF-13, D266).
 */
export default function NotFound() {
  return (
    <BareShell>
      <NotFoundContent code="404" search={<NotFoundSearchForm />} />
    </BareShell>
  );
}
