/** Low-level string helpers shared by every parsing stage. */

export interface InlineLink {
  label: string;
  url: string;
}

const ZERO_WIDTH = /[​-‍⁠﻿]/g;

/** Normalises line endings, invisible characters and tabs so later regexes can stay simple. */
export function normalizeSource(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(ZERO_WIDTH, "")
    .replace(/[   ]/g, " ")
    .replace(/\t/g, "    ");
}

const MD_IMAGE = /!\[[^\]]*\]\([^)]*\)/g;
const MD_LINK = /\[([^\]]+)\]\(\s*<?([^)\s>]+)>?(?:\s+"[^"]*")?\s*\)/g;
const AUTOLINK = /<((?:https?:\/\/|mailto:)[^>\s]+)>/gi;
const URL_TLDS =
  "com|dev|io|app|ai|org|net|co|me|so|sh|xyz|design|tech|codes|page|site|studio|cloud|gg|fm|tv|us|uk|ca|de|fr|nl|in|au|eu|info|blog|link|social|works|build|engineer|tools";
const BARE_URL = new RegExp(
  String.raw`(?<![@\w./-])((?:https?:\/\/|www\.)[^\s<>"'\x60()|]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+(?:${URL_TLDS})(?:\/[^\s<>"'\x60()|]*)?)`,
  "gi",
);
const TRAILING_PUNCTUATION = /[.,;:!?'"\])}]+$/;

/** Known technology names that look like domains ("Socket.io", "ASP.NET"). */
const DOMAIN_LOOKALIKES = new Set(["socket.io", "asp.net", "fly.io", "vb.net", "ado.net", "dev.to", "render.com"]);

export function extractBareUrls(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(BARE_URL)) {
    const candidate = (match[1] ?? "").replace(TRAILING_PUNCTUATION, "");
    if (!candidate) continue;
    const hasScheme = /^(?:https?:\/\/|www\.)/i.test(candidate);
    if (!hasScheme) {
      // Bare domains must be lowercase ("maya.dev") or carry a path ("github.com/maya");
      // this keeps technology names such as "Node.js" or "ASP.NET" out of the link list.
      const hasPath = candidate.includes("/");
      if (!hasPath && candidate !== candidate.toLowerCase()) continue;
      if (DOMAIN_LOOKALIKES.has(candidate.toLowerCase()) && !hasPath) continue;
    }
    found.push(candidate);
  }
  return found;
}

/**
 * Strips inline Markdown (emphasis, code, links, HTML) and returns the plain text together with every
 * link that appeared in the line. Bare URLs are detected after stripping so they are captured as well.
 */
export function stripInlineMarkdown(input: string): { text: string; links: InlineLink[] } {
  const links: InlineLink[] = [];
  let text = input.replace(MD_IMAGE, "");
  text = text.replace(MD_LINK, (_match, label: string, url: string) => {
    links.push({ label: label.trim(), url: url.trim() });
    return label;
  });
  text = text.replace(AUTOLINK, (_match, url: string) => {
    links.push({ label: url, url });
    return url;
  });
  text = text
    .replace(/`([^`]+)`/g, "$1")
    .replace(/(\*\*|__)(?=\S)(.+?)(?<=\S)\1/g, "$2")
    .replace(/(?<![\w*])\*(?=\S)(.+?)(?<=\S)\*(?![\w*])/g, "$1")
    .replace(/(?<![\w_])_(?=\S)(.+?)(?<=\S)_(?![\w_])/g, "$1")
    .replace(/~~(.+?)~~/g, "$1")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\\([\\`*_{}[\]()#+\-.!|])/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  const known = new Set(links.map((link) => link.url.toLowerCase()));
  for (const url of extractBareUrls(text)) {
    if (known.has(url.toLowerCase())) continue;
    known.add(url.toLowerCase());
    links.push({ label: url, url });
  }
  return { text, links };
}

/** True when the entire line is wrapped in ** or __ (a common "sub-heading" idiom). */
export function isStrongOnly(raw: string): boolean {
  const match = /^\s*(\*\*|__)(.+)\1\s*:?\s*$/.exec(raw);
  return Boolean(match && !(match[2] ?? "").includes(match[1] ?? "**"));
}

export function wordCount(text: string): number {
  const trimmed = text.trim();
  return trimmed ? trimmed.split(/\s+/).length : 0;
}

export function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Removes decorative wrapping punctuation left behind after splitting a header line. */
export function trimDecorations(text: string): string {
  let result = text.replace(/^[\s,;:|/•·\-–—*_]+/, "").replace(/[\s,;:|/•·\-–—*_]+$/, "");
  // Unwrap "(…)" / "[…]" only when the brackets enclose the whole string.
  const wrapped = /^[([](.*)[)\]]$/.exec(result);
  if (wrapped && !/[()[\]]/.test(wrapped[1] ?? "")) result = wrapped[1] ?? "";
  // Drop dangling brackets left behind by an earlier split: "Acme (" or ") Remote".
  if (!result.includes(")")) result = result.replace(/\s*\($/, "").replace(/^\(\s*/, "");
  if (!result.includes("(")) result = result.replace(/^\)\s*/, "").replace(/\s*\)$/, "");
  if (!result.includes("]")) result = result.replace(/\s*\[$/, "").replace(/^\[\s*/, "");
  if (!result.includes("[")) result = result.replace(/^\]\s*/, "").replace(/\s*\]$/, "");
  return result.replace(/^[\s,;:|/•·\-–—]+|[\s,;:|/•·\-–—]+$/g, "").trim();
}

