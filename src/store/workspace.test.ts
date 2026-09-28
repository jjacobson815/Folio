import { IDBFactory } from "fake-indexeddb";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SAMPLE } from "@/lib/samples";
import { createDocumentRecord, createMemoryRepository, documentLabel, openIndexedDbRepository, type DocumentRepository } from "@/storage";
import { LEGACY_KEY } from "@/storage/legacy";
import { MemoryStorage } from "@/test/memory-storage";
import { usePortfolioStore } from "./portfolio-store";
import {
  bootWorkspace,
  createDocument,
  deleteDocument,
  disposeWorkspace,
  flushWorkspace,
  renameDocument,
  saveBeforeUnload,
  switchDocument,
} from "./workspace";

const state = () => usePortfolioStore.getState();
let clock = 1_000;

interface BootOptions {
  repository?: DocumentRepository;
  storage?: Storage;
  problem?: string | null;
  saveDelayMs?: number;
  requestPersistence?: () => void;
}

async function boot(options: BootOptions = {}) {
  const repository = options.repository ?? createMemoryRepository();
  await bootWorkspace({
    openRepository: async () => ({ repository, problem: options.problem ?? null }),
    storage: options.storage ?? new MemoryStorage(),
    // Long by default: tests flush explicitly unless they are exercising the timer itself.
    saveDelayMs: options.saveDelayMs ?? 60_000,
    preferenceDelayMs: 0,
    requestPersistence: options.requestPersistence ?? (() => undefined),
    now: () => clock,
  });
  return repository;
}

function legacyStorage(source: string) {
  const storage = new MemoryStorage();
  storage.setItem(LEGACY_KEY, JSON.stringify({ state: { source, formatPreference: "markdown", theme: "minimal", device: "tablet", splitRatio: 0.3 }, version: 1 }));
  return storage;
}

/** An IndexedDB-like repository whose next `control.failures` writes throw a quota error. */
function flakyRepository(inner: DocumentRepository) {
  const control = { failures: 0 };
  const repository: DocumentRepository = {
    ...inner,
    kind: "indexeddb",
    put: async (record) => {
      if (control.failures > 0) {
        control.failures--;
        throw new DOMException("full", "QuotaExceededError");
      }
      return inner.put(record);
    },
  };
  return { control, repository };
}

afterEach(async () => {
  await disposeWorkspace();
  clock = 1_000;
});

describe("boot", () => {
  it("opens the sample on first run and remembers it", async () => {
    const repository = await boot();
    expect(state()).toMatchObject({ status: "ready", source: DEFAULT_SAMPLE, storage: { mode: "memory", problem: null } });
    expect(await repository.list()).toHaveLength(1);
    expect(await repository.getActiveId()).toBe(state().activeDocumentId);
  });

  it("reopens the document that was open last", async () => {
    const repository = createMemoryRepository();
    const older = { ...createDocumentRecord({ source: "# Older" }), updatedAt: 1 };
    const newer = { ...createDocumentRecord({ source: "# Newer" }), updatedAt: 2 };
    await repository.put(older);
    await repository.put(newer);
    await repository.setActiveId(older.id);
    await boot({ repository });
    expect(state()).toMatchObject({ activeDocumentId: older.id, source: "# Older" });
    expect(state().documents.map((document) => document.id)).toEqual([newer.id, older.id]);
  });

  it("imports the localStorage résumé and removes the old copy once it is in IndexedDB", async () => {
    const storage = legacyStorage("# Legacy Jane");
    const repository = await boot({ repository: await openIndexedDbRepository(new IDBFactory()), storage });
    expect(state()).toMatchObject({ source: "# Legacy Jane", formatPreference: "markdown", theme: "minimal", device: "tablet", splitRatio: 0.3 });
    expect((await repository.get(state().activeDocumentId ?? ""))?.source).toBe("# Legacy Jane");
    expect(storage.getItem(LEGACY_KEY)).toBeNull();
    // The legacy preferences must survive the removal of the blob they came from.
    expect(JSON.parse(storage.getItem("folio-prefs") ?? "{}").value).toEqual({ theme: "minimal", device: "tablet", splitRatio: 0.3 });
  });

  it("keeps the legacy copy when documents can only live in memory", async () => {
    const storage = legacyStorage("# Legacy Jane");
    await boot({ storage, problem: "the browser is blocking site data for this page" });
    expect(state()).toMatchObject({ source: "# Legacy Jane", storage: { mode: "memory", problem: "the browser is blocking site data for this page" } });
    expect(storage.getItem(LEGACY_KEY)).not.toBeNull();
  });

  it("falls back to memory instead of hanging when the database can't be read", async () => {
    const broken: DocumentRepository = {
      ...createMemoryRepository(),
      kind: "indexeddb",
      list: async () => {
        throw new DOMException("closed", "InvalidStateError");
      },
    };
    await boot({ repository: broken });
    expect(state()).toMatchObject({ status: "ready", source: DEFAULT_SAMPLE, storage: { mode: "memory" } });
    expect(state().storage.problem).toMatch(/another Folio tab/);
  });

  it("falls back to memory when opening storage throws", async () => {
    await bootWorkspace({
      openRepository: async () => {
        throw new DOMException("denied", "SecurityError");
      },
      storage: new MemoryStorage(),
    });
    expect(state()).toMatchObject({ status: "ready", storage: { mode: "memory", problem: "the browser is blocking site data for this page" } });
  });

  it("restores preferences and ignores corrupt ones", async () => {
    const storage = new MemoryStorage();
    storage.setItem("folio-prefs", JSON.stringify({ version: 1, value: { theme: "brutalist", device: "bogus" } }));
    await boot({ storage });
    expect(state()).toMatchObject({ theme: "brutalist", device: "desktop" });
  });

  it("boots once even when called repeatedly (React StrictMode)", async () => {
    const repository = createMemoryRepository();
    await Promise.all([boot({ repository }), boot({ repository })]);
    expect(await repository.list()).toHaveLength(1);
  });
});

