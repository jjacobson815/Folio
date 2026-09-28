import { hasDateRange } from "./dates";
import { isContentLine, syntheticLine, type SourceLine } from "./lines";
import { classifySectionTitle, ENTRY_SECTIONS, type SectionKind, type SectionMatch } from "./sections";
import { smartCase, wordCount } from "./text";

export interface RawSection {
  kind: SectionKind;
  title: string;
  lines: SourceLine[];
  /** Markdown heading level that opened the section, or null for caps/colon/bold/inline headings. */
  level: number | null;
  /** 1-based line of the heading. */
  line: number;
}

export interface Outline {
  header: SourceLine[];
  sections: RawSection[];
  /** True when sections were inferred heuristically because the text had no recognisable headings. */
  inferred: boolean;
}

const INLINE_SECTION_RE = /^([^:]{2,40}):\s+(\S.*)$/;

function cleanTitle(text: string): string {
  return smartCase(text.replace(/:\s*$/, "").trim());
}

/**
 * Decides whether a text line styled like a heading should open a new section. Inside entry sections,
 * "Key projects:" or "Achievements:" directly under a bullet list are entry labels, so non-caps headings
 * there must be separated from the previous content by a blank line.
 */
function opensSection(line: SourceLine, match: SectionMatch, current: RawSection | null, separated: boolean): boolean {
  if (current && match.kind === current.kind) return false;
  // "Languages" under Skills is a category label, not the spoken-languages section.
  if (current?.kind === "skills" && match.kind === "languages") return false;
  if (current === null || line.style === "caps") return true;
  if (current.kind === "skills") return match.strength === "strong";
  if (ENTRY_SECTIONS.has(current.kind)) return match.strength === "strong" && separated;
  return true;
}

/**
 * Splits the token stream into a header zone (name, headline, contact) and typed sections.
 * Handles Markdown heading hierarchies, ALL-CAPS / underlined / "Title:" headings and inline
 * "Skills: React, Go" one-liners, while keeping entry-level labels ("Tools: …") inside their entry.
 */
export function segment(lines: readonly SourceLine[]): Outline {
  const header: SourceLine[] = [];
  const sections: RawSection[] = [];
  let current: RawSection | null = null;

  const open = (kind: SectionKind, title: string, line: SourceLine, level: number | null): RawSection => {
    const section: RawSection = { kind, title: cleanTitle(title), lines: [], level, line: line.number };
    sections.push(section);
    current = section;
    return section;
  };
  const push = (line: SourceLine) => {
    if (current) current.lines.push(line);
    else header.push(line);
  };

  let previous: SourceLine | null = null;
  for (const line of lines) {
    const active = current as RawSection | null;
    const separated = previous === null || !isContentLine(previous);
    previous = line;

    if (line.kind === "heading") {
      const deeper = active?.level != null && line.level > active.level;
      const match = classifySectionTitle(line.text, { allowKeywords: !deeper });
      if (match && !deeper && !(active && match.kind === active.kind && match.strength === "weak")) {
        open(match.kind, line.text, line, line.level);
        continue;
      }
      // Unknown heading at the same (or shallower) level as the active section starts a custom section.
      if (!match && active && !deeper && (active.level === null ? line.level <= 2 : line.level <= active.level)) {
        open("other", line.text, line, line.level);
        continue;
      }
      push(line);
      continue;
    }

    if (line.kind === "text") {
      const headingLike = line.style !== null || (wordCount(line.text) <= 4 && !/[.,;]$/.test(line.text));
      if (headingLike) {
        const match = classifySectionTitle(line.text);
        const acceptable = match && (line.style !== null || match.strength === "strong");
        if (match && acceptable && opensSection(line, match, active, separated)) {
          open(match.kind, line.text, line, null);
          continue;
        }
        // Unknown ALL-CAPS heading outside entry context ("VOLUNTEERING") becomes a custom section.
        if (
          !match &&
          line.style === "caps" &&
          active &&
          !ENTRY_SECTIONS.has(active.kind) &&
          active.kind !== "skills" &&
          wordCount(line.text) <= 4 &&
          !/\d/.test(line.text)
        ) {
          open("other", line.text, line, null);
          continue;
        }
      }

      // Inline one-liner: "Skills: TypeScript, React" or "Summary: Product-minded engineer…"
      const inline = INLINE_SECTION_RE.exec(line.text);
      if (inline && line.kind === "text" && !line.links.some((link) => (inline[1] ?? "").includes(link.label))) {
        const match = classifySectionTitle(inline[1] ?? "");
        // Inside entries, "Stack: …" / "Achievements: …" are entry labels; only a blank-line-separated, strong,
        // non-skills alias ("Education: …") breaks out. Inside Skills, weak labels ("Languages:", "Tools:") stay put.
        const blocked =
          active !== null &&
          (active.kind === match?.kind ||
            (ENTRY_SECTIONS.has(active.kind) && !(separated && match?.strength === "strong" && match.kind !== "skills")) ||
            (active.kind === "skills" && match?.strength !== "strong"));
        const allowed = match && !blocked && (match.strength === "strong" || active === null || active.kind !== "summary");
        if (match && allowed) {
          const section = open(match.kind, inline[1] ?? "", line, null);
          section.lines.push(syntheticLine(line, inline[2] ?? ""));
          continue;
        }
      }
    }

    push(line);
  }

  if (sections.length === 0) return inferSections(header);
  return { header, sections, inferred: false };
}

/**
 * Fallback for unstructured text with no headings: the first date-bearing line marks the start of work history,
 * everything before it is treated as the header (name, headline, contact, summary).
 */
function inferSections(lines: SourceLine[]): Outline {
  const firstDated = lines.findIndex((line, index) => index > 0 && isContentLine(line) && hasDateRange(line.text));
  if (firstDated <= 0) return { header: lines, sections: [], inferred: false };

  // Walk back over up to two title lines that belong to the first entry ("Acme Corp" above "Engineer, 2019–2021").
  let start = firstDated;
  for (let step = 0; step < 2; step++) {
    const previous = lines[start - 1];
    if (!previous || !isContentLine(previous) || previous.kind === "bullet" || wordCount(previous.text) > 10) break;
    start--;
  }
  if (start === 0) start = firstDated;

  const anchor = lines[start] ?? lines[0];
  if (!anchor) return { header: lines, sections: [], inferred: false };
  return {
    header: lines.slice(0, start),
    sections: [{ kind: "experience", title: "Experience", lines: lines.slice(start), level: null, line: anchor.number }],
    inferred: true,
  };
}