/** Strips leading emoji / pictographs such as "📍 Berlin" or "✉️ me@site.dev". */
export function stripLeadingSymbols(text: string): string {
  return text.replace(/^[\p{Extended_Pictographic}\p{So}️‍\s]+/u, "").trim();
}

const SMALL_WORDS = new Set(["a", "an", "and", "at", "by", "for", "in", "of", "on", "or", "the", "to", "with", "de", "van", "von", "da", "del", "la", "le", "bin"]);

export function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/(\s+|-)/)
    .map((word, index) => {
      if (!word.trim() || word === "-") return word;
      if (index > 0 && SMALL_WORDS.has(word)) return word;
      return word.charAt(0).toUpperCase() + word.slice(1);
    })
    .join("");
}

/**
 * Title-cases ALL-CAPS strings while keeping short acronyms: "ACME CORP" → "Acme Corp",
 * "BANK OF AMERICA" → "Bank of America", "IBM" stays "IBM". Mixed-case input is returned unchanged.
 */
export function smartCase(text: string): string {
  if (!isAllCaps(text)) return text;
  return text
    .split(/(\s+)/)
    .map((word, index) => {
      if (!word.trim()) return word;
      const lower = word.toLowerCase();
      if (index > 0 && SMALL_WORDS.has(lower)) return lower;
      if (word.replace(/[^\p{L}]/gu, "").length <= 3) return word;
      return word.charAt(0) + word.slice(1).toLowerCase();
    })
    .join("");
}

export function isAllCaps(text: string): boolean {
  const letters = text.replace(/[^\p{L}]/gu, "");
  return letters.length >= 2 && letters === letters.toUpperCase() && letters !== letters.toLowerCase();
}

/** "workExperience" / "open_source" / "side-projects" → "Work Experience" / "Open Source" / "Side Projects". */
export function humanizeKey(key: string): string {
  const spaced = key
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_\-.]+/g, " ")
    .trim();
  return titleCase(spaced);
}

/**
 * Splits a delimited list ("TypeScript, React · Node.js; Go") while respecting parentheses, so
 * "Cloud (AWS, GCP)" survives as a single item. Slashes are intentionally not separators (CI/CD, TCP/IP).
 */
export function splitList(text: string): string[] {
  const items: string[] = [];
  let depth = 0;
  let buffer = "";
  const flush = () => {
    const item = trimDecorations(buffer);
    if (item) items.push(item);
    buffer = "";
  };
  for (let index = 0; index < text.length; index++) {
    const char = text[index] ?? "";
    if (char === "(" || char === "[") depth++;
    if ((char === ")" || char === "]") && depth > 0) depth--;
    const isSeparator =
      depth === 0 && (char === "," || char === ";" || char === "|" || char === "·" || char === "•" || char === "∙" || char === "‧" || char === "⋅");
    if (isSeparator) {
      flush();
      continue;
    }
    buffer += char;
  }
  flush();
  return items;
}

export function normalizeUrl(url: string): string {
  const trimmed = url.trim().replace(TRAILING_PUNCTUATION, "");
  if (/^mailto:/i.test(trimmed) || /^tel:/i.test(trimmed)) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed.replace(/^\/+/, "")}`;
}

export function hostOf(url: string): string {
  try {
    return new URL(normalizeUrl(url)).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

/** Human-friendly link label: "github.com/maya/nebula" instead of the full https URL. */
export function prettyUrl(url: string): string {
  return url
    .replace(/^mailto:/i, "")
    .replace(/^https?:\/\//i, "")
    .replace(/^www\./i, "")
    .replace(/\/$/, "");
}

export function uniqueBy<T>(items: readonly T[], key: (item: T) => string): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const item of items) {
    const identity = key(item);
    if (seen.has(identity)) continue;
    seen.add(identity);
    result.push(item);
  }
  return result;
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Joins wrapped lines into paragraphs; blank-line separated groups become separate paragraphs. */
export function toParagraphs(lines: readonly string[]): string[] {
  const paragraphs: string[] = [];
  let buffer: string[] = [];
  for (const line of lines) {
    if (!line.trim()) {
      if (buffer.length) paragraphs.push(buffer.join(" "));
      buffer = [];
      continue;
    }
    buffer.push(line.trim());
  }
  if (buffer.length) paragraphs.push(buffer.join(" "));
  return paragraphs.map(collapseWhitespace).filter(Boolean);
}
