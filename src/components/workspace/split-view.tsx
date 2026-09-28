"use client";

import { Eye, PencilLine } from "lucide-react";
import { useRef, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode, type RefObject } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";
import { SPLIT_LIMITS, usePortfolioStore, type MobilePane } from "@/store/portfolio-store";

function MobilePaneSwitch() {
  const mobilePane = usePortfolioStore((state) => state.mobilePane);
  const setMobilePane = usePortfolioStore((state) => state.setMobilePane);
  return (
    <div className="shrink-0 border-b bg-background px-3 py-2 lg:hidden print:hidden">
      <ToggleGroup
        type="single"
        value={mobilePane}
        onValueChange={(value) => value && setMobilePane(value as MobilePane)}
        aria-label="Visible pane"
        className="grid w-full grid-cols-2"
      >
        <ToggleGroupItem value="editor" className="h-8 text-sm">
          <PencilLine aria-hidden="true" />
          Editor
        </ToggleGroupItem>
        <ToggleGroupItem value="preview" className="h-8 text-sm">
          <Eye aria-hidden="true" />
          Preview
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}

/** Pointer + keyboard resizable divider (WAI-ARIA window splitter pattern). */
function Divider({ containerRef }: { containerRef: RefObject<HTMLDivElement | null> }) {
  const ratio = usePortfolioStore((state) => state.splitRatio);
  const setSplitRatio = usePortfolioStore((state) => state.setSplitRatio);
  const [dragging, setDragging] = useState(false);
  const frame = useRef(0);

  const updateFromPointer = (clientX: number) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => setSplitRatio((clientX - rect.left) / rect.width));
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const step = event.shiftKey ? 0.1 : 0.02;
    const actions: Record<string, () => void> = {
      ArrowLeft: () => setSplitRatio(ratio - step),
      ArrowRight: () => setSplitRatio(ratio + step),
      Home: () => setSplitRatio(SPLIT_LIMITS.min),
      End: () => setSplitRatio(SPLIT_LIMITS.max),
      Enter: () => setSplitRatio(SPLIT_LIMITS.initial),
    };
    const action = actions[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <div
      role="separator"
      tabIndex={0}
      aria-orientation="vertical"
      aria-label="Resize editor and preview (arrow keys, Enter to reset)"
      aria-valuemin={Math.round(SPLIT_LIMITS.min * 100)}
      aria-valuemax={Math.round(SPLIT_LIMITS.max * 100)}
      aria-valuenow={Math.round(ratio * 100)}
      onPointerDown={onPointerDown}
      onPointerMove={(event) => dragging && updateFromPointer(event.clientX)}
      onPointerUp={(event) => {
        event.currentTarget.releasePointerCapture(event.pointerId);
        setDragging(false);
      }}
      onPointerCancel={() => setDragging(false)}
      onDoubleClick={() => setSplitRatio(SPLIT_LIMITS.initial)}
      onKeyDown={onKeyDown}
      className="group relative z-10 hidden w-px cursor-col-resize touch-none bg-border outline-none lg:block print:hidden"
    >
      <span className="absolute inset-y-0 -right-2 -left-2" />
      <span
        className={cn(
          "absolute top-1/2 left-1/2 h-12 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-background transition-[background-color,height,border-color] duration-200",
          "group-hover:h-16 group-hover:border-brand/50 group-hover:bg-brand/20 group-focus-visible:h-16 group-focus-visible:border-brand group-focus-visible:bg-brand/30",
          dragging && "h-20 border-brand bg-brand",
        )}
      />
      {dragging ? <span className="fixed inset-0 cursor-col-resize" /> : null}
    </div>
  );
}

/**
 * Desktop (lg+): side-by-side panes on a CSS grid whose first column is a custom property driven by the store.
 * Mobile: one pane at a time behind a segmented control; both stay mounted so state (scroll, caret) survives.
 */
export function SplitView({ editor, preview }: { editor: ReactNode; preview: ReactNode }) {
  const ratio = usePortfolioStore((state) => state.splitRatio);
  const mobilePane = usePortfolioStore((state) => state.mobilePane);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div className="flex min-h-0 flex-1 flex-col print:block">
      <MobilePaneSwitch />
      <div
        ref={containerRef}
        style={{ "--split": `${(ratio * 100).toFixed(2)}%` } as CSSProperties}
        className="flex min-h-0 flex-1 lg:grid lg:grid-cols-[var(--split)_auto_minmax(0,1fr)] print:block"
      >
        <div className={cn("min-h-0 min-w-0 flex-1 lg:flex", mobilePane === "editor" ? "flex" : "hidden")}>{editor}</div>
        <Divider containerRef={containerRef} />
        <div className={cn("min-h-0 min-w-0 flex-1 lg:flex print:block", mobilePane === "preview" ? "flex" : "hidden")}>{preview}</div>
      </div>
    </div>
  );
}