describe("autosave", () => {
  it("saves edits after the delay and asks for persistent storage once", async () => {
    const requestPersistence = vi.fn();
    const repository = await boot({ saveDelayMs: 20, requestPersistence });
    const id = state().activeDocumentId ?? "";
    state().setSource("# Edited");
    expect((await repository.get(id))?.source).toBe(DEFAULT_SAMPLE);
    await vi.waitFor(async () => expect((await repository.get(id))?.source).toBe("# Edited"));
    state().setSource("# Edited again");
    await flushWorkspace();
    expect(requestPersistence).toHaveBeenCalledTimes(1);
  });

  it("bumps updatedAt for content edits but not for renames", async () => {
    const repository = await boot();
    const id = state().activeDocumentId ?? "";
    clock = 2_000;
    state().setSource("# Edited");
    await flushWorkspace();
    expect((await repository.get(id))?.updatedAt).toBe(2_000);
    clock = 3_000;
    await renameDocument(id, "Staff résumé");
    expect(await repository.get(id)).toMatchObject({ title: "Staff résumé", updatedAt: 2_000 });
  });

  it("reports a failed save and retries it", async () => {
    const inner = createMemoryRepository();
    const { control, repository } = flakyRepository(inner);
    await boot({ repository });
    const id = state().activeDocumentId ?? "";
    control.failures = 1;
    state().setSource("# Edited");
    await flushWorkspace();
    expect(state().storage.problem).toBe("this site's browser storage is full");
    // No new edits: the failed write alone makes the document dirty again.
    await flushWorkspace();
    expect(state().storage.problem).toBeNull();
    expect((await inner.get(id))?.source).toBe("# Edited");
  });

  it("doesn't retry a persistently failing save in a loop", async () => {
    const { control, repository } = flakyRepository(createMemoryRepository());
    let attempts = 0;
    const counting: DocumentRepository = {
      ...repository,
      put: (record) => {
        attempts++;
        return repository.put(record);
      },
    };
    await boot({ repository: counting, saveDelayMs: 10 });
    control.failures = Number.POSITIVE_INFINITY;
    attempts = 0;
    state().setSource("# Edited");
    await vi.waitFor(() => expect(state().storage.problem).not.toBeNull());
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(attempts).toBe(1);
  });

  it("replays edits journaled during an unload that aborted the database write", async () => {
    const inner = createMemoryRepository();
    const { control, repository } = flakyRepository(inner);
    const storage = new MemoryStorage();
    await boot({ repository, storage });
    const id = state().activeDocumentId ?? "";
    clock = 5_000;
    state().setSource("# Typed right before closing the tab");
    // The page dies mid-write: the IndexedDB write started by the unload handler never lands.
    control.failures = 1;
    saveBeforeUnload();
    await disposeWorkspace();
    expect((await inner.get(id))?.source).toBe(DEFAULT_SAMPLE);
    expect(storage.getItem("folio-unsaved")).not.toBeNull();

    // Reopen, and make the first attempt to save the replayed edits fail as well.
    control.failures = 1;
    await boot({ repository, storage });
    expect(state().source).toBe("# Typed right before closing the tab");
    expect(storage.getItem("folio-unsaved")).not.toBeNull();
    await flushWorkspace();
    await flushWorkspace();
    expect((await inner.get(id))?.source).toBe("# Typed right before closing the tab");
    expect(storage.getItem("folio-unsaved")).toBeNull();
    expect(state().storage.problem).toBeNull();
  });

  it("clears the journal once the database write lands", async () => {
    const storage = new MemoryStorage();
    await boot({ repository: flakyRepository(createMemoryRepository()).repository, storage });
    state().setSource("# Tab switched away");
    saveBeforeUnload();
    expect(storage.getItem("folio-unsaved")).not.toBeNull();
    await flushWorkspace();
    expect(storage.getItem("folio-unsaved")).toBeNull();
  });

  it("never lets an older journal overwrite newer saved work", async () => {
    const repository = flakyRepository(createMemoryRepository()).repository;
    const storage = new MemoryStorage();
    await boot({ repository, storage });
    const id = state().activeDocumentId ?? "";
    clock = 9_000;
    state().setSource("# Newer, saved from another tab");
    await flushWorkspace();
    await disposeWorkspace();
    storage.setItem("folio-unsaved", JSON.stringify({ ...createDocumentRecord({ source: "# Stale journal" }), id, updatedAt: 2_000 }));

    await boot({ repository, storage });
    expect(state().source).toBe("# Newer, saved from another tab");
    expect(storage.getItem("folio-unsaved")).toBeNull();
  });

  it("saves preferences to localStorage", async () => {
    const storage = new MemoryStorage();
    await boot({ storage });
    state().setTheme("minimal");
    state().setSplitRatio(0.5);
    await vi.waitFor(() => expect(JSON.parse(storage.getItem("folio-prefs") ?? "{}").value).toEqual({ theme: "minimal", device: "desktop", splitRatio: 0.5 }));
  });
});

