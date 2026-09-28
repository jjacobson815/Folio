"use client";

import { EditorPanel } from "@/components/editor/editor-panel";
import { PreviewPanel } from "@/components/preview/preview-panel";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useResumeDocument, useStoreHydration } from "@/store/use-resume-document";
import { SplitView } from "./split-view";
import { TopBar } from "./top-bar";
import { WorkspaceSkeleton } from "./workspace-skeleton";

function HydratedWorkspace() {
  // One parse per deferred source value; both panes receive the same immutable ParseResult.
  const { result, isStale } = useResumeDocument();
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
  const hydrated = useStoreHydration();
  return hydrated ? <HydratedWorkspace /> : <WorkspaceSkeleton />;
}
