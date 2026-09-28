import { usePortfolioStore } from "./portfolio-store";

export interface ImportState {
  status: "idle" | "success" | "error";
  message: string | null;
  /** Timestamp so identical consecutive messages still re-trigger UI feedback. */
  at: number;
}

export const INITIAL_IMPORT_STATE: ImportState = { status: "idle", message: null, at: 0 };

const MAX_BYTES = 512 * 1024;
const ACCEPTED_EXTENSIONS = /\.(json|jsonc|json5|md|markdown|mdx|txt|text)$/i;
export const ACCEPTED_FILE_TYPES = ".json,.jsonc,.md,.markdown,.mdx,.txt,text/plain,text/markdown,application/json";

/**
 * React 19 action for `useActionState`: reads a dropped / picked file and swaps it into the editor.
 * Returning state (instead of throwing) lets the editor render success and error feedback declaratively.
 */
export async function importResumeFile(_previous: ImportState, file: File): Promise<ImportState> {
  const supported = ACCEPTED_EXTENSIONS.test(file.name) || file.type.startsWith("text/") || file.type === "application/json";
  if (!supported) {
    return { status: "error", message: `“${file.name}” isn't supported — use .md, .txt or .json (export PDFs/DOCX as text first).`, at: Date.now() };
  }
  if (file.size > MAX_BYTES) {
    return { status: "error", message: `“${file.name}” is ${(file.size / 1024).toFixed(0)} KB — the limit is 512 KB.`, at: Date.now() };
  }
  try {
    const text = await file.text();
    if (!text.trim()) return { status: "error", message: `“${file.name}” is empty.`, at: Date.now() };
    usePortfolioStore.getState().replaceSource(text, `Imported ${file.name}`);
    return { status: "success", message: `Imported ${file.name}`, at: Date.now() };
  } catch {
    return { status: "error", message: `Couldn't read “${file.name}”.`, at: Date.now() };
  }
}
