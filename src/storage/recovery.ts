import { sanitizeRecord, type DocumentRecord } from "./documents";

/**
 * Last-resort copy of unsaved edits, written synchronously when the page is hidden or unloaded. An IndexedDB
 * write started during unload can be aborted along with the page, but a localStorage write completes before
 * the event handler returns. The next boot replays the copy if it is newer than the saved document.
 */
const KEY = "folio-unsaved";

export function writeRecovery(storage: Storage | null, record: DocumentRecord): boolean {
  try {
    storage?.setItem(KEY, JSON.stringify(record));
    return Boolean(storage);
  } catch {
    // Quota or blocked storage: the regular IndexedDB flush is still attempted.
    return false;
  }
}

export function readRecovery(storage: Storage | null): DocumentRecord | null {
  try {
    const raw = storage?.getItem(KEY);
    return raw ? sanitizeRecord(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function clearRecovery(storage: Storage | null): void {
  try {
    storage?.removeItem(KEY);
  } catch {
    // Blocked storage: a stale copy is harmless because it only replays when newer than the saved document.
  }
}
