import { hasAnyDate, hasDateRange } from "./dates";
import { isContentLine, type SourceLine } from "./lines";
import { extractBareUrls, wordCount, type InlineLink } from "./text";

export interface EntryLine {
  text: string;
  links: InlineLink[];
  line: number;
  strong: boolean;
}

/** A titled block inside a section: header lines (title, org, dates), prose body and highlight bullets. */
export interface RawEntry {
  header: EntryLine[];
  body: EntryLine[];
  bullets: EntryLine[];
  line: number;
}

/** "Stack: React, Go" / "Built with: …" lines carry metadata rather than narrative. */
export const META_LINE_RE =
  /^(tech(?:nologies)?|tech stack|stack|tools|tooling|built with|skills|environment|keywords|languages & tools|made with)\s*[:\-–—]\s*(.+)$/i;
export const LINK_LINE_RE = /^(links?|repo(?:sitory)?|source|source code|code|demo|live|live demo|website|url|site|app)\s*[:\-–—]\s*(.+)$/i;

export function toEntryLine(line: SourceLine): EntryLine {
  return { text: line.text, links: line.links, line: line.number, strong: line.strong };
}

/** Narrative sentences rather than title-like fragments. */
export function isProse(text: string): boolean {
  const words = wordCount(text);
  return (/[.!?]$/.test(text) && words > 8) || words > 18 || (text.length > 120 && !hasAnyDate(text));
}

function isUrlOnly(line: SourceLine): boolean {
  if (!line.links.length) return false;
  let remainder = line.text;
  for (const link of line.links) remainder = remainder.replace(link.label, "").replace(link.url, "");
  for (const url of extractBareUrls(remainder)) remainder = remainder.replace(url, "");
  return remainder.replace(/[\s|•·,;:()[\]\-–—]/g, "").length <= 3;
}

const TITLED_TEXT_RE = /^(.{2,48}?)\s+(?:—|–|-|:)\s+\S/;

/** "- **Nebula** — …" or "- Nebula — …": a bullet that names something before describing it. */
function isTitledBullet(line: SourceLine): boolean {
  if (/^\s*(?:[-*+•]|\d{1,2}[.)])\s+(?:\*\*|__)/.test(line.raw)) return true;
  const match = TITLED_TEXT_RE.exec(line.text);
  return Boolean(match && wordCount(match[1] ?? "") <= 5);
}

/** Hard-wrapped bullet text: the next physical line is indented or starts lowercase. */
function isContinuation(line: SourceLine): boolean {
  return line.indent >= 2 || /^[a-z(&%$0-9]/.test(line.text);
}

function nextContentLine(lines: readonly SourceLine[], index: number): SourceLine | null {
  for (let cursor = index + 1; cursor < lines.length; cursor++) {
    const candidate = lines[cursor];
    if (candidate && isContentLine(candidate)) return candidate;
  }
  return null;
}

function appendText(target: EntryLine, line: SourceLine) {
  target.text = `${target.text} ${line.text}`.trim();
  target.links = [...target.links, ...line.links];
}

/**
 * Groups a section's lines into entries. Rules, in priority order:
 * 1. Markdown sub-headings (and top-level bullets that own nested bullets) always open an entry.
 * 2. Metadata lines ("Stack: …", bare URLs) attach to the current entry's body.
 * 3. After an entry has content, a non-prose line starts the next entry.
 * 4. A second date range inside a header means a new entry ("Engineer, Beta (2018–2020)").
 * 5. Otherwise short lines extend the header (company line, role line, date line), prose goes to the body.
 */
export function groupEntries(lines: readonly SourceLine[]): RawEntry[] {
  const entries: RawEntry[] = [];
  let current: RawEntry | null = null;
  let currentHeadingLevel: number | null = null;
  let gap = false;

  /** True when the active entry's title came from a top-level bullet ("- **Nebula** — …"). */
  let startedByBullet = false;
  const start = (line: SourceLine): RawEntry => {
    const entry: RawEntry = { header: [toEntryLine(line)], body: [], bullets: [], line: line.number };
    entries.push(entry);
    current = entry;
    currentHeadingLevel = line.kind === "heading" ? line.level : null;
    startedByBullet = line.kind === "bullet";
    return entry;
  };
  const ensure = (line: SourceLine): RawEntry => {
    if (current) return current;
    const entry: RawEntry = { header: [], body: [], bullets: [], line: line.number };
    entries.push(entry);
    current = entry;
    currentHeadingLevel = null;
    return entry;
  };
  const hasContent = (entry: RawEntry) => entry.body.length > 0 || entry.bullets.length > 0;
  const headerHasDate = (entry: RawEntry) => entry.header.some((header) => hasAnyDate(header.text));
  /** Where the previous content line was placed; continuation lines follow it there. */
  let placement: "header" | "body" | "meta" | "bullet" | null = null;

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    if (!line) continue;
    if (!isContentLine(line)) {
      gap = true;
      continue;
    }
    const active = current as RawEntry | null;

    if (line.kind === "heading") {
      if (active && !hasContent(active) && currentHeadingLevel !== null && line.level > currentHeadingLevel) {
        active.header.push(toEntryLine(line));
      } else {
        start(line);
      }
      placement = "header";
    } else if (line.kind === "bullet") {
      const next = nextContentLine(lines, index);
      const ownsNested = line.level === 0 && next?.kind === "bullet" && next.level > line.level;
      // A top-level bullet following a bullet-titled entry is that entry's sibling, not its highlight.
      const siblingOfBulletEntry = line.level === 0 && startedByBullet;
      if ((ownsNested || siblingOfBulletEntry) && (!isProse(line.text) || isTitledBullet(line))) {
        start(line);
        placement = "header";
      } else {
        ensure(line).bullets.push(toEntryLine(line));
        placement = "bullet";
      }
    } else {
      const text = line.text;
      const meta = META_LINE_RE.test(text) || LINK_LINE_RE.test(text) || isUrlOnly(line);
      const lastBullet = active?.bullets.at(-1);
      const lastBody = active?.body.at(-1);
      const sentence = /[.!?]$/.test(text) && !hasDateRange(text);

      if (!active) {
        start(line);
        placement = "header";
      } else if (meta) {
        active.body.push(toEntryLine(line));
        placement = "meta";
      } else if (!gap && placement === "bullet" && lastBullet && isContinuation(line)) {
        appendText(lastBullet, line);
      } else if (!gap && placement === "body" && lastBody && (isContinuation(line) || sentence)) {
        if (isContinuation(line)) appendText(lastBody, line);
        else active.body.push(toEntryLine(line));
      } else if (hasContent(active)) {
        if ((isProse(text) || (sentence && placement !== "bullet")) && !hasDateRange(text)) {
          active.body.push(toEntryLine(line));
          placement = "body";
        } else {
          start(line);
          placement = "header";
        }
      } else if (hasAnyDate(text) && headerHasDate(active)) {
        start(line);
        placement = "header";
      } else if (isProse(text)) {
        active.body.push(toEntryLine(line));
        placement = "body";
      } else if (gap && headerHasDate(active)) {
        start(line);
        placement = "header";
      } else if (active.header.length < 4) {
        active.header.push(toEntryLine(line));
        placement = "header";
      } else {
        active.body.push(toEntryLine(line));
        placement = "body";
      }
    }
    gap = false;
  }

  return entries.filter((entry) => entry.header.length || entry.body.length || entry.bullets.length);
}

