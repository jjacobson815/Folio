import { isThemeId, type ThemeId } from "@/lib/themes";

export type PreviewDevice = "desktop" | "tablet" | "mobile";

export const SPLIT_LIMITS = { min: 0.28, max: 0.72, initial: 0.42 } as const;

export function clampSplitRatio(ratio: number): number {
  return Math.min(SPLIT_LIMITS.max, Math.max(SPLIT_LIMITS.min, ratio));
}

/**
 * Workspace chrome settings. They are tiny and needed synchronously at startup, so they stay in localStorage;
 * résumé documents live in IndexedDB (see ./indexed-db.ts).
 */
export interface Preferences {
  theme: ThemeId;
  device: PreviewDevice;
  /** Editor share of the desktop split view (0–1). */
  splitRatio: number;
}

export const DEFAULT_PREFERENCES: Preferences = { theme: "glass", device: "desktop", splitRatio: SPLIT_LIMITS.initial };

const KEY = "folio-prefs";
/** Stored as `{ version, value }`. Bump when the shape changes and translate older payloads in readPreferences. */
const VERSION = 1;
const DEVICES: readonly PreviewDevice[] = ["desktop", "tablet", "mobile"];

/** Keeps only well-formed fields, so anything malformed falls back to its default instead of breaking startup. */
export function sanitizePreferences(value: unknown): Partial<Preferences> {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  const result: Partial<Preferences> = {};
  if (isThemeId(record.theme)) result.theme = record.theme;
  if (DEVICES.includes(record.device as PreviewDevice)) result.device = record.device as PreviewDevice;
  if (typeof record.splitRatio === "number" && Number.isFinite(record.splitRatio)) result.splitRatio = clampSplitRatio(record.splitRatio);
  return result;
}

/** localStorage, or null when the browser blocks it (in some sandboxed contexts the getter itself throws). */
export function browserStorage(): Storage | null {
  try {
    return typeof window === "undefined" ? null : window.localStorage;
  } catch {
    return null;
  }
}

export function readPreferences(storage: Storage | null): Partial<Preferences> {
  try {
    const raw = storage?.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return sanitizePreferences(typeof parsed === "object" && parsed !== null ? (parsed as { value?: unknown }).value : null);
  } catch {
    return {};
  }
}

export function writePreferences(storage: Storage | null, preferences: Preferences): void {
  try {
    storage?.setItem(KEY, JSON.stringify({ version: VERSION, value: preferences }));
  } catch {
    // Best effort: losing a theme or split position is harmless, and quota errors must not break the editor.
  }
}
