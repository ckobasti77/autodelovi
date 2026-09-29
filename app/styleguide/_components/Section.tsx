import type { ReactNode } from "react";

import { cn } from "@/lib/cn";

export function Section({
  id,
  title,
  intro,
  children,
  className,
}: {
  id: string;
  title: string;
  intro?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className={cn("scroll-mt-24 border-t border-line py-14 first:border-t-0", className)}
    >
      <h2 id={`${id}-title`} className="type-display-l text-ink-1">
        {title}
      </h2>
      {intro ? <p className="mt-3 max-w-[70ch] type-body text-ink-2">{intro}</p> : null}
      <div className="mt-10 flex flex-col gap-12">{children}</div>
    </section>
  );
}

export function Group({
  title,
  note,
  children,
  className,
  id,
}: {
  title: string;
  note?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <div id={id} className={cn("flex flex-col gap-5", className)}>
      <div className="flex flex-col gap-1">
        <h3 className="type-h3 text-ink-1">{title}</h3>
        {note ? <p className="max-w-[70ch] type-body-s text-ink-3">{note}</p> : null}
      </div>
      {children}
    </div>
  );
}

/** A labelled specimen cell: the thing, then its name/spec underneath. */
export function Specimen({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <figure className={cn("flex flex-col gap-2", className)}>
      <div className="flex min-h-11 flex-wrap items-center gap-3">{children}</div>
      <figcaption className="type-code-s normal-case text-ink-3">{label}</figcaption>
    </figure>
  );
}
