"use client";

import { Lock, Monitor, Smartphone, Tablet } from "lucide-react";
import { memo } from "react";
import { EmptyPortfolio } from "@/components/portfolio/empty-portfolio";
import { PortfolioView } from "@/components/portfolio/portfolio-view";
import { Tooltip } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn, vanityDomain } from "@/lib/utils";
import type { ParseResult } from "@/parser";
import { usePortfolioStore, type PreviewDevice } from "@/store/portfolio-store";

const DEVICES: ReadonlyArray<{ id: PreviewDevice; label: string; icon: typeof Monitor }> = [
  { id: "desktop", label: "Desktop", icon: Monitor },
  { id: "tablet", label: "Tablet · 820px", icon: Tablet },
  { id: "mobile", label: "Mobile · 390px", icon: Smartphone },
];

const FRAME_WIDTH: Record<PreviewDevice, string> = {
  desktop: "max-w-full",
  tablet: "sm:max-w-[820px]",
  mobile: "sm:max-w-[390px]",
};

function SyncIndicator({ isStale }: { isStale: boolean }) {
  return (
    <span role="status" aria-live="polite" className="relative inline-flex h-6 items-center text-xs font-medium">
      {/* The "Updating" label only appears if a render is pending for >150ms, so fast typing never flickers. */}
      <span className={cn("inline-flex items-center gap-1.5 text-success transition-opacity duration-200", isStale ? "opacity-0" : "opacity-100")}>
        <span className="size-1.5 animate-pulse-ring rounded-full bg-current" />
        Live
      </span>
      <span
        className={cn(
          "absolute inset-y-0 left-0 inline-flex items-center gap-1.5 whitespace-nowrap text-muted-foreground transition-opacity",
          isStale ? "opacity-100 delay-150 duration-200" : "opacity-0 duration-100",
        )}
      >
        <span className="size-1.5 animate-pulse rounded-full bg-warning" />
        Updating
      </span>
      <span className="sr-only">{isStale ? "Preview updating" : "Preview up to date"}</span>
    </span>
  );
}

function DeviceSwitcher() {
  const device = usePortfolioStore((state) => state.device);
  const setDevice = usePortfolioStore((state) => state.setDevice);
  return (
    <ToggleGroup
      type="single"
      value={device}
      onValueChange={(value) => value && setDevice(value as PreviewDevice)}
      aria-label="Preview width"
      className="hidden sm:inline-flex"
    >
      {DEVICES.map(({ id, label, icon: Icon }) => (
        <Tooltip key={id} content={label}>
          <ToggleGroupItem value={id} aria-label={label} className="px-2">
            <Icon aria-hidden="true" />
          </ToggleGroupItem>
        </Tooltip>
      ))}
    </ToggleGroup>
  );
}

/**
 * Memoised so the urgent (keystroke) render skips it: `result` is the previous deferred parse by reference and
 * `isStale` only flips at the start/end of a burst. The heavy <PortfolioView> below is memoised separately.
 */
export const PreviewPanel = memo(function PreviewPanel({ result, isStale }: { result: ParseResult; isStale: boolean }) {
  const theme = usePortfolioStore((state) => state.theme);
  const device = usePortfolioStore((state) => state.device);

  return (
    <section
      aria-label="Live portfolio preview"
      className="flex h-full min-h-0 w-full flex-col bg-canvas bg-[radial-gradient(var(--canvas-dot)_1px,transparent_1px)] bg-size-[20px_20px] print:block print:h-auto print:bg-none"
    >
      <div className="flex h-12 shrink-0 items-center gap-3 border-b bg-background/70 px-3 backdrop-blur sm:px-4 print:hidden">
        <div aria-hidden="true" className="hidden gap-1.5 md:flex">
          <span className="size-2.5 rounded-full bg-[#ff5f57]" />
          <span className="size-2.5 rounded-full bg-[#febc2e]" />
          <span className="size-2.5 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex h-7 min-w-0 flex-1 items-center justify-center gap-1.5 rounded-md bg-muted px-3 text-xs text-muted-foreground md:max-w-80 md:flex-none md:grow">
          <Lock aria-hidden="true" className="size-3 shrink-0" />
          <span className="truncate">{vanityDomain(result.resume.basics.name)}</span>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <SyncIndicator isStale={isStale} />
          <DeviceSwitcher />
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden sm:p-4 print:overflow-visible print:p-0">
        <div
          className={cn(
            "mx-auto h-full overflow-hidden bg-card transition-[max-width] duration-500 ease-out-expo sm:rounded-xl sm:border sm:shadow-2xl sm:shadow-black/10",
            FRAME_WIDTH[device],
            "print:h-auto print:max-w-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none",
          )}
        >
          <div
            className="h-full overflow-y-auto overscroll-contain scrollbar-thin print:h-auto print:overflow-visible"
            style={{ viewTransitionName: "portfolio-frame" }}
          >
            {result.isEmpty ? (
              <EmptyPortfolio />
            ) : (
              // Keyed by theme: switching design systems remounts the tree so its entry animations replay.
              <PortfolioView key={theme} resume={result.resume} stats={result.stats} themeId={theme} />
            )}
          </div>
        </div>
      </div>
    </section>
  );
});
