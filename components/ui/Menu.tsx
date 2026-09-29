"use client";

import { DropdownMenu } from "radix-ui";
import { useRef, type ReactNode } from "react";
import { CheckIcon } from "@phosphor-icons/react/dist/ssr";

import { cn } from "@/lib/cn";
import { gsap, prefersReducedMotion, useGSAP } from "@/lib/gsap/client";
import { DISTANCE, DUR, EASE } from "@/constants/motion";

export type MenuItem =
  | {
      type?: "item";
      label: ReactNode;
      onSelect?: () => void;
      href?: string;
      icon?: ReactNode;
      danger?: boolean;
      disabled?: boolean;
    }
  | {
      type: "checkbox";
      label: ReactNode;
      checked: boolean;
      onCheckedChange: (checked: boolean) => void;
      disabled?: boolean;
    }
  | { type: "separator" }
  | { type: "label"; label: ReactNode };

const itemClasses =
  "flex min-h-10 cursor-pointer select-none items-center gap-2.5 rounded-xs px-2.5 type-body-s text-ink-1 outline-none data-[highlighted]:bg-surface-4 data-[disabled]:cursor-not-allowed data-[disabled]:text-ink-4";

function MenuContent({ children, align }: { children: ReactNode; align: "start" | "end" }) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: prefersReducedMotion() ? 0 : -DISTANCE.ui / 2 },
        { opacity: 1, y: 0, duration: prefersReducedMotion() ? 0 : DUR.base, ease: EASE.out },
      );
    },
    { scope: ref },
  );
  return (
    <DropdownMenu.Content
      ref={ref}
      align={align}
      sideOffset={6}
      collisionPadding={8}
      className="z-dropdown min-w-56 rounded-md border border-edge-overlay bg-surface-3 p-1 shadow-overlay"
    >
      {children}
    </DropdownMenu.Content>
  );
}

/**
 * Menu (Radix DropdownMenu, level-3 popover): row actions, account menu, column visibility.
 * Grows from its trigger (4 px, 220 ms sk.out); typeahead and arrow keys from Radix.
 */
export function Menu({
  trigger,
  items,
  align = "end",
}: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: "start" | "end";
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <MenuContent align={align}>
          {items.map((item, index) => {
            if (item.type === "separator")
              return <DropdownMenu.Separator key={index} className="my-1 h-px bg-line" />;
            if (item.type === "label")
              return (
                <DropdownMenu.Label key={index} className="px-2.5 pb-1 pt-2 type-label text-ink-3">
                  {item.label}
                </DropdownMenu.Label>
              );
            if (item.type === "checkbox")
              return (
                <DropdownMenu.CheckboxItem
                  key={index}
                  checked={item.checked}
                  onCheckedChange={item.onCheckedChange}
                  disabled={item.disabled}
                  onSelect={(event) => event.preventDefault()}
                  className={itemClasses}
                >
                  <span className="inline-flex size-4 items-center justify-center text-accent-text">
                    <DropdownMenu.ItemIndicator>
                      <CheckIcon size={16} weight="bold" aria-hidden="true" />
                    </DropdownMenu.ItemIndicator>
                  </span>
                  {item.label}
                </DropdownMenu.CheckboxItem>
              );
            const content = (
              <>
                {item.icon ? (
                  <span aria-hidden="true" className="inline-flex text-ink-2">
                    {item.icon}
                  </span>
                ) : null}
                {item.label}
              </>
            );
            return item.href ? (
              <DropdownMenu.Item
                key={index}
                asChild
                disabled={item.disabled}
                className={cn(itemClasses, item.danger && "text-danger")}
              >
                <a href={item.href}>{content}</a>
              </DropdownMenu.Item>
            ) : (
              <DropdownMenu.Item
                key={index}
                disabled={item.disabled}
                onSelect={item.onSelect}
                className={cn(itemClasses, item.danger && "text-danger")}
              >
                {content}
              </DropdownMenu.Item>
            );
          })}
        </MenuContent>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
