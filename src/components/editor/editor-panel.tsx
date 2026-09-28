"use client";

import { startTransition, useActionState, useCallback } from "react";
import type { ParseResult } from "@/parser";
import { importResumeFile, INITIAL_IMPORT_STATE } from "@/store/import-action";
import { EditorToolbar } from "./editor-toolbar";
import { SourceEditor } from "./source-editor";
import { StatusBar } from "./status-bar";

export function EditorPanel({ result }: { result: ParseResult }) {
  // React 19 action state: async file reads report pending/success/error without hand-rolled loading flags.
  const [importState, dispatchImport, isImporting] = useActionState(importResumeFile, INITIAL_IMPORT_STATE);
  const importFile = useCallback((file: File) => startTransition(() => dispatchImport(file)), [dispatchImport]);

  return (
    <section aria-label="Résumé editor" className="@container/editor flex h-full min-h-0 w-full flex-col bg-editor print:hidden">
      <EditorToolbar result={result} onImport={importFile} isImporting={isImporting} />
      <SourceEditor onImport={importFile} />
      <StatusBar result={result} importState={importState} />
    </section>
  );
}
