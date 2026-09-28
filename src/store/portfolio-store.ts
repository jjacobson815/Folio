import { create } from "zustand";
import { getSample, type SampleId } from "@/lib/samples";
import type { ThemeId } from "@/lib/themes";
import type { FormatPreference } from "@/parser";
import type { DocumentSummary } from "@/storage/documents";
import { clampSplitRatio, DEFAULT_PREFERENCES, type PreviewDevice } from "@/storage/preferences";

export { SPLIT_LIMITS, type PreviewDevice } from "@/storage/preferences";

export type MobilePane = "editor" | "preview";

/** Snapshot taken before a destructive replace (sample load, import, clear) so it can be undone. */
export interface UndoSnapshot {
  documentId: string | null;
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

export interface StorageStatus {
  /** "memory" means documents only last as long as this tab. */
  mode: "indexeddb" | "memory";
  /** Why documents can't be saved or the last save failed, phrased to follow "because …". Null when all is well. */
  problem: string | null;
}

export interface PortfolioState {
  /** "loading" until documents and preferences are restored; the workspace shows a skeleton until then. */
  status: "loading" | "ready";
  storage: StorageStatus;
  /** Every saved résumé, most recently edited first (content excluded). */
  documents: DocumentSummary[];
  activeDocumentId: string | null;
  /** Content of the open document: the only document state. The parsed résumé is derived from it. */
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
  /** Caches the parsed name on the open document; ignored when `parsedSource` is stale. */
  syncDocumentName: (name: string, parsedSource: string) => void;
}

export type PortfolioStore = PortfolioState & PortfolioActions;

export const INITIAL_STATE: PortfolioState = {
  status: "loading",
  storage: { mode: "memory", problem: null },
  documents: [],
  activeDocumentId: null,
  source: "",
  formatPreference: "auto",
  ...DEFAULT_PREFERENCES,
  mobilePane: "editor",
  undo: null,
  focusRequest: null,
};

/**
 * Single global store for the open document and workspace chrome. It holds no persistence logic: the
 * workspace (./workspace.ts) restores state on boot and saves changes through the document repository.
 */
export const usePortfolioStore = create<PortfolioStore>()((set, get) => ({
  ...INITIAL_STATE,

  setSource: (source) => set({ source }),
  replaceSource: (source, label) => {
    const { source: previous, formatPreference, activeDocumentId, undo } = get();
    // With nothing worth restoring (an empty editor, or the same text again), keep the earlier snapshot rather
    // than discarding it: "clear, then load a sample" must still be able to bring the user's résumé back.
    const snapshot: UndoSnapshot | null =
      previous.trim() && previous !== source
        ? { documentId: activeDocumentId, source: previous, formatPreference, label, at: Date.now() }
        : undo && { ...undo, label, at: Date.now() };
    set({ source, formatPreference: "auto", undo: snapshot });
  },
  loadSample: (id) => {
    const sample = getSample(id);
    get().replaceSource(sample.source, `Loaded ${sample.label}`);
  },
  clearSource: () => get().replaceSource("", "Editor cleared"),
  undoReplace: () => {
    const { undo, activeDocumentId } = get();
    if (!undo) return;
    // A snapshot belongs to the document it was taken in; never restore it into a different one.
    if (undo.documentId !== activeDocumentId) return set({ undo: null });
    set({ source: undo.source, formatPreference: undo.formatPreference, undo: null });
  },
  dismissUndo: () => set({ undo: null }),
  setFormatPreference: (formatPreference) => set({ formatPreference }),
  setTheme: (theme) => set({ theme }),
  setDevice: (device) => set({ device }),
  setSplitRatio: (ratio) => set({ splitRatio: clampSplitRatio(ratio) }),
  setMobilePane: (mobilePane) => set({ mobilePane }),
  focusLine: (line) => set({ focusRequest: { line, nonce: Date.now() }, mobilePane: "editor" }),
  syncDocumentName: (name, parsedSource) =>
    set((state) => {
      const active = state.documents.find((document) => document.id === state.activeDocumentId);
      if (!active || active.name === name || state.source !== parsedSource) return state;
      return { documents: state.documents.map((document) => (document.id === active.id ? { ...document, name } : document)) };
    }),
}));
