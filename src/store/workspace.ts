import { DEFAULT_SAMPLE } from "@/lib/samples";
import {
  createDocumentRecord,
  createMemoryRepository,
  describeStorageError,
  openDocumentRepository,
  requestPersistentStorage,
  sortSummaries,
  toSummary,
  type DocumentRecord,
  type DocumentRepository,
  type DocumentSummary,
  type RepositoryHandle,
} from "@/storage";
import { clearLegacyWorkspace, readLegacyWorkspace, type LegacyWorkspace } from "@/storage/legacy";
import { browserStorage, DEFAULT_PREFERENCES, readPreferences, writePreferences, type Preferences } from "@/storage/preferences";
import { clearRecovery, readRecovery, writeRecovery } from "@/storage/recovery";
import { INITIAL_STATE, usePortfolioStore } from "./portfolio-store";

/**
 * Workspace lifecycle: restores documents and preferences into the store, saves changes back through the
 * document repository, and implements the document commands (create / switch / rename / delete).
 *
 * The store stays a plain synchronous state container; everything that touches storage lives here, behind
 * the DocumentRepository interface, so a server-backed repository can replace IndexedDB later.
 */

export interface WorkspaceEnvironment {
  openRepository: () => Promise<RepositoryHandle>;
  /** localStorage (preferences and the legacy workspace), or null when the browser blocks it. */
  storage: Storage | null;
  /** Longest an edit waits before it is written to the repository. */
  saveDelayMs: number;
  preferenceDelayMs: number;
  requestPersistence: () => void;
  now: () => number;
}

function browserEnvironment(): WorkspaceEnvironment {
  return {
    openRepository: openDocumentRepository,
    storage: browserStorage(),
    saveDelayMs: 500,
    preferenceDelayMs: 300,
    requestPersistence: requestPersistentStorage,
    now: Date.now,
  };
}

/* -------------------------------------------------------------------------------------------------
 * Autosave
 * -----------------------------------------------------------------------------------------------*/

interface Autosave {
  /** Starts comparing edits against `record` (the repository's copy of the open document); null pauses saving. */
  track: (record: DocumentRecord | null) => void;
  tracked: () => DocumentRecord | null;
  /** Called on every store change; schedules a write when the open document differs from its saved copy. */
  onChange: () => void;
  /** Queues pending changes immediately. Resolves once every queued write has settled. */
  flush: () => Promise<void>;
  /** Synchronously copies pending changes to the localStorage recovery journal (see storage/recovery.ts). */
  journal: () => void;
  /** Takes ownership of a journal replayed at boot: it is cleared once document `id` is next saved. */
  adoptJournal: (id: string) => void;
}

function reportProblem(problem: string) {
  usePortfolioStore.setState((state) => (state.storage.problem === problem ? state : { storage: { ...state.storage, problem } }));
}

function markSaved(record: DocumentRecord, edited: boolean) {
  usePortfolioStore.setState((state) => {
    // A successful write clears an earlier save failure; memory mode keeps its explanation.
    const clearsProblem = state.storage.mode === "indexeddb" && state.storage.problem !== null;
    if (!edited && !clearsProblem) return state;
    return {
      documents: edited
        ? sortSummaries(state.documents.map((document) => (document.id === record.id ? { ...document, updatedAt: record.updatedAt } : document)))
        : state.documents,
      storage: clearsProblem ? { ...state.storage, problem: null } : state.storage,
    };
  });
}

