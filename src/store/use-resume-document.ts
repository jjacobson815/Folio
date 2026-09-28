"use client";

import { useDeferredValue, useEffect, useMemo, useSyncExternalStore } from "react";
import { parseResume, type ParseResult } from "@/parser";
import { usePortfolioStore } from "./portfolio-store";

export interface ResumeDocument {
  result: ParseResult;
  /** True while the preview is still showing the previous parse (a newer keystroke is pending). */
  isStale: boolean;
}

/**
 * Derives the typed resume from the raw editor text.
 *
 * `source` updates at urgent priority (the textarea stays perfectly responsive), while `useDeferredValue`
 * hands the parse + portfolio render to a background, interruptible render. `useMemo` keyed on the deferred
 * value means the urgent render reuses the previous ParseResult by reference, so memoised preview trees bail out.
 */
export function useResumeDocument(): ResumeDocument {
  const source = usePortfolioStore((state) => state.source);
  const preference = usePortfolioStore((state) => state.formatPreference);
  const deferredSource = useDeferredValue(source);
  const deferredPreference = useDeferredValue(preference);
  const result = useMemo(() => parseResume(deferredSource, deferredPreference), [deferredSource, deferredPreference]);
  return { result, isStale: deferredSource !== source || deferredPreference !== preference };
}

const subscribeToHydration = (onChange: () => void) => usePortfolioStore.persist.onFinishHydration(onChange);
const hasHydrated = () => usePortfolioStore.persist.hasHydrated();
const serverHydrated = () => false;

/**
 * Restores the persisted workspace after hydration. The server (and the client's hydration pass) render the
 * un-hydrated snapshot; the store then rehydrates from localStorage and subscribers re-render once.
 */
export function useStoreHydration(): boolean {
  const hydrated = useSyncExternalStore(subscribeToHydration, hasHydrated, serverHydrated);
  useEffect(() => {
    if (!usePortfolioStore.persist.hasHydrated()) void usePortfolioStore.persist.rehydrate();
  }, []);
  return hydrated;
}
