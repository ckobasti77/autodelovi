import { TEST_IDS } from "@/constants/testIds";

export const MAIN_ID = "sadrzaj";

/** Skip link (§9.22): first focusable element, appears top-left on focus, z 100. */
export function SkipLink() {
  return (
    <a
      href={`#${MAIN_ID}`}
      data-testid={TEST_IDS.skipLink}
      className="fixed left-3 top-3 z-skip -translate-y-[200%] rounded-sm bg-accent px-4 py-3 type-button text-on-accent focus-ring-inverse focus:translate-y-0"
    >
      Preskoči na sadržaj
    </a>
  );
}
