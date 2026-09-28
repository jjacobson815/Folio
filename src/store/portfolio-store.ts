import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { DEFAULT_SAMPLE, getSample, type SampleId } from "@/lib/samples";
import { isThemeId, type ThemeId } from "@/lib/themes";
import type { FormatPreference } from "@/parser";

export type PreviewDevice = "desktop" | "tablet" | "mobile";
export type MobilePane = "editor" | "preview";

/** Snapshot taken before a destructive replace (sample load, import, clear) so it can be undone. */
export interface UndoSnapshot {
  source: string;
  formatPreference: FormatPreference;
  label: string;
  at: number;
}

/** Transient "scroll the editor to line N" request raised from diagnostics. */
export interface FocusRequest {
  line: number;
  nonce: number;
}

export interface PortfolioState {
  source: string;
  formatPreference: FormatPreference;
  theme: ThemeId;
  device: PreviewDevice;
  /** Editor share of the desktop split view (0–1). */
  splitRatio: number;
  mobilePane: MobilePane;
  undo: UndoSnapshot | null;
  focusRequest: FocusRequest | null;
}

export interface PortfolioActions {
  setSource: (source: string) => void;
  replaceSource: (source: string, label: string) => void;
  loadSample: (id: SampleId) => void;
  clearSource: () => void;
  undoReplace: () => void;
  dismissUndo: () => void;
  setFormatPreference: (format: FormatPreference) => void;
  setTheme: (theme: ThemeId) => void;
  setDevice: (device: PreviewDevice) => void;
  setSplitRatio: (ratio: number) => void;
  setMobilePane: (pane: MobilePane) => void;
  focusLine: (line: number) => void;
}

export type PortfolioStore = PortfolioState & PortfolioActions;

export const SPLIT_LIMITS = { min: 0.28, max: 0.72, initial: 0.42 } as const;

const FORMATS: readonly FormatPreference[] = ["auto", "json", "markdown", "text"];
const DEVICES: readonly PreviewDevice[] = ["desktop", "tablet", "mobile"];

const clampRatio = (ratio: number) => Math.min(SPLIT_LIMITS.max, Math.max(SPLIT_LIMITS.min, ratio));

type PersistedState = Pick<PortfolioState, "source" | "formatPreference" | "theme" | "device" | "splitRatio">;

/** Defensive merge: anything malformed in localStorage falls back to the in-memory default. */
function sanitizePersisted(value: unknown): Partial<PersistedState> {
  if (typeof value !== "object" || value === null) return {};
  const record = value as Record<string, unknown>;
  const result: Partial<PersistedState> = {};
  if (typeof record.source === "string") result.source = record.source;
  if (FORMATS.includes(record.formatPreference as FormatPreference)) result.formatPreference = record.formatPreference as FormatPreference;
  if (isThemeId(record.theme)) result.theme = record.theme;
  if (DEVICES.includes(record.device as PreviewDevice)) result.device = record.device as PreviewDevice;
  if (typeof record.splitRatio === "number" && Number.isFinite(record.splitRatio)) result.splitRatio = clampRatio(record.splitRatio);
  return result;
}

/**
 * Single global store. The raw `source` string is the only document state; the parsed resume is derived
 * (see use-resume-document.ts) so there is exactly one source of truth and nothing to keep in sync.
 */
export const usePortfolioStore = create<PortfolioStore>()(
  persist(
    (set, get) => ({
      source: DEFAULT_SAMPLE,
      formatPreference: "auto",
      theme: "glass",
      device: "desktop",
      splitRatio: SPLIT_LIMITS.initial,
      mobilePane: "editor",
      undo: null,
      focusRequest: null,

      setSource: (source) => set({ source }),
      replaceSource: (source, label) => {
        const { source: previous, formatPreference } = get();
        set({
          source,
          formatPreference: "auto",
          undo: previous.trim() && previous !== source ? { source: previous, formatPreference, label, at: Date.now() } : null,
        });
      },
      loadSample: (id) => {
        const sample = getSample(id);
        get().replaceSource(sample.source, `Loaded ${sample.label}`);
      },
      clearSource: () => get().replaceSource("", "Editor cleared"),
      undoReplace: () => {
        const { undo } = get();
        if (undo) set({ source: undo.source, formatPreference: undo.formatPreference, undo: null });
      },
      dismissUndo: () => set({ undo: null }),
      setFormatPreference: (formatPreference) => set({ formatPreference }),
      setTheme: (theme) => set({ theme }),
      setDevice: (device) => set({ device }),
      setSplitRatio: (ratio) => set({ splitRatio: clampRatio(ratio) }),
      setMobilePane: (mobilePane) => set({ mobilePane }),
      focusLine: (line) => set({ focusRequest: { line, nonce: Date.now() }, mobilePane: "editor" }),
    }),
    {
      name: "folio-studio",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      // Rehydrated from an effect after the first client render so server and client markup always match.
      skipHydration: true,
      partialize: (state): PersistedState => ({
        source: state.source,
        formatPreference: state.formatPreference,
        theme: state.theme,
        device: state.device,
        splitRatio: state.splitRatio,
      }),
      merge: (persisted, current) => ({ ...current, ...sanitizePersisted(persisted) }),
    },
  ),
);
