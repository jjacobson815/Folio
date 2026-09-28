"use client";

import { createContext, use } from "react";
import { THEMES, type ThemeDefinition } from "@/lib/themes";

export const PortfolioThemeContext = createContext<ThemeDefinition>(THEMES.glass);

/** React 19 `use()` reads the active design system's structural layout choices. */
export function usePortfolioTheme(): ThemeDefinition {
  return use(PortfolioThemeContext);
}
