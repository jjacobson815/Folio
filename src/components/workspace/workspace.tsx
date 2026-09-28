"use client";

import { useEffect } from "react";
import { EditorPanel } from "@/components/editor/editor-panel";
import { PreviewPanel } from "@/components/preview/preview-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { usePortfolioStore } from "@/store/portfolio-store";
import { useResumeDocument, useWorkspaceReady } from "@/store/use-resume-document";
import { SplitView } from "./split-view";
import { TopBar } from "./top-bar";
import { WorkspaceSkeleton } from "./workspace-skeleton";

function HydratedWorkspace() {
  // One parse per deferred source value; both panes receive the same immutable ParseResult.
  const { result, parsedSource, isStale } = useResumeDocument();
  const syncDocumentName = usePortfolioStore((state) => state.syncDocumentName);
  const name = result.resume.basics.name;

  // Cache the parsed name on the document so the document menu can label résumés that aren't open.
  useEffect(() => syncDocumentName(name, parsedSource), [name, parsedSource, syncDocumentName]);

  return (
    <TooltipProvider delayDuration={350} skipDelayDuration={150}>
      <div className="flex h-dvh flex-col print:block print:h-auto">
        <TopBar result={result} />
        <SplitView editor={<EditorPanel result={result} />} preview={<PreviewPanel result={result} isStale={isStale} />} />
      </div>
    </TooltipProvider>
  );
}

export function Workspace() {
  const ready = useWorkspaceReady();
  return ready ? <HydratedWorkspace /> : <WorkspaceSkeleton />;
}
