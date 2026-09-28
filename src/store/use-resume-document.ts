"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { parseResume, type ParseResult } from "@/parser";
import { usePortfolioStore } from "./portfolio-store";
import { bootWorkspace } from "./workspace";

export interface ResumeDocument {
  result: ParseResult;
  /** The source text `result` was parsed from (lags the editor while a newer keystroke is pending). */
  parsedSource: string;
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
  return { result, parsedSource: deferredSource, isStale: deferredSource !== source || deferredPreference !== preference };
}

/**
 * Boots the workspace after the first client render and reports when it is ready. The server and the
 * client's hydration pass both render the loading state, so markup always matches. Boot falls back to
 * in-memory documents rather than failing; anything unexpected is rethrown here to reach the error boundary.
 */
export function useWorkspaceReady(): boolean {
  const ready = usePortfolioStore((state) => state.status === "ready");
  const [failure, setFailure] = useState<{ error: unknown } | null>(null);
  useEffect(() => {
    bootWorkspace().catch((error: unknown) => setFailure({ error }));
  }, []);
  if (failure) throw failure.error;
  return ready;
}