function createAutosave(repository: DocumentRepository, env: WorkspaceEnvironment): Autosave {
  let baseline: DocumentRecord | null = null;
  let failed = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let queue: Promise<void> = Promise.resolve();
  let requestedPersistence = false;
  /** Id of the document last copied to the recovery journal, cleared once IndexedDB has it. */
  let journaled: string | null = null;

  /** The open document as the user currently sees it, or null when it isn't the tracked one. */
  const current = (): DocumentRecord | null => {
    const state = usePortfolioStore.getState();
    const summary = state.documents.find((document) => document.id === state.activeDocumentId);
    if (!summary || !baseline || summary.id !== baseline.id) return null;
    return { ...summary, source: state.source, formatPreference: state.formatPreference };
  };
  const contentChanged = (record: DocumentRecord, base: DocumentRecord) =>
    record.source !== base.source || record.formatPreference !== base.formatPreference;
  const differs = (record: DocumentRecord, base: DocumentRecord) =>
    contentChanged(record, base) || record.title !== base.title || record.name !== base.name;
  // A failed write keeps the document dirty for explicit flushes (next edit, tab hidden), but only real
  // differences schedule one: otherwise a persistent error such as a full quota would retry in a loop.
  const isDirty = (record: DocumentRecord, base: DocumentRecord) => failed || differs(record, base);
  /** What the next flush would write, or null when the open document is already saved. */
  const pending = (): { next: DocumentRecord; edited: boolean } | null => {
    const record = current();
    const base = baseline;
    if (!record || !base || !isDirty(record, base)) return null;
    const edited = contentChanged(record, base);
    // Renames and name syncs are saved without bumping updatedAt, so they don't reorder the document list.
    return { next: { ...record, updatedAt: edited ? env.now() : base.updatedAt }, edited };
  };

  const flush = (): Promise<void> => {
    clearTimeout(timer);
    timer = undefined;
    const change = pending();
    if (!change) return queue;
    const { next, edited } = change;
    // Later edits are compared with what is being written; a failed write sets `failed` so the next flush
    // retries the whole record.
    baseline = next;
    failed = false;
    queue = queue.then(async () => {
      try {
        await repository.put(next);
      } catch (error) {
        failed = true;
        reportProblem(describeStorageError(error));
        return;
      }
      markSaved(next, edited);
      if (journaled === next.id) {
        clearRecovery(env.storage);
        journaled = null;
      }
      if (edited && !requestedPersistence) {
        requestedPersistence = true;
        env.requestPersistence();
      }
    });
    return queue;
  };

  return {
    track: (record) => {
      clearTimeout(timer);
      timer = undefined;
      baseline = record && { ...record };
      failed = false;
    },
    tracked: () => baseline,
    onChange: () => {
      // Fixed window rather than a reset-on-every-keystroke debounce: continuous typing still saves every
      // `saveDelayMs`, so at most that much work is at risk if the tab crashes.
      if (timer !== undefined) return;
      const record = current();
      if (record && baseline && differs(record, baseline)) timer = setTimeout(() => void flush(), env.saveDelayMs);
    },
    flush,
    journal: () => {
      const change = pending();
      if (change && writeRecovery(env.storage, change.next)) journaled = change.next.id;
    },
    adoptJournal: (id) => {
      journaled = id;
    },
  };
}

/* -------------------------------------------------------------------------------------------------
 * Boot
 * -----------------------------------------------------------------------------------------------*/

interface Session {
  repository: DocumentRepository;
  env: WorkspaceEnvironment;
  autosave: Autosave;
  /** Runs when the page is hidden or unloaded. */
  hide: () => void;
  /** Stops listening and resolves once queued writes have settled. */
  dispose: () => Promise<void>;
}

let booting: Promise<void> | null = null;
let session: Session | null = null;
let switchToken = 0;

interface Restored {
  /** What the editor opens: the saved document, plus any edits replayed from the recovery journal. */
  active: DocumentRecord;
  /** The repository's copy of `active`. Autosave diffs against it, so replayed edits are saved like any other. */
  saved: DocumentRecord;
  documents: DocumentSummary[];
  importedLegacy: boolean;
  recovered: boolean;
}

async function restoreDocuments(repository: DocumentRepository, legacy: LegacyWorkspace | null, env: WorkspaceEnvironment): Promise<Restored> {
  const documents = await repository.list();
  if (documents.length) {
    // Reopen the document that was open last, else the most recently edited one.
    const storedId = await repository.getActiveId();
    const candidates = [...documents].sort((a, b) => Number(b.id === storedId) - Number(a.id === storedId));
    const active = await loadFirst(repository, candidates);
    if (active) return { active, saved: active, documents, importedLegacy: false, recovered: false };
  }
  // First run in this browser: carry over the résumé the localStorage build kept, else start from the sample.
  const first = createDocumentRecord({ source: legacy?.source ?? DEFAULT_SAMPLE, formatPreference: legacy?.formatPreference }, env.now());
  await repository.put(first);
  await repository.setActiveId(first.id);
  return {
    active: first,
    saved: first,
    documents: sortSummaries([...documents, toSummary(first)]),
    importedLegacy: legacy?.source != null,
    recovered: false,
  };
}

/**
 * Reopens the document the recovery journal belongs to with the journaled edits applied as unsaved changes,
 * so autosave writes them (and retries or reports failures) exactly like fresh edits. A journal older than the
 * saved copy (e.g. a later edit from another tab) or identical to it is discarded.
 */
