import { CheckIcon, XIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format/date";
import { ORDER_STATUS_LABEL, type OrderStatus } from "@/lib/i18n/sr/shop";
import { TEST_IDS } from "@/constants/testIds";

type TimelineEvent = {
  type: string;
  toStatus: OrderStatus | null;
  message: string | null;
  at: number;
};

const PATH: Record<"pickup" | "courier", OrderStatus[]> = {
  pickup: ["nova", "potvrdjena", "spremna_za_preuzimanje", "preuzeta"],
  courier: ["nova", "potvrdjena", "poslata", "isporucena"],
};

/**
 * Order timeline (§10.6): vertical, 1 px rail; done = success node with a check, current =
 * accent ring, future = hairline node. Cancelled and „čeka deo“ appear where they happened.
 */
export function OrderTimeline({
  status,
  deliveryMethod,
  createdAt,
  events,
}: {
  status: OrderStatus;
  deliveryMethod: "pickup" | "courier";
  createdAt: number;
  events: TimelineEvent[];
}) {
  const reachedAt = new Map<OrderStatus, number>([["nova", createdAt]]);
  for (const e of events)
    if (e.toStatus && !reachedAt.has(e.toStatus)) reachedAt.set(e.toStatus, e.at);
  const path = PATH[deliveryMethod];
  const currentIndex =
    status === "zavrsena"
      ? path.length - 1
      : Math.max(0, path.indexOf(status === "ceka_deo" ? "potvrdjena" : status));
  const cancelled = status === "otkazana";

  const rows: {
    key: string;
    label: string;
    at?: number;
    state: "done" | "current" | "future" | "cancelled" | "waiting";
  }[] = [];
  path.forEach((s, i) => {
    const at = reachedAt.get(s);
    const state = cancelled
      ? at
        ? "done"
        : "future"
      : i < currentIndex || (i === currentIndex && (status === "zavrsena" || i === path.length - 1))
        ? "done"
        : i === currentIndex
          ? "current"
          : "future";
    rows.push({ key: s, label: ORDER_STATUS_LABEL[s], at, state });
    if (s === "potvrdjena" && reachedAt.has("ceka_deo")) {
      rows.push({
        key: "ceka_deo",
        label: ORDER_STATUS_LABEL.ceka_deo,
        at: reachedAt.get("ceka_deo"),
        state: status === "ceka_deo" ? "waiting" : "done",
      });
    }
  });
  if (cancelled) {
    const lastDone = rows.map((r) => r.state).lastIndexOf("done");
    rows.splice(lastDone + 1, 0, {
      key: "otkazana",
      label: ORDER_STATUS_LABEL.otkazana,
      at: reachedAt.get("otkazana"),
      state: "cancelled",
    });
  }

  return (
    <ol data-testid={TEST_IDS.orderTimeline} className="relative flex flex-col" data-reveal="off">
      {rows.map((row, i) => (
        <li key={row.key} className="relative flex gap-4 pb-6 last:pb-0">
          {i < rows.length - 1 ? (
            <span
              aria-hidden="true"
              className="absolute top-4 left-[7px] h-[calc(100%-0.5rem)] w-px bg-line-strong"
            />
          ) : null}
          <span
            aria-hidden="true"
            className={cn(
              "relative mt-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full border",
              row.state === "done" && "border-success bg-success text-bg",
              row.state === "current" && "border-2 border-accent bg-bg",
              row.state === "waiting" && "border-2 border-warning bg-bg",
              row.state === "future" && "border-line-strong bg-bg",
              row.state === "cancelled" && "border-danger bg-danger text-bg",
            )}
          >
            {row.state === "done" ? <CheckIcon size={10} weight="bold" /> : null}
            {row.state === "cancelled" ? <XIcon size={10} weight="bold" /> : null}
          </span>
          <div className="flex flex-col">
            <span
              className={cn(
                "type-body-s font-semibold",
                row.state === "future" ? "text-ink-3" : "text-ink-1",
              )}
              aria-current={row.state === "current" || row.state === "waiting" ? "step" : undefined}
            >
              {row.label}
              <span className="sr-only">
                {row.state === "done"
                  ? " — završeno"
                  : row.state === "current"
                    ? " — trenutno"
                    : row.state === "future"
                      ? " — čeka"
                      : ""}
              </span>
            </span>
            {row.at ? (
              <span className="type-caption font-normal tabular-nums text-ink-3">
                {formatDateTime(row.at)}
              </span>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}