describe("documents", () => {
  it("creates and switches documents without losing unsaved edits", async () => {
    const repository = await boot();
    const firstId = state().activeDocumentId ?? "";
    state().setSource("# First, edited");
    await createDocument();
    expect(state()).toMatchObject({ source: "", undo: null });
    expect(state().documents).toHaveLength(2);
    await flushWorkspace();
    expect((await repository.get(firstId))?.source).toBe("# First, edited");

    const secondId = state().activeDocumentId ?? "";
    state().setSource("# Second");
    await switchDocument(firstId);
    expect(state()).toMatchObject({ activeDocumentId: firstId, source: "# First, edited" });
    await flushWorkspace();
    expect((await repository.get(secondId))?.source).toBe("# Second");
    expect(await repository.getActiveId()).toBe(firstId);
  });

  it("labels documents by title, else by the parsed name", async () => {
    await boot();
    const id = state().activeDocumentId ?? "";
    state().syncDocumentName("Maya Okafor", state().source);
    expect(documentLabel(state().documents[0]!)).toBe("Maya Okafor");
    await renameDocument(id, "  Staff résumé  ");
    expect(documentLabel(state().documents[0]!)).toBe("Staff résumé");
    await renameDocument(id, "");
    expect(documentLabel(state().documents[0]!)).toBe("Maya Okafor");
  });

  it("ignores a name parsed from text that is no longer in the editor", async () => {
    await boot();
    state().syncDocumentName("Stale Name", "# some older text");
    expect(state().documents[0]?.name).toBe("");
  });

  it("deletes the open document without resurrecting it from a pending save", async () => {
    const inner = createMemoryRepository();
    // A keystroke that lands while the delete is in flight must not be saved back into the deleted record.
    const repository: DocumentRepository = {
      ...inner,
      delete: async (id) => {
        state().setSource("# Typed during delete");
        return inner.delete(id);
      },
    };
    await boot({ repository });
    const firstId = state().activeDocumentId ?? "";
    await createDocument({ source: "# Doomed" });
    const doomedId = state().activeDocumentId ?? "";
    state().setSource("# Doomed, edited");
    await deleteDocument(doomedId);
    await flushWorkspace();
    expect(await repository.get(doomedId)).toBeNull();
    expect(state()).toMatchObject({ activeDocumentId: firstId, source: DEFAULT_SAMPLE });
    expect(state().documents.map((document) => document.id)).toEqual([firstId]);
  });

  it("never deletes the last document", async () => {
    const repository = await boot();
    await deleteDocument(state().activeDocumentId ?? "");
    expect(await repository.list()).toHaveLength(1);
  });
});

describe("undo", () => {
  it("still restores the résumé after the same sample is loaded twice", async () => {
    await boot();
    state().setSource("MY RESUME");
    state().loadSample("markdown");
    state().loadSample("markdown");
    expect(state().undo?.source).toBe("MY RESUME");
    state().undoReplace();
    expect(state().source).toBe("MY RESUME");
  });

  it("still restores the résumé after clearing and then loading a sample", async () => {
    await boot();
    state().setSource("MY RESUME");
    state().clearSource();
    state().loadSample("json");
    expect(state().undo).toMatchObject({ source: "MY RESUME", label: "Loaded JSON Resume" });
  });

  it("drops the snapshot when switching documents", async () => {
    await boot();
    state().loadSample("json");
    expect(state().undo).not.toBeNull();
    await createDocument();
    expect(state().undo).toBeNull();
  });
});
