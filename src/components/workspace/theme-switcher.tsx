"use client";

import { flushSync } from "react-dom";
import { Tooltip } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { THEME_IDS, THEMES, isThemeId, type ThemeId } from "@/lib/themes";
import { prefersReducedMotion } from "@/lib/utils";
import { usePortfolioStore } from "@/store/portfolio-store";

/**
 * Switches design systems inside a View Transition when the browser supports it: flushSync commits the new
 * theme synchronously inside the transition callback so the browser can cross-fade old and new snapshots.
 */
function applyTheme(theme: ThemeId) {
  const setTheme = usePortfolioStore.getState().setTheme;
  if (typeof document.startViewTransition !== "function" || prefersReducedMotion()) {
    setTheme(theme);
    return;
  }
  document.startViewTransition(() => {
    flushSync(() => setTheme(theme));
  });
}

function Swatches({ colors }: { colors: readonly [string, string, string] }) {
  return (
    <span aria-hidden="true" className="flex -space-x-1.5">
      {colors.map((color, index) => (
        <span key={index} className="size-3.5 rounded-full ring-2 ring-card" style={{ backgroundColor: color, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / 0.12)" }} />
      ))}
    </span>
  );
}

export function ThemeSwitcher() {
  const theme = usePortfolioStore((state) => state.theme);
  return (
    <ToggleGroup type="single" value={theme} onValueChange={(value) => isThemeId(value) && applyTheme(value)} aria-label="Portfolio design system">
      {THEME_IDS.map((id) => {
        const definition = THEMES[id];
        return (
          <Tooltip
            key={id}
            content={
              <span className="flex flex-col gap-0.5">
                <span className="font-semibold">{definition.name}</span>
                <span className="opacity-80">{definition.description}</span>
              </span>
            }
          >
            <ToggleGroupItem value={id} aria-label={definition.name} className="h-8 gap-2 px-2 sm:px-2.5">
              <Swatches colors={definition.swatches} />
              <span className="hidden md:inline">{definition.shortName}</span>
            </ToggleGroupItem>
          </Tooltip>
        );
      })}
    </ToggleGroup>
  );
}
