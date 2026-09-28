import { stripLeadingSymbols, wordCount } from "./text";

export type SectionKind =
  | "summary"
  | "experience"
  | "projects"
  | "skills"
  | "education"
  | "certifications"
  | "awards"
  | "languages"
  | "contact"
  | "other";

export type KnownSectionKind = Exclude<SectionKind, "other">;

/** Sections whose content is a list of dated, titled entries. */
export const ENTRY_SECTIONS: ReadonlySet<SectionKind> = new Set(["experience", "projects", "education"]);

/**
 * "strong" aliases are unambiguous section titles. "weak" aliases ("Tools", "Languages") are only treated as
 * section headings when they appear with a structural heading style (Markdown heading, ALL CAPS, underline),
 * because inside an entry they are usually labels such as "Tools: Figma, Jira".
 */
const SECTION_ALIASES: Record<KnownSectionKind, { strong: readonly string[]; weak: readonly string[] }> = {
  summary: {
    strong: [
      "summary", "professional summary", "career summary", "executive summary", "profile", "professional profile",
      "about", "about me", "objective", "career objective", "overview", "bio", "introduction", "personal statement",
      "who i am",
    ],
    weak: [],
  },
  experience: {
    strong: [
      "experience", "work experience", "professional experience", "relevant experience", "employment",
      "employment history", "work history", "career history", "professional background", "industry experience",
      "technical experience", "positions held", "career", "experience highlights", "leadership experience",
    ],
    weak: ["work", "positions"],
  },
  projects: {
    strong: [
      "projects", "selected projects", "personal projects", "side projects", "key projects", "notable projects",
      "featured projects", "open source", "open-source", "open source contributions", "open source projects",
      "portfolio", "selected work", "project experience", "academic projects", "things i've built", "things i have built",
    ],
    weak: ["work samples", "builds"],
  },
  skills: {
    strong: [
      "skills", "technical skills", "core competencies", "competencies", "areas of expertise", "expertise",
      "skills & tools", "skills and tools", "technical proficiencies", "proficiencies", "skill set", "skillset",
      "key skills", "core skills", "technical expertise", "tools & technologies", "tools and technologies",
      "skills & technologies", "skills and technologies", "tech stack", "technology stack",
    ],
    weak: ["technologies", "stack", "toolbox", "toolkit", "tools", "tech", "software"],
  },
  education: {
    strong: [
      "education", "academic background", "academics", "education & training", "education and training",
      "academic history", "degrees", "formal education", "education & certifications",
    ],
    weak: ["training", "qualifications"],
  },
  certifications: {
    strong: [
      "certifications", "certificates", "licenses & certifications", "licenses and certifications",
      "certifications & licenses", "credentials", "courses & certifications", "professional certifications",
    ],
    weak: ["licenses", "courses"],
  },
  awards: {
    strong: [
      "awards", "honors", "honours", "honors & awards", "awards & honors", "awards & achievements", "achievements",
      "accomplishments", "recognition", "awards & recognition",
    ],
    weak: [],
  },
  languages: {
    strong: ["spoken languages", "human languages", "language proficiency"],
    weak: ["languages", "language skills", "language"],
  },
  contact: {
    strong: [
      "contact", "contact info", "contact information", "contact details", "links", "socials", "social",
      "find me", "get in touch", "elsewhere", "online",
    ],
    weak: [],
  },
};

const ALIAS_INDEX = new Map<string, { kind: KnownSectionKind; strength: "strong" | "weak" }>();
for (const [kind, aliases] of Object.entries(SECTION_ALIASES) as Array<[KnownSectionKind, (typeof SECTION_ALIASES)[KnownSectionKind]]>) {
  for (const alias of aliases.strong) ALIAS_INDEX.set(alias, { kind, strength: "strong" });
  for (const alias of aliases.weak) if (!ALIAS_INDEX.has(alias)) ALIAS_INDEX.set(alias, { kind, strength: "weak" });
}

/** Keyword fallback for heading variants that are not listed verbatim ("Relevant Industry Experience"). */
const KEYWORD_RULES: ReadonlyArray<[RegExp, KnownSectionKind]> = [
  [/\b(experience|employment|work history)\b/, "experience"],
  [/\bprojects?\b|\bopen[ -]source\b/, "projects"],
  [/\b(skills?|competenc(?:y|ies)|tech(?:nology)? stack|technolog(?:y|ies)|proficienc(?:y|ies))\b/, "skills"],
  [/\b(education|academic|degrees?)\b/, "education"],
  [/\b(certifications?|certificates?|licen[cs]es?)\b/, "certifications"],
  [/\b(awards?|honou?rs|achievements)\b/, "awards"],
  [/\b(summary|profile|objective|about)\b/, "summary"],
];

export interface SectionMatch {
  kind: KnownSectionKind;
  strength: "strong" | "weak";
}

/** Normalises a heading: strips emoji, numbering ("01.", "II —"), trailing colons and brackets. */
export function normalizeHeading(title: string): string {
  return stripLeadingSymbols(title)
    .toLowerCase()
    .replace(/^(?:\d{1,2}|[ivx]{1,4})\s*[.)\-–—:/]\s*/, "")
    .replace(/^[#>*\-–—\s[\]]+/, "")
    .replace(/[:.\s[\]]+$/, "")
    .replace(/\s+and\s+/g, " & ")
    .replace(/\s*&\s*/g, " & ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Classifies a heading. With `allowKeywords`, headings that merely contain a section keyword
 * ("Selected Open Source Work") are accepted as weak matches.
 */
export function classifySectionTitle(title: string, options: { allowKeywords?: boolean } = {}): SectionMatch | null {
  const normalized = normalizeHeading(title);
  if (!normalized || normalized.length > 48) return null;
  const exact = ALIAS_INDEX.get(normalized) ?? ALIAS_INDEX.get(normalized.replace(/\s*\(.*\)$/, ""));
  if (exact) return exact;
  if (!options.allowKeywords || wordCount(normalized) > 4) return null;
  for (const [pattern, kind] of KEYWORD_RULES) {
    if (pattern.test(normalized)) return { kind, strength: "weak" };
  }
  return null;
}

export const SECTION_TITLES: Record<KnownSectionKind, string> = {
  summary: "About",
  experience: "Experience",
  projects: "Projects",
  skills: "Skills",
  education: "Education",
  certifications: "Certifications",
  awards: "Awards",
  languages: "Languages",
  contact: "Contact",
};
