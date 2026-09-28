export const THEME_IDS = ["minimal", "brutalist", "glass"] as const;
export type ThemeId = (typeof THEME_IDS)[number];

/**
 * Colors, type and surfaces live in CSS (globals.css, keyed by [data-theme]); this object holds the
 * structural decisions each design system makes, which components read through PortfolioThemeContext.
 */
export interface ThemeDefinition {
  id: ThemeId;
  name: string;
  shortName: string;
  description: string;
  /** Three swatches for the theme picker: background, accent, secondary accent. */
  swatches: readonly [string, string, string];
  colorScheme: "light" | "dark";
  layout: {
    hero: "editorial" | "blocks" | "spotlight";
    experience: "rows" | "cards" | "timeline";
    projects: "list" | "grid";
    skills: "definition" | "blocks" | "pills";
  };
}

export const THEMES: Record<ThemeId, ThemeDefinition> = {
  minimal: {
    id: "minimal",
    name: "Minimalist Monochrome",
    shortName: "Minimal",
    description: "Editorial serif type, generous whitespace, pure black on white.",
    swatches: ["#fcfcfc", "#111111", "#8a8a8a"],
    colorScheme: "light",
    layout: { hero: "editorial", experience: "rows", projects: "list", skills: "definition" },
  },
  brutalist: {
    id: "brutalist",
    name: "Tech Neo-Brutalism",
    shortName: "Brutal",
    description: "Thick borders, hard shadows, rigid grids and acid accents.",
    swatches: ["#f2efe6", "#c6f432", "#ff5a36"],
    colorScheme: "light",
    layout: { hero: "blocks", experience: "cards", projects: "grid", skills: "blocks" },
  },
  glass: {
    id: "glass",
    name: "Glassmorphic Dark",
    shortName: "Glass",
    description: "Frosted surfaces, soft glows and gradient type on deep ink.",
    swatches: ["#07070d", "#a78bfa", "#22d3ee"],
    colorScheme: "dark",
    layout: { hero: "spotlight", experience: "timeline", projects: "grid", skills: "pills" },
  },
};

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && (THEME_IDS as readonly string[]).includes(value);
}
