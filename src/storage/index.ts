import type { DocumentRepository } from "./documents";
import { openIndexedDbRepository } from "./indexed-db";
import { createMemoryRepository } from "./memory";

export * from "./documents";
export { createMemoryRepository } from "./memory";
export { openIndexedDbRepository } from "./indexed-db";

export interface RepositoryHandle {
  repository: DocumentRepository;
  /** Why documents fell back to memory, phrased to follow "Changes aren't saved because …". */
  problem: string | null;
}

/** Opens IndexedDB, falling back to a tab-lifetime memory repository instead of failing. Never rejects. */
export async function openDocumentRepository(): Promise<RepositoryHandle> {
  try {
    // Reading the global can itself throw a SecurityError in sandboxed iframes.
    const factory = typeof indexedDB === "undefined" ? undefined : indexedDB;
    if (!factory) return { repository: createMemoryRepository(), problem: "this browser doesn't support IndexedDB" };
    return { repository: await openIndexedDbRepository(factory), problem: null };
  } catch (error) {
    return { repository: createMemoryRepository(), problem: describeStorageError(error) };
  }
}

/** Turns storage exceptions into a short clause for the editor's warning banner. */
export function describeStorageError(error: unknown): string {
  const name = typeof error === "object" && error !== null && "name" in error ? String(error.name) : "";
  if (name === "QuotaExceededError") return "this site's browser storage is full";
  if (name === "SecurityError") return "the browser is blocking site data for this page";
  if (name === "InvalidStateError") return "another Folio tab upgraded the database (reload this tab to keep saving)";
  if (error instanceof Error && error.message) return error.message;
  return "browser storage is unavailable";
}

/**
 * Asks the browser to keep Folio's data when it is short on space, instead of evicting it with other
 * best-effort site data. Chrome decides silently; Firefox may show a permission prompt, which is why this is
 * only called after the user has actually edited something. Best effort: failures are ignored.
 */
export function requestPersistentStorage(): void {
  try {
    const storage = typeof navigator === "undefined" ? undefined : navigator.storage;
    if (!storage?.persist || !storage.persisted) return;
    void storage
      .persisted()
      .then((persisted) => (persisted ? true : storage.persist()))
      .catch(() => false);
  } catch {
    // Not supported in this context.
  }
}