const NAME_DESCRIPTION_RE = /^(.{2,60}?)\s*(?::|—|–|\s-\s|\|)\s*(.{8,})$/;

function entryFromBullet(bullet: EntryLine, splitName: boolean): RawEntry {
  if (splitName) {
    const match = NAME_DESCRIPTION_RE.exec(bullet.text);
    if (match && wordCount(match[1] ?? "") <= 7) {
      return {
        header: [{ ...bullet, text: (match[1] ?? "").trim() }],
        body: [{ ...bullet, text: (match[2] ?? "").trim() }],
        bullets: [],
        line: bullet.line,
      };
    }
  }
  return { header: [bullet], body: [], bullets: [], line: bullet.line };
}

/**
 * Sections written as flat bullet lists ("- Engineer, Acme (2019–2021)" or "- **Nebula**: a CRDT editor")
 * are exploded so that every bullet becomes its own entry.
 */
export function explodeBulletEntries(entries: RawEntry[], mode: "experience" | "projects" | "education"): RawEntry[] {
  const result: RawEntry[] = [];
  for (const entry of entries) {
    if (entry.header.length > 0 || entry.bullets.length === 0) {
      result.push(entry);
      continue;
    }
    const bullets = entry.bullets;
    if (mode === "experience") {
      const dated = bullets.filter((bullet) => hasDateRange(bullet.text)).length;
      if (dated / bullets.length < 0.5) {
        result.push(entry);
        continue;
      }
      let owner: RawEntry | null = null;
      for (const bullet of bullets) {
        if (hasDateRange(bullet.text) || !owner) {
          owner = entryFromBullet(bullet, false);
          result.push(owner);
        } else {
          owner.bullets.push(bullet);
        }
      }
      continue;
    }
    if (mode === "projects") {
      const named = bullets.filter((bullet) => bullet.strong || NAME_DESCRIPTION_RE.test(bullet.text)).length;
      if (named / bullets.length < 0.5) {
        result.push(entry);
        continue;
      }
      for (const bullet of bullets) result.push(entryFromBullet(bullet, true));
      continue;
    }
    for (const bullet of bullets) result.push(entryFromBullet(bullet, false));
  }
  return result;
}

/**
 * Flattens a section into single-line items (for certifications, awards, languages, custom sections),
 * merging hard-wrapped continuation lines back into the item they belong to.
 */
export function sectionItems(lines: readonly SourceLine[]): EntryLine[] {
  const items: EntryLine[] = [];
  let previous: SourceLine | null = null;
  let gap = false;
  for (const line of lines) {
    if (!isContentLine(line)) {
      gap = true;
      continue;
    }
    const last = items.at(-1);
    if (last && !gap && previous && line.kind === "text" && isContinuation(line)) {
      appendText(last, line);
    } else {
      items.push(toEntryLine(line));
    }
    gap = false;
    previous = line;
  }
  return items;
}
