import type { SourceFormat } from "./types";

export interface FormatDetection {
  format: SourceFormat;
  /** 0–1 confidence used for the editor's "detected" badge. */
  confidence: number;
}

const MARKDOWN_SIGNALS: ReadonlyArray<[RegExp, number]> = [
  [/^\s{0,3}#{1,6}\s+\S/, 3],
  [/\[[^\]]+\]\([^)]+\)/, 2],
  [/\*\*[^*]+\*\*|__[^_]+__/, 1],
  [/^\s{0,3}(?:-{3,}|\*{3,}|_{3,})\s*$/, 1],
  [/^\s*>\s/, 1],
  [/`[^`]+`/, 0.5],
  [/^\s*[-*+]\s+\S/, 0.5],
];

/** Cheap structural sniffing — no parsing — so it can run on every keystroke. */
export function detectFormat(source: string): FormatDetection {
  const trimmed = source.trim();
  if (!trimmed) return { format: "text", confidence: 0 };

  const unfenced = trimmed.replace(/^```(?:json5?|jsonc)?\s*\n/i, "");
  if (/^[{[]/.test(unfenced)) {
    const closes = /[}\]]\s*(?:```)?\s*$/.test(trimmed);
    const hasPairs = /"[^"\n]+"\s*:/.test(unfenced) || /^\s*[{[]\s*[\w$]+\s*:/m.test(unfenced);
    return { format: "json", confidence: closes && hasPairs ? 0.97 : 0.72 };
  }

  const lines = trimmed.split("\n");
  let score = 0;
  for (const line of lines) {
    for (const [pattern, weight] of MARKDOWN_SIGNALS) if (pattern.test(line)) score += weight;
  }
  if (score >= 3) {
    const density = score / Math.max(6, lines.length * 0.3);
    return { format: "markdown", confidence: Math.min(0.98, 0.62 + density * 0.3) };
  }
  return { format: "text", confidence: score > 0 ? 0.7 : 0.9 };
}
