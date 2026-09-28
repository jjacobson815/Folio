import { sortSummaries, toSummary, type DocumentRecord, type DocumentRepository } from "./documents";

/**
 * Tab-lifetime repository used when IndexedDB is unavailable (blocked site data, sandboxed iframes) and in
 * tests. Records are copied in and out so callers can't mutate stored state by reference.
 */
export function createMemoryRepository(seed: readonly DocumentRecord[] = []): DocumentRepository {
  const records = new Map(seed.map((record) => [record.id, { ...record }]));
  let activeId: string | null = null;

  return {
    kind: "memory",
    async list() {
      return sortSummaries([...records.values()].map(toSummary));
    },
    async get(id) {
      const record = records.get(id);
      return record ? { ...record } : null;
    },
    async put(record) {
      records.set(record.id, { ...record });
    },
    async delete(id) {
      records.delete(id);
      if (activeId === id) activeId = null;
    },
    async getActiveId() {
      return activeId;
    },
    async setActiveId(id) {
      activeId = id;
    },
  };
}
