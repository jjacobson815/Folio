import { IDBFactory } from "fake-indexeddb";
import { describe, expect, it } from "vitest";
import { createDocumentRecord, type DocumentRecord, type DocumentRepository } from "./documents";
import { DATABASE_VERSION, openIndexedDbRepository } from "./indexed-db";
import { createMemoryRepository } from "./memory";

function record(overrides: Partial<DocumentRecord> = {}): DocumentRecord {
  return { ...createDocumentRecord({ source: "# Jane Doe" }, 1_000), ...overrides };
}

// Every implementation must behave identically; this is what lets a server-backed repository slot in later.
const implementations: Array<[string, () => Promise<DocumentRepository>]> = [
  ["memory", async () => createMemoryRepository()],
  ["indexeddb", () => openIndexedDbRepository(new IDBFactory())],
];

describe.each(implementations)("%s repository", (_kind, open) => {
  it("stores, reads and deletes documents", async () => {
    const repository = await open();
    const document = record({ title: "Staff résumé", source: "# Jane Doe\nStaff Engineer" });
    await repository.put(document);
    expect(await repository.get(document.id)).toEqual(document);
    await repository.delete(document.id);
    expect(await repository.get(document.id)).toBeNull();
    expect(await repository.get("missing")).toBeNull();
  });

  it("lists summaries without content, most recently edited first", async () => {
    const repository = await open();
    const older = record({ updatedAt: 1_000 });
    const newer = record({ updatedAt: 5_000 });
    await repository.put(older);
    await repository.put(newer);
    const list = await repository.list();
    expect(list.map((summary) => summary.id)).toEqual([newer.id, older.id]);
    expect(list[0]).not.toHaveProperty("source");
  });

  it("returns copies, so callers can't mutate stored state", async () => {
    const repository = await open();
    const document = record();
    await repository.put(document);
    document.source = "mutated after save";
    const loaded = await repository.get(document.id);
    expect(loaded?.source).toBe("# Jane Doe");
    if (loaded) loaded.source = "mutated after load";
    expect((await repository.get(document.id))?.source).toBe("# Jane Doe");
  });

  it("remembers the active document", async () => {
    const repository = await open();
    expect(await repository.getActiveId()).toBeNull();
    await repository.setActiveId("abc");
    expect(await repository.getActiveId()).toBe("abc");
  });
});

describe("indexeddb repository", () => {
  it("persists across connections", async () => {
    const factory = new IDBFactory();
    const document = record();
    const first = await openIndexedDbRepository(factory);
    await first.put(document);
    await first.setActiveId(document.id);
    const second = await openIndexedDbRepository(factory);
    expect(await second.get(document.id)).toEqual(document);
    expect(await second.getActiveId()).toBe(document.id);
  });

  it("skips malformed records and fills defaults for older ones", async () => {
    const factory = new IDBFactory();
    const repository = await openIndexedDbRepository(factory);
    await repository.put(record({ id: "good" }));
    // Simulate data written by an older build (no title/name/format) and garbage from devtools.
    await new Promise<void>((resolve, reject) => {
      const request = factory.open("folio", DATABASE_VERSION);
      request.onsuccess = () => {
        const transaction = request.result.transaction("documents", "readwrite");
        transaction.objectStore("documents").put({ id: "old", source: "# Old", updatedAt: 3 });
        transaction.objectStore("documents").put({ id: "broken", source: 42 });
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
      };
    });
    expect((await repository.list()).map((summary) => summary.id).sort()).toEqual(["good", "old"]);
    expect(await repository.get("old")).toEqual({ id: "old", title: "", name: "", source: "# Old", formatPreference: "auto", createdAt: 0, updatedAt: 3 });
    expect(await repository.get("broken")).toBeNull();
  });

  it("rejects instead of hanging when the database can't be opened", async () => {
    const factory = new IDBFactory();
    factory.open = () => {
      throw new DOMException("blocked", "SecurityError");
    };
    await expect(openIndexedDbRepository(factory)).rejects.toMatchObject({ name: "SecurityError" });
  });

  it("times out when an upgrade is blocked", async () => {
    const factory = new IDBFactory();
    // A request that never fires success or error, like one blocked by another tab.
    factory.open = () => ({}) as IDBOpenDBRequest;
    await expect(openIndexedDbRepository(factory, { timeoutMs: 20 })).rejects.toMatchObject({ name: "TimeoutError" });
  });
});