async function replayRecovery(repository: DocumentRepository, restored: Restored, env: WorkspaceEnvironment): Promise<Restored> {
  const recovery = readRecovery(env.storage);
  if (!recovery) return restored;
  let saved: DocumentRecord | null;
  try {
    saved = recovery.id === restored.saved.id ? restored.saved : await repository.get(recovery.id);
  } catch {
    return restored; // Keep the journal; the next boot tries again.
  }
  const unchanged =
    saved !== null &&
    recovery.source === saved.source &&
    recovery.formatPreference === saved.formatPreference &&
    recovery.title === saved.title &&
    recovery.name === saved.name;
  if (!saved || unchanged || recovery.updatedAt < saved.updatedAt) {
    // In memory mode the journal's document may simply be unreachable right now, so keep it for later.
    if (repository.kind === "indexeddb") clearRecovery(env.storage);
    return restored;
  }
  const active: DocumentRecord = { ...recovery, createdAt: saved.createdAt };
  return {
    ...restored,
    active,
    saved,
    documents: sortSummaries(restored.documents.map((summary) => (summary.id === active.id ? toSummary(active) : summary))),
    recovered: true,
  };
}

async function loadFirst(repository: DocumentRepository, summaries: readonly DocumentSummary[]): Promise<DocumentRecord | null> {
  for (const summary of summaries) {
    const record = await repository.get(summary.id);
    if (record) return record;
  }
  return null;
}

function startSession(repository: DocumentRepository, env: WorkspaceEnvironment, saved: DocumentRecord): Session {
  const autosave = createAutosave(repository, env);
  autosave.track(saved);

  let preferenceTimer: ReturnType<typeof setTimeout> | undefined;
  const savePreferences = () => {
    clearTimeout(preferenceTimer);
    preferenceTimer = undefined;
    const { theme, device, splitRatio } = usePortfolioStore.getState();
    writePreferences(env.storage, { theme, device, splitRatio });
  };

  const unsubscribe = usePortfolioStore.subscribe((state, previous) => {
    autosave.onChange();
    if (state.theme !== previous.theme || state.device !== previous.device || state.splitRatio !== previous.splitRatio) {
      // Debounced so dragging the divider writes once when it settles, not on every frame.
      clearTimeout(preferenceTimer);
      preferenceTimer = setTimeout(savePreferences, env.preferenceDelayMs);
    }
  });

  // Tabs are often closed mid-debounce. The synchronous journal survives an unload that aborts the
  // IndexedDB write; the flush covers the common case (tab switch, minimise) where the page lives on.
  const hide = () => {
    autosave.journal();
    void autosave.flush();
    if (preferenceTimer !== undefined) savePreferences();
  };
  const onVisibilityChange = () => {
    if (document.visibilityState === "hidden") hide();
  };
  const hasDom = typeof window !== "undefined" && typeof document !== "undefined";
  if (hasDom) {
    window.addEventListener("pagehide", hide);
    document.addEventListener("visibilitychange", onVisibilityChange);
  }

  return {
    repository,
    env,
    autosave,
    hide,
    dispose: () => {
      unsubscribe();
      clearTimeout(preferenceTimer);
      if (hasDom) {
        window.removeEventListener("pagehide", hide);
        document.removeEventListener("visibilitychange", onVisibilityChange);
      }
      const settled = autosave.flush();
      autosave.track(null);
      return settled;
    },
  };
}

async function start(env: WorkspaceEnvironment): Promise<void> {
  const legacy = readLegacyWorkspace(env.storage);
  const preferences: Preferences = { ...DEFAULT_PREFERENCES, ...legacy?.preferences, ...readPreferences(env.storage) };

  let { repository, problem } = await env
    .openRepository()
    .catch((error: unknown): RepositoryHandle => ({ repository: createMemoryRepository(), problem: describeStorageError(error) }));
  let restored: Restored;
  try {
    restored = await restoreDocuments(repository, legacy, env);
  } catch (error) {
    // The database opened but couldn't be read or written (evicted, quota, closed): stay usable for this tab.
    problem = describeStorageError(error);
    repository = createMemoryRepository();
    restored = await restoreDocuments(repository, legacy, env);
  }
  restored = await replayRecovery(repository, restored, env);
  if (legacy) {
    // Preferences carried over from the legacy blob are only in memory until written to their own key.
    writePreferences(env.storage, preferences);
    // Forget the old localStorage copy only once the résumé is safely in IndexedDB.
    if (restored.importedLegacy && repository.kind === "indexeddb") clearLegacyWorkspace(env.storage);
  }

  usePortfolioStore.setState({
    ...preferences,
    status: "ready",
    storage: { mode: repository.kind, problem },
    documents: restored.documents,
    activeDocumentId: restored.active.id,
    source: restored.active.source,
    formatPreference: restored.active.formatPreference,
    undo: null,
  });
  session = startSession(repository, env, restored.saved);
  if (restored.recovered) {
    // The editor shows the replayed edits while autosave compares against the saved copy: write them now.
    session.autosave.adoptJournal(restored.active.id);
    void session.autosave.flush();
  }
}

/**
 * Restores documents and preferences, then starts autosave. Idempotent (StrictMode runs effects twice) and
 * falls back to in-memory documents instead of rejecting when storage is blocked, full or corrupt.
 */
