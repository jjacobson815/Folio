import { DocumentImportError, extractTextFromDocx, extractTextFromPdf } from "@/lib/document-import";
import { usePortfolioStore } from "./portfolio-store";

export interface ImportState {
  status: "idle" | "success" | "error";
  message: string | null;
  /** Timestamp so identical consecutive messages still re-trigger UI feedback. */
  at: number;
}

export const INITIAL_IMPORT_STATE: ImportState = { status: "idle", message: null, at: 0 };

const MAX_TEXT_BYTES = 512 * 1024;
const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
const TEXT_EXTENSIONS = /\.(json|jsonc|json5|md|markdown|mdx|txt|text)$/i;
const DOCX_EXTENSION = /\.docx$/i;
const PDF_EXTENSION = /\.pdf$/i;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PDF_MIME = "application/pdf";

export const ACCEPTED_FILE_TYPES = `.json,.jsonc,.md,.markdown,.mdx,.txt,.pdf,.docx,text/plain,text/markdown,application/json,${PDF_MIME},${DOCX_MIME}`;

type ImportKind = "text" | "docx" | "pdf";

function detectImportKind(file: File): ImportKind | null {
  if (PDF_EXTENSION.test(file.name) || file.type === PDF_MIME) return "pdf";
  if (DOCX_EXTENSION.test(file.name) || file.type === DOCX_MIME) return "docx";
  if (TEXT_EXTENSIONS.test(file.name) || file.type.startsWith("text/") || file.type === "application/json") return "text";
  return null;
}

function formatLimit(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${Math.round(bytes / (1024 * 1024))} MB` : `${Math.round(bytes / 1024)} KB`;
}

function formatSize(bytes: number): string {
  return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MB` : `${(bytes / 1024).toFixed(0)} KB`;
}

/**
 * React 19 action for `useActionState`: reads a dropped / picked file (including `.pdf` and `.docx`)
 * and swaps the extracted source into the editor.
 * Returning state (instead of throwing) lets the editor render success and error feedback declaratively.
 */
export async function importResumeFile(_previous: ImportState, file: File): Promise<ImportState> {
  const kind = detectImportKind(file);
  if (!kind) {
    return {
      status: "error",
      message: `“${file.name}” isn't supported — use .md, .txt, .json, .pdf or .docx.`,
      at: Date.now(),
    };
  }

  const maxBytes = kind === "text" ? MAX_TEXT_BYTES : MAX_DOCUMENT_BYTES;
  if (file.size > maxBytes) {
    return {
      status: "error",
      message: `“${file.name}” is ${formatSize(file.size)} — the limit is ${formatLimit(maxBytes)}.`,
      at: Date.now(),
    };
  }

  try {
    let text: string;
    if (kind === "docx") {
      text = await extractTextFromDocx(await file.arrayBuffer());
    } else if (kind === "pdf") {
      text = await extractTextFromPdf(await file.arrayBuffer());
    } else {
      text = await file.text();
    }

    if (!text.trim()) {
      return { status: "error", message: `“${file.name}” is empty.`, at: Date.now() };
    }

    usePortfolioStore.getState().replaceSource(text, `Imported ${file.name}`);
    return { status: "success", message: `Imported ${file.name}`, at: Date.now() };
  } catch (error) {
    if (error instanceof DocumentImportError) {
      if (error.code === "password") {
        return { status: "error", message: `“${file.name}” is password-protected — unlock it before importing.`, at: Date.now() };
      }
      if (error.code === "no-text") {
        return { status: "error", message: `“${file.name}” has no selectable text (scanned image PDFs aren't supported yet).`, at: Date.now() };
      }
    }
    return { status: "error", message: `Couldn't read “${file.name}”.`, at: Date.now() };
  }
}
