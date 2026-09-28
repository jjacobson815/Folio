import { isAllCaps, isStrongOnly, stripInlineMarkdown, wordCount, type InlineLink } from "./text";

export type LineKind = "blank" | "rule" | "heading" | "bullet" | "text";

/**
 * How a line signals "I am a heading":
 * - atx / setext: real Markdown headings
 * - caps: "WORK EXPERIENCE"
 * - colon: "Experience:" on its own line
 * - bold: "**Experience**" on its own line
 */
export type HeadingStyle = "atx" | "setext" | "caps" | "colon" | "bold";

export interface SourceLine {
  /** 1-based line number in the original input. */
  number: number;
  raw: string;
  /** Inline-Markdown-stripped, whitespace-collapsed content. */
  text: string;
  kind: LineKind;
  /** Heading level (1–6) for headings, nesting depth for bullets, 0 otherwise. */
  level: number;
  indent: number;
  /** For headings: atx/setext. For text lines: the heading idiom they resemble, if any. */
  style: HeadingStyle | null;
  links: InlineLink[];
  /** The whole line is wrapped in bold markers. */
  strong: boolean;
}

const RULE_RE = /^\s{0,3}([-*_=~])(?:\s*\1){2,}\s*$/;
const SETEXT_RE = /^\s{0,3}(=+|-+)\s*$/;
const ATX_RE = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/;
const BULLET_RE = /^(\s*)(?:[-*+•●○◦▪▫■□▸▹►▻‣⁃∙·➢➤➔→✓✔✗☐✅–—]|\d{1,2}[.)])\s+(.*\S)\s*$/;
const SPACED_CAPS_RE = /^(?:[A-Z]\s){2,}[A-Z]$/;

function headingStyleOf(trimmed: string, text: string, strong: boolean): HeadingStyle | null {
  if (!text) return null;
  if (strong) return "bold";
  if (/^[^:]{2,48}:$/.test(text)) return "colon";
  if (isAllCaps(text) && text.length <= 48 && wordCount(text) <= 6 && !/[@]|https?:/i.test(trimmed) && !/\d{3,}/.test(text)) {
    return "caps";
  }
  return null;
}

/** Splits normalised source into typed lines. Markdown and plain text share this tokenizer. */
export function tokenize(source: string): SourceLine[] {
  const rawLines = source.split("\n");
  const lines: SourceLine[] = [];

  for (let index = 0; index < rawLines.length; index++) {
    const raw = rawLines[index] ?? "";
    const trimmed = raw.trim();
    const indent = raw.length - raw.trimStart().length;
    const base = { number: index + 1, raw, indent, links: [] as InlineLink[], strong: false, style: null, level: 0 };

    if (!trimmed) {
      lines.push({ ...base, text: "", kind: "blank" });
      continue;
    }

    // Setext underline ("Experience\n==========") promotes the previous text line to a heading.
    if (SETEXT_RE.test(raw) && trimmed.length >= 3) {
      const previous = lines.at(-1);
      if (previous && previous.kind === "text" && previous.text.length <= 60) {
        previous.kind = "heading";
        previous.style = "setext";
        previous.level = trimmed.startsWith("=") ? 1 : 2;
        lines.push({ ...base, text: "", kind: "rule" });
        continue;
      }
    }

    if (RULE_RE.test(raw)) {
      lines.push({ ...base, text: "", kind: "rule" });
      continue;
    }

    const atx = ATX_RE.exec(raw);
    if (atx) {
      const { text, links } = stripInlineMarkdown(atx[2] ?? "");
      if (text) {
        lines.push({ ...base, text, links, kind: "heading", style: "atx", level: (atx[1] ?? "#").length });
        continue;
      }
    }

    const bullet = BULLET_RE.exec(raw);
    if (bullet) {
      const content = bullet[2] ?? "";
      const { text, links } = stripInlineMarkdown(content);
      lines.push({
        ...base,
        text,
        links,
        kind: "bullet",
        level: Math.min(Math.floor((bullet[1] ?? "").length / 2), 4),
        strong: isStrongOnly(content),
      });
      continue;
    }

    const stripped = stripInlineMarkdown(trimmed);
    const text = SPACED_CAPS_RE.test(stripped.text) ? stripped.text.replace(/\s/g, "") : stripped.text;
    const strong = isStrongOnly(trimmed);
    lines.push({ ...base, text, links: stripped.links, strong, kind: "text", style: headingStyleOf(trimmed, text, strong) });
  }

  return lines;
}

export function isContentLine(line: SourceLine): boolean {
  return line.kind !== "blank" && line.kind !== "rule";
}

/** Makes a synthetic line (used when "Skills: React, Go" is split into a heading and its content). */
export function syntheticLine(from: SourceLine, text: string): SourceLine {
  return { ...from, text, kind: "text", style: null, strong: false };
}
