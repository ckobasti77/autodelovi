import { cn } from "@/lib/cn";

export type SpinnerProps = {
  size?: 16 | 20;
  /** When set, the spinner is announced (role="status"); otherwise it is decorative. */
  label?: string;
  className?: string;
};

/** 2 px ring in currentColor, 800 ms linear — the only looping motion in the UI (§9.22). */
export function Spinner({ size = 16, label, className }: SpinnerProps) {
  return (
    <span
      role={label ? "status" : undefined}
      aria-hidden={label ? undefined : true}
      className={cn("inline-flex shrink-0", className)}
      data-reveal="off"
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 16 16"
        fill="none"
        className="animate-spin"
        focusable="false"
        aria-hidden="true"
      >
        <circle cx="8" cy="8" r="6.5" stroke="currentColor" strokeOpacity="0.28" strokeWidth="2" />
        <path
          d="M8 1.5A6.5 6.5 0 0 1 14.5 8"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
      {label ? <span className="sr-only">{label}</span> : null}
    </span>
  );
}
