"use client";

import { FileUp } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { cn } from "@/lib/utils";
import { usePortfolioStore } from "@/store/portfolio-store";

const MIRRORED_PROPERTIES = [
  "font-family",
  "font-size",
  "font-weight",
  "line-height",
  "letter-spacing",
  "padding-top",
  "padding-bottom",
  "padding-left",
  "padding-right",
  "box-sizing",
  "white-space",
  "word-break",
  "overflow-wrap",
  "tab-size",
] as const;

/**
 * Selects a source line and scrolls it into view. Soft-wrapped lines make line-height math unreliable, so the
 * vertical offset is measured with an off-screen mirror textarea that shares the editor's metrics.
 */
function revealLine(textarea: HTMLTextAreaElement, lineNumber: number) {
  const lines = textarea.value.split("\n");
  const index = Math.max(0, Math.min(lineNumber - 1, lines.length - 1));
  const start = lines.slice(0, index).reduce((offset, line) => offset + line.length + 1, 0);
  const end = start + (lines[index]?.length ?? 0);

  const mirror = document.createElement("textarea");
  const computed = window.getComputedStyle(textarea);
  for (const property of MIRRORED_PROPERTIES) mirror.style.setProperty(property, computed.getPropertyValue(property));
  Object.assign(mirror.style, { position: "absolute", visibility: "hidden", left: "-9999px", top: "0", height: "0", overflow: "hidden", width: `${textarea.clientWidth}px` });
  mirror.value = textarea.value.slice(0, start);
  document.body.appendChild(mirror);
  const offset = mirror.scrollHeight;
  mirror.remove();

  textarea.focus({ preventScroll: true });
  textarea.setSelectionRange(start, end);
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  textarea.scrollTo({ top: Math.max(0, offset - textarea.clientHeight / 3), behavior: reduce ? "auto" : "smooth" });
}

export function SourceEditor({ onImport }: { onImport: (file: File) => void }) {
  const source = usePortfolioStore((state) => state.source);
  const setSource = usePortfolioStore((state) => state.setSource);
  const focusRequest = usePortfolioStore((state) => state.focusRequest);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    if (!focusRequest || !textareaRef.current) return;
    // Wait a frame so the editor pane is visible on mobile (focusLine also switches the active pane).
    const frame = requestAnimationFrame(() => textareaRef.current && revealLine(textareaRef.current, focusRequest.line));
    return () => cancelAnimationFrame(frame);
  }, [focusRequest]);

  const hasFiles = (event: DragEvent) => Array.from(event.dataTransfer.types).includes("Files");

  return (
    <div
      className="relative min-h-0 flex-1"
      onDragEnter={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        dragDepth.current += 1;
        setDragging(true);
      }}
      onDragOver={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "copy";
      }}
      onDragLeave={() => {
        dragDepth.current = Math.max(0, dragDepth.current - 1);
        if (dragDepth.current === 0) setDragging(false);
      }}
      onDrop={(event) => {
        if (!hasFiles(event)) return;
        event.preventDefault();
        dragDepth.current = 0;
        setDragging(false);
        const file = event.dataTransfer.files[0];
        if (file) onImport(file);
      }}
    >
      <label htmlFor="resume-source" className="sr-only">
        Résumé source
      </label>
      <textarea
        id="resume-source"
        ref={textareaRef}
        value={source}
        onChange={(event) => setSource(event.target.value)}
        spellCheck={false}
        autoCapitalize="off"
        autoComplete="off"
        autoCorrect="off"
        placeholder={"Paste your résumé here.\n\nMarkdown, JSON Resume and plain-text exports all work — or drop a .md, .txt or .json file."}
        className="absolute inset-0 size-full resize-none bg-transparent px-4 py-4 font-mono text-base leading-6 text-foreground outline-none scrollbar-thin placeholder:text-muted-foreground/70 selection:bg-brand/25 sm:px-5 sm:text-[13px]"
      />
      <div
        aria-hidden={!dragging}
        className={cn(
          "pointer-events-none absolute inset-3 grid place-items-center rounded-xl border-2 border-dashed border-brand/60 bg-brand/5 backdrop-blur-[2px] transition-opacity duration-200",
          dragging ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex flex-col items-center gap-2 text-sm font-medium text-brand">
          <FileUp aria-hidden="true" className="size-6" />
          Drop to import .md, .txt or .json
        </div>
      </div>
    </div>
  );
}
