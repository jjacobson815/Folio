import { EMAIL_RE, emptyContact, scanContactLines, type ContactScan } from "./contact";
import { isProse } from "./entries";
import {
  contactLines,
  interpretAwards,
  interpretCertifications,
  interpretCustom,
  interpretEducation,
  interpretEntrySection,
  interpretExperience,
  interpretLanguages,
  interpretProject,
  interpretSkills,
  interpretSummary,
} from "./interpret";
import { tokenize, type SourceLine } from "./lines";
import { segment, type RawSection } from "./segment";
import { SECTION_TITLES } from "./sections";
import { titleCase, wordCount } from "./text";
import type { Diagnostic, Resume, SkillGroup } from "./types";

const NAME_RE = /^[\p{Lu}][\p{L}'’.-]*(?:\s+(?:[\p{Lu}][\p{L}'’.-]*|de|da|del|della|di|du|la|le|van|von|der|den|bin|al|y|dos|das))*$/u;
const NOT_A_NAME = /\b(resume|résumé|curriculum|vitae|cv|portfolio|engineer|developer|designer|manager|summary|profile|experience|contact)\b/i;

function looksLikeName(text: string, isHeading: boolean): boolean {
  const words = wordCount(text);
  if (words < (isHeading ? 1 : 2) || words > 5 || text.length > 50) return false;
  return NAME_RE.test(text) && !NOT_A_NAME.test(text);
}

interface Identity {
  name: string;
  headline: string;
  prose: string[];
}

/** Picks name, headline and loose summary prose from the header chunks the contact scan did not consume. */
function resolveIdentity(scan: ContactScan, headerLines: ReadonlySet<SourceLine>): Identity {
  let name = scan.labeledName ?? "";
  let headline = scan.labeledHeadline ?? "";
  const prose: string[] = [];

  for (const { line, chunks } of scan.leftovers) {
    if (!headerLines.has(line)) continue;
    let index = 0;
    if (!name) {
      const first = chunks[0] ?? "";
      const isHeading = line.kind === "heading";
      // Markdown H1s are trusted as names even when unconventionally cased ("maya okafor").
      const headingName = isHeading && wordCount(first) <= 6 && !isProse(first) && !NOT_A_NAME.test(first) && !/\d/.test(first);
      if (headingName || looksLikeName(first, isHeading)) {
        name = first;
        index = 1;
      }
    }
    const rest = chunks.slice(index);
    if (!rest.length) continue;
    const joined = rest.join(" — ");
    if (name && !headline && !isProse(joined) && wordCount(joined) <= 16 && !/[.!?]$/.test(joined)) {
      headline = joined;
      continue;
    }
    for (const chunk of rest) if (chunk.length >= 25 || isProse(chunk)) prose.push(chunk);
  }

  if (name && name === name.toUpperCase()) name = titleCase(name);
  return { name: name.replace(/^#+\s*/, "").trim(), headline, prose };
}

function describeEntry(role: string, company: string): string {
  if (role && company) return `“${role}” at ${company}`;
  return `“${role || company}”`;
}

export interface StructuredParse {
  resume: Resume;
  diagnostics: Diagnostic[];
}

/** Parses Markdown or plain-text resumes into the typed schema. */
export function parseStructuredText(source: string): StructuredParse {
  const diagnostics: Diagnostic[] = [];
  const lines = tokenize(source);
  const outline = segment(lines);

  if (outline.inferred) {
    diagnostics.push({
      level: "info",
      code: "sections-inferred",
      message: "No section headings found — work history was inferred from date ranges.",
      line: outline.sections[0]?.line ?? null,
    });
  } else if (!outline.sections.length) {
    diagnostics.push({
      level: "warning",
      code: "no-sections",
      message: "No section headings detected. Add headings such as “Experience”, “Projects” or “## Skills” for richer results.",
      line: null,
    });
  }

  const byKind = (kind: RawSection["kind"]) => outline.sections.filter((section) => section.kind === kind);

  const seenKinds = new Map<string, number>();
  for (const section of outline.sections) {
    if (section.kind === "other") continue;
    const count = (seenKinds.get(section.kind) ?? 0) + 1;
    seenKinds.set(section.kind, count);
    if (count === 2) {
      diagnostics.push({
        level: "info",
        code: "section-merged",
        message: `Multiple “${SECTION_TITLES[section.kind]}” sections were merged.`,
        line: section.line,
      });
    }
  }

  const headerSet = new Set(outline.header);
  const scan = scanContactLines([...outline.header, ...byKind("contact").flatMap(contactLines)], emptyContact());
  const identity = resolveIdentity(scan, headerSet);
  const contact = scan.contact;
  if (!contact.email) {
    const email = EMAIL_RE.exec(source);
    if (email) contact.email = email[0];
  }

  const summarySections = byKind("summary");
  const summary = summarySections.length ? summarySections.flatMap(interpretSummary) : identity.prose;

  const experience = byKind("experience").flatMap((section) =>
    interpretEntrySection(section, "experience").map((entry) => {
      const parsed = interpretExperience(entry);
      if (!parsed.role && !parsed.company && parsed.highlights.length) {
        diagnostics.push({
          level: "warning",
          code: "experience-untitled",
          message: "An experience entry has highlights but no role or company line above them.",
          line: entry.line,
        });
      } else if (!parsed.period) {
        diagnostics.push({
          level: "info",
          code: "experience-undated",
          message: `No dates found for ${describeEntry(parsed.role, parsed.company)}.`,
          line: entry.line,
        });
      }
      return parsed;
    }),
  );

  const projects = byKind("projects").flatMap((section) => interpretEntrySection(section, "projects").map(interpretProject));
  const education = byKind("education").flatMap((section) => interpretEntrySection(section, "education").map(interpretEducation));

  const skillGroups: Array<Omit<SkillGroup, "id">> = byKind("skills").flatMap(interpretSkills);
  const certifications = byKind("certifications").flatMap(interpretCertifications);
  const awards = byKind("awards").flatMap(interpretAwards);
  const languages = byKind("languages").flatMap(interpretLanguages);

  const extras = byKind("other")
    .map((section) => ({ title: section.title, items: interpretCustom(section), line: section.line }))
    .filter((section) => section.items.length > 0);
  for (const extra of extras) {
    diagnostics.push({
      level: "info",
      code: "custom-section",
      message: `“${extra.title}” isn't a standard section — it's shown as a custom block.`,
      line: extra.line,
    });
  }

  const resume: Resume = {
    basics: {
      name: identity.name,
      headline: identity.headline,
      availability: scan.availability,
      summary,
      contact,
    },
    experience: experience.map((entry, index) => ({ id: `experience-${index}`, ...entry })),
    projects: projects.map((entry, index) => ({ id: `project-${index}`, ...entry })),
    skills: skillGroups.map((group, index) => ({ id: `skills-${index}`, ...group })),
    education: education.map((entry, index) => ({ id: `education-${index}`, ...entry })),
    certifications: certifications.map((entry, index) => ({ id: `certification-${index}`, ...entry })),
    awards: awards.map((entry, index) => ({ id: `award-${index}`, ...entry })),
    languages: languages.map((entry, index) => ({ id: `language-${index}`, ...entry })),
    extras: extras.map((extra, index) => ({ id: `extra-${index}`, title: extra.title, items: extra.items })),
  };

  return { resume, diagnostics };
}
