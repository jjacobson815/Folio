import type { FormatPreference } from "@/parser";
import { isFormatPreference } from "./documents";
import { sanitizePreferences, type Preferences } from "./preferences";

/** localStorage key of the pre-IndexedDB build, which kept the whole workspace in one zustand `persist` blob. */
export const LEGACY_KEY = "folio-studio";

export interface LegacyWorkspace {
  source: string | null;
  formatPreference: FormatPreference;
  preferences: Partial<Preferences>;
}

/** Reads the old blob. Absent or unreadable data returns null; corrupt data is left in place, never deleted. */
export function readLegacyWorkspace(storage: Storage | null): LegacyWorkspace | null {
  try {
    const raw = storage?.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    const state = typeof parsed === "object" && parsed !== null ? (parsed as { state?: unknown }).state : null;
    if (typeof state !== "object" || state === null) return null;
    const record = state as Record<string, unknown>;
    return {
      source: typeof record.source === "string" ? record.source : null,
      formatPreference: isFormatPreference(record.formatPreference) ? record.formatPreference : "auto",
      preferences: sanitizePreferences(record),
    };
  } catch {
    return null;
  }
}

/** Called only after the legacy résumé has been written to IndexedDB, so a failed import never loses it. */
export function clearLegacyWorkspace(storage: Storage | null): void {
  try {
    storage?.removeItem(LEGACY_KEY);
  } catch {
    // Storage blocked: nothing we can clean up, and the data stays readable for the next attempt.
  }
}
