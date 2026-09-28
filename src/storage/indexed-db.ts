import { sanitizeRecord, sortSummaries, toSummary, type DocumentRepository } from "./documents";

const DOCUMENTS = "documents";
const META = "meta";
const ACTIVE_ID_KEY = "activeDocumentId";

/**
 * Schema migrations, run in order inside `onupgradeneeded`. The database version is the number of steps, so
 * appending a step upgrades existing installs on their next visit. Never edit a step that has shipped; steps
 * that reshape existing records can walk `transaction.objectStore(...)` with a cursor.
 */
const MIGRATIONS: ReadonlyArray<(database: IDBDatabase, transaction: IDBTransaction) => void> = [
  // v1: résumé documents keyed by id, plus a small key/value store for workspace metadata.
  (database) => {
    database.createObjectStore(DOCUMENTS, { keyPath: "id" });
    database.createObjectStore(META);
  },
];

export const DATABASE_VERSION = MIGRATIONS.length;

function settle<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

/** Resolves once a write transaction is durable, which is what "saved" should mean (not just request success). */
function committed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () => reject(transaction.error ?? new DOMException("IndexedDB transaction aborted", "AbortError"));
  });
}

function openDatabase(factory: IDBFactory, name: string, timeoutMs: number): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let settled = false;
    const fail = (error: unknown) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    };
    // An upgrade blocked by another tab (or a browser that never answers) must not leave the app on a spinner.
    const timer = setTimeout(
      () => fail(new DOMException("the database took too long to open (another Folio tab may be blocking it)", "TimeoutError")),
      timeoutMs,
    );

    let request: IDBOpenDBRequest;
    try {
      request = factory.open(name, DATABASE_VERSION);
    } catch (error) {
      fail(error);
      return;
    }
    request.onupgradeneeded = (event) => {
      const transaction = request.transaction;
      if (!transaction) return;
      for (let version = event.oldVersion; version < DATABASE_VERSION; version++) MIGRATIONS[version]?.(request.result, transaction);
    };
    request.onsuccess = () => {
      const database = request.result;
      if (settled) {
        database.close();
        return;
      }
      settled = true;
      clearTimeout(timer);
      // Let a newer build in another tab upgrade the schema instead of blocking it; this tab's later writes
      // then fail with InvalidStateError, which the workspace reports as a save problem.
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onerror = () => fail(request.error ?? new Error("Couldn't open the database"));
  });
}

export async function openIndexedDbRepository(
  factory: IDBFactory,
  options: { name?: string; timeoutMs?: number } = {},
): Promise<DocumentRepository> {
  const database = await openDatabase(factory, options.name ?? "folio", options.timeoutMs ?? 5000);
  const read = (store: string) => database.transaction(store, "readonly").objectStore(store);
  const write = (store: string, change: (objectStore: IDBObjectStore) => void) => {
    const transaction = database.transaction(store, "readwrite");
    change(transaction.objectStore(store));
    return committed(transaction);
  };

  // Methods are async so a synchronous throw (e.g. a closed connection) surfaces as a rejected promise.
  return {
    kind: "indexeddb",
    async list() {
      const values: unknown[] = await settle(read(DOCUMENTS).getAll());
      return sortSummaries(
        values.flatMap((value) => {
          const record = sanitizeRecord(value);
          return record ? [toSummary(record)] : [];
        }),
      );
    },
    async get(id) {
      return sanitizeRecord(await settle(read(DOCUMENTS).get(id)));
    },
    async put(record) {
      await write(DOCUMENTS, (documents) => documents.put({ ...record }));
    },
    async delete(id) {
      await write(DOCUMENTS, (documents) => documents.delete(id));
    },
    async getActiveId() {
      const value: unknown = await settle(read(META).get(ACTIVE_ID_KEY));
      return typeof value === "string" ? value : null;
    },
    async setActiveId(id) {
      await write(META, (meta) => meta.put(id, ACTIVE_ID_KEY));
    },
  };
}
