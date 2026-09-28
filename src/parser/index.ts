import { detectFormat } from "./detect";
import { parseJsonResume } from "./json";
import { computeCompleteness, computeStats, finalizeResume } from "./normalize";
import { parseStructuredText } from "./structured";
import { normalizeSource } from "./text";
import type { Diagnostic, FormatPreference, ParseResult, Resume, SourceFormat } from "./types";

export { formatDate, formatRange, rangeDuration } from "./dates";
export { detectFormat } from "./detect";
export { toJsonResume, type JsonResumeDocument } from "./export";
export { prettyUrl } from "./text";
export type * from "./types";

export function emptyResume(): Resume {
  return {
    basics: { name: "", headline: "", availability: null, summary: [], contact: { email: null, phone: null, location: null, website: null, profiles: [] } },
    experience: [],
    projects: [],
    skills: [],
    education: [],
    certifications: [],
    awards: [],
    languages: [],
    extras: [],
  };
}

const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

/**
 * Pure, synchronous entry point: raw text in, strongly typed resume out.
 *
 * 1. Normalise the input and sniff its format (unless the user forced one).
 * 2. JSON → tolerant parse + alias mapping; on failure fall back to the text engine with an error diagnostic.
 * 3. Markdown / text → tokenizer → segmenter → per-section interpreters.
 * 4. Shared normalisation (fallbacks, inference, ids), then stats and a completeness score.
 */
export function parseResume(source: string, preference: FormatPreference = "auto"): ParseResult {
  const startedAt = now();
  const text = normalizeSource(source);
  const detected = detectFormat(text);
  const diagnostics: Diagnostic[] = [];

  if (!text.trim()) {
    const resume = emptyResume();
    return {
      resume,
      format: preference === "auto" ? "text" : preference,
      detected,
      diagnostics: [{ level: "info", code: "empty", message: "Paste a resume (Markdown, JSON or plain text) to generate your portfolio.", line: null }],
      stats: computeStats(resume),
      completeness: computeCompleteness(resume),
      elapsedMs: now() - startedAt,
      isEmpty: true,
    };
  }

  let format: SourceFormat = preference === "auto" ? detected.format : preference;
  if (preference !== "auto" && preference !== detected.format && detected.confidence >= 0.9) {
    diagnostics.push({
      level: "warning",
      code: "format-mismatch",
      message: `Input looks like ${detected.format.toUpperCase()} but ${preference.toUpperCase()} parsing is forced.`,
      line: null,
    });
  }

  let draft: Resume;
  if (format === "json") {
    const outcome = parseJsonResume(text);
    if (outcome.ok) {
      draft = outcome.resume;
      diagnostics.push(...outcome.diagnostics);
    } else {
      diagnostics.push(outcome.diagnostic);
      const fallback = parseStructuredText(text);
      draft = fallback.resume;
      format = "text";
    }
  } else {
    const parsed = parseStructuredText(text);
    draft = parsed.resume;
    diagnostics.push(...parsed.diagnostics);
  }

  const resume = finalizeResume(draft, diagnostics);
  const order: Record<Diagnostic["level"], number> = { error: 0, warning: 1, info: 2 };
  diagnostics.sort((a, b) => order[a.level] - order[b.level] || (a.line ?? 0) - (b.line ?? 0));

  return {
    resume,
    format,
    detected,
    diagnostics,
    stats: computeStats(resume),
    completeness: computeCompleteness(resume),
    elapsedMs: now() - startedAt,
    isEmpty: false,
  };
}
