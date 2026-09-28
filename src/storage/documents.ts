import type { FormatPreference } from "@/parser";

/**
 * A saved résumé. `source` is the canonical content: the parsed résumé is always derived from it, so it is
 * never stored and parser improvements apply to existing documents automatically.
 */
export interface DocumentRecord {
  id: string;
  /** Name the user gave the document; empty means "use `name`". */
  title: string;
  /** Person's name from the last parse, cached so the document list can label files that aren't open. */
  name: string;
  source: string;
  formatPreference: FormatPreference;
  createdAt: number;
  updatedAt: number;
}

export type DocumentSummary = Omit<DocumentRecord, "source" | "formatPreference">;

/**
 * Storage boundary for résumé documents. The store and UI only talk to this interface, so the IndexedDB
 * implementation can later be swapped for (or synced with) a server without touching components.
 */
export interface DocumentRepository {
  /** "indexeddb" survives reloads; "memory" only lasts as long as the tab. */
  readonly kind: "indexeddb" | "memory";
  /** Every document without its content, most recently edited first. */
  list(): Promise<DocumentSummary[]>;
  get(id: string): Promise<DocumentRecord | null>;
  put(record: DocumentRecord): Promise<void>;
  delete(id: string): Promise<void>;
  /** The document that was open last, so a reload reopens it. */
  getActiveId(): Promise<string | null>;
  setActiveId(id: string): Promise<void>;
}

const FORMAT_PREFERENCES: readonly FormatPreference[] = ["auto", "json", "markdown", "text"];

export function isFormatPreference(value: unknown): value is FormatPreference {
  return FORMAT_PREFERENCES.includes(value as FormatPreference);
}

export function createDocumentId(): string {
  // randomUUID only exists in secure contexts; the dev server is often opened over plain http on a LAN IP.
  if (typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function createDocumentRecord(
  init: { source: string; title?: string; formatPreference?: FormatPreference },
  now: number = Date.now(),
): DocumentRecord {
  return {
    id: createDocumentId(),
    title: init.title ?? "",
    name: "",
    source: init.source,
    formatPreference: init.formatPreference ?? "auto",
    createdAt: now,
    updatedAt: now,
  };
}

export function toSummary(record: DocumentRecord): DocumentSummary {
  return { id: record.id, title: record.title, name: record.name, createdAt: record.createdAt, updatedAt: record.updatedAt };
}

export function sortSummaries(summaries: readonly DocumentSummary[]): DocumentSummary[] {
  return [...summaries].sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Label for menus and dialogs: the user's title, else the parsed name, else a placeholder. */
export function documentLabel(summary: Pick<DocumentSummary, "title" | "name">): string {
  return summary.title.trim() || summary.name.trim() || "Untitled résumé";
}

const finite = (value: unknown, fallback: number) => (typeof value === "number" && Number.isFinite(value) ? value : fallback);

/**
 * Validates a record read from storage. Reads are lenient (missing fields get defaults) so records written by
 * older builds keep loading; anything without an id and source is skipped rather than crashing the list.
 */
export function sanitizeRecord(value: unknown): DocumentRecord | null {
  if (typeof value !== "object" || value === null) return null;
  const record = value as Record<string, unknown>;
  if (typeof record.id !== "string" || !record.id || typeof record.source !== "string") return null;
  const createdAt = finite(record.createdAt, 0);
  return {
    id: record.id,
    title: typeof record.title === "string" ? record.title : "",
    name: typeof record.name === "string" ? record.name : "",
    source: record.source,
    formatPreference: isFormatPreference(record.formatPreference) ? record.formatPreference : "auto",
    createdAt,
    updatedAt: finite(record.updatedAt, createdAt),
  };
}
