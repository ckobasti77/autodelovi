"use client";

/**
 * Unsaved settings drafts (QA FLOW-14). Each tab's drafts live in components that unmount
 * with the tab panel, so a tab switch would silently drop them. Every section that has
 * unsaved edits registers its save-bar message here; the settings page asks before it
 * switches tabs and the browser asks before the page unloads.
 */
import { createContext, useContext, useEffect, useId, useRef, useState } from "react";

type Registry = {
  set: (id: string, message: string | null) => void;
  /** Distinct messages of the sections with unsaved edits, in registration order. */
  pending: () => string[];
};

const UnsavedContext = createContext<Registry | null>(null);

export const UnsavedProvider = UnsavedContext.Provider;

/** Owner of the registry (the settings page): stable object + a beforeunload guard. */
export function useUnsavedRegistry(): Registry {
  const entries = useRef(new Map<string, string>());
  const [registry] = useState<Registry>(() => ({
    set: (id, message) => {
      if (message) entries.current.set(id, message);
      else entries.current.delete(id);
    },
    pending: () => [...new Set(entries.current.values())],
  }));
  useEffect(() => {
    const onUnload = (e: BeforeUnloadEvent) => {
      if (registry.pending().length > 0) e.preventDefault();
    };
    window.addEventListener("beforeunload", onUnload);
    return () => window.removeEventListener("beforeunload", onUnload);
  }, [registry]);
  return registry;
}

/** Registers `message` while it is non-null (the section has unsaved edits). */
export function useUnsavedFlag(message: string | null) {
  const registry = useContext(UnsavedContext);
  const id = useId();
  useEffect(() => {
    if (!registry) return;
    registry.set(id, message);
    return () => registry.set(id, null);
  }, [registry, id, message]);
}