export function bootWorkspace(overrides: Partial<WorkspaceEnvironment> = {}): Promise<void> {
  booting ??= start({ ...browserEnvironment(), ...overrides });
  return booting;
}

/** Writes pending edits now. */
export function flushWorkspace(): Promise<void> {
  return session?.autosave.flush() ?? Promise.resolve();
}

/** What runs when the page is hidden or unloaded (journal + flush); exported so tests can simulate it. */
export function saveBeforeUnload(): void {
  session?.hide();
}

/** Stops autosave and resets all workspace state. For tests; the app keeps one workspace per page load. */
export async function disposeWorkspace(): Promise<void> {
  const current = session;
  session = null;
  booting = null;
  if (current) await current.dispose();
  usePortfolioStore.setState(INITIAL_STATE);
}

/* -------------------------------------------------------------------------------------------------
 * Document commands. They never reject: storage failures surface through `storage.problem`.
 * -----------------------------------------------------------------------------------------------*/

async function withSession(task: (current: Session) => Promise<void>): Promise<void> {
  const current = session;
  if (!current) return;
  try {
    await task(current);
  } catch (error) {
    reportProblem(describeStorageError(error));
  }
}

/**
 * Makes `record` the open document. Synchronous from the flush onward, so a keystroke can never be saved
 * into the wrong document: the old document's pending edits are captured before the source is swapped.
 */
function activate(current: Session, record: DocumentRecord, documents?: DocumentSummary[]) {
  void current.autosave.flush();
  current.autosave.track(record);
  usePortfolioStore.setState((state) => ({
    documents: documents ?? state.documents,
    activeDocumentId: record.id,
    source: record.source,
    formatPreference: record.formatPreference,
    undo: null,
    focusRequest: null,
  }));
  // Only decides which document reopens next time, so a failure isn't worth a warning.
  void current.repository.setActiveId(record.id).catch(() => undefined);
}

export function createDocument(init: { source?: string; title?: string } = {}): Promise<void> {
  return withSession(async (current) => {
    const record = createDocumentRecord({ source: init.source ?? "", title: init.title }, current.env.now());
    await current.repository.put(record);
    activate(current, record, sortSummaries([toSummary(record), ...usePortfolioStore.getState().documents]));
    usePortfolioStore.setState({ mobilePane: "editor" });
  });
}

export function switchDocument(id: string): Promise<void> {
  const token = ++switchToken;
  return withSession(async (current) => {
    if (usePortfolioStore.getState().activeDocumentId === id) return;
    const record = await current.repository.get(id);
    // A newer switch started while this one was loading; let that one win.
    if (token !== switchToken) return;
    if (record) return activate(current, record);
    // The document vanished (e.g. deleted in another tab): drop it from the list, keeping local edits.
    usePortfolioStore.setState((state) => ({ documents: state.documents.filter((document) => document.id !== id) }));
  });
}

/** Sets the user's title; an empty title falls back to the name parsed from the résumé. */
export function renameDocument(id: string, title: string): Promise<void> {
  const clean = title.trim().slice(0, 80);
  return withSession(async (current) => {
    usePortfolioStore.setState((state) => ({
      documents: state.documents.map((document) => (document.id === id ? { ...document, title: clean } : document)),
    }));
    // The open document's title is part of its autosaved record; other documents are updated in place.
    if (id === usePortfolioStore.getState().activeDocumentId) return current.autosave.flush();
    const record = await current.repository.get(id);
    if (record) await current.repository.put({ ...record, title: clean });
  });
}

/** Permanently deletes a document. The last remaining document can't be deleted. */
export function deleteDocument(id: string): Promise<void> {
  return withSession(async (current) => {
    const { documents, activeDocumentId } = usePortfolioStore.getState();
    if (documents.length < 2 || !documents.some((document) => document.id === id)) return;

    if (id !== activeDocumentId) {
      await current.repository.delete(id);
      usePortfolioStore.setState((state) => ({ documents: state.documents.filter((document) => document.id !== id) }));
      return;
    }

    // Land queued writes, then stop saving: a late autosave must not recreate the deleted record.
    await current.autosave.flush();
    const tracked = current.autosave.tracked();
    current.autosave.track(null);
    try {
      await current.repository.delete(id);
    } catch (error) {
      current.autosave.track(tracked);
      current.autosave.onChange();
      throw error;
    }

    const remaining = usePortfolioStore.getState().documents.filter((document) => document.id !== id);
    let next = await loadFirst(current.repository, remaining);
    if (!next) {
      next = createDocumentRecord({ source: "" }, current.env.now());
      await current.repository.put(next);
      remaining.unshift(toSummary(next));
    }
    activate(current, next, remaining);
  });
}
