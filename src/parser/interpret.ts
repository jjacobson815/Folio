import { isLocationLike } from "./contact";
import { findDateRange, removeDateText, type DateMatch } from "./dates";
import { explodeBulletEntries, groupEntries, LINK_LINE_RE, META_LINE_RE, sectionItems, type EntryLine, type RawEntry } from "./entries";
import { isContentLine, type SourceLine } from "./lines";
import type { RawSection } from "./segment";
import { canonicalizeSkill, detectTechnologies, groupByCategory, techRatio } from "./taxonomy";
import {
  collapseWhitespace,
  hostOf,
  isAllCaps,
  normalizeUrl,
  prettyUrl,
  smartCase,
  splitList,
  toParagraphs,
  trimDecorations,
  uniqueBy,
  wordCount,
  type InlineLink,
} from "./text";
import type {
  Award,
  Certification,
  DateRange,
  Education,
  EmploymentType,
  Project,
  ProjectLink,
  SkillGroup,
  SpokenLanguage,
  WorkExperience,
} from "./types";

type Draft<T> = Omit<T, "id">;

const PART_SEPARATOR = /\s+[|•·∙‧]\s+|\s+[—–]\s+|\s+-{1,2}\s+|\s{3,}|\s*\|\s*/;

const ROLE_WORDS =
  /\b(engineer(?:ing)?|developer|dev|programmer|architect|designer|manager|lead|leader|head|director|vp|vice president|president|chief|cto|ceo|coo|cfo|cpo|founder|co-?founder|owner|intern|apprentice|scientist|analyst|consultant|specialist|administrator|officer|coordinator|associate|assistant|researcher|fellow|instructor|teacher|professor|lecturer|writer|editor|advocate|evangelist|strategist|product|sre|devops|qa|tester|technician|principal|staff|senior|sr|junior|jr|contractor|freelancer|partner|volunteer|mentor|executive|producer|artist|member of technical staff)\b/gi;
const COMPANY_HINTS =
  /\b(inc|llc|ltd|limited|corp|corporation|co|company|gmbh|ag|plc|pty|labs?|technologies|systems|solutions|software|studios?|group|holdings|ventures|capital|agency|consulting|bank|hospital|health|media|games|networks?|foundation|university|college|institute|ai|hq)\b\.?|\.(?:com|io|ai|dev|co)\b/i;

const EMPLOYMENT_TYPES: ReadonlyArray<[RegExp, EmploymentType]> = [
  [/^full[\s-]?time$/i, "Full-time"],
  [/^part[\s-]?time$/i, "Part-time"],
  [/^(?:contract|contractor|contract role)$/i, "Contract"],
  [/^(?:freelance|freelancer|self[\s-]employed)$/i, "Freelance"],
  [/^(?:internship|summer internship|co-?op)$/i, "Internship"],
];

function roleScore(text: string): number {
  return (text.match(ROLE_WORDS) ?? []).length;
}

function companyScore(text: string): number {
  return (COMPANY_HINTS.test(text) ? 2 : 0) + (isAllCaps(text) && text.length > 2 ? 1 : 0);
}

function employmentTypeOf(text: string): EmploymentType | null {
  const trimmed = text.trim();
  for (const [pattern, type] of EMPLOYMENT_TYPES) if (pattern.test(trimmed)) return type;
  return null;
}

export function splitParts(text: string): string[] {
  return text.split(PART_SEPARATOR).map(trimDecorations).filter(Boolean);
}

function allLinks(entry: RawEntry): InlineLink[] {
  return [...entry.header, ...entry.body, ...entry.bullets].flatMap((line) => line.links);
}

/** Link labels that only describe the link ("Source", "Live demo") and add nothing to the surrounding text. */
const GENERIC_LINK_LABEL = /^(?:source(?: code)?|code|repo(?:sitory)?|github|gitlab|demo|live(?: demo| site)?|website|site|link|app|docs|documentation|npm|paper|video|slides|case study|read more|try it|visit)$/i;

function removeLinkText(text: string, links: readonly InlineLink[]): string {
  let result = text;
  for (const link of links) {
    if (link.label === link.url || /^(?:https?:\/\/|www\.)/i.test(link.label) || link.label.includes(".") || GENERIC_LINK_LABEL.test(link.label.trim())) {
      result = result.replace(link.label, " ");
    }
    result = result.replace(link.url, " ");
  }
  return trimDecorations(collapseWhitespace(result.replace(/(?:\s*[·•|]\s*){2,}/g, " · ")));
}

/** Splits "Acme Corp, Toronto, ON" or "Acme, Remote" into the organisation and its location. */
function peelLocationSuffix(part: string): { value: string; location: string | null } {
  const two = /^(.*?),\s*([^,]+,\s*[^,]+)$/.exec(part);
  if (two && (two[1] ?? "").trim() && isLocationLike(two[2] ?? "")) return { value: (two[1] ?? "").trim(), location: (two[2] ?? "").trim() };
  const one = /^(.*?),\s*([^,]+)$/.exec(part);
  if (one && (one[1] ?? "").trim() && isLocationLike(one[2] ?? "")) return { value: (one[1] ?? "").trim(), location: (one[2] ?? "").trim() };
  return { value: part, location: null };
}

/** Pulls the first date range out of an entry's header lines and returns the remaining header text. */
function extractPeriod(lines: readonly EntryLine[]): { period: DateRange | null; texts: string[]; match: DateMatch | null } {
  let period: DateRange | null = null;
  let firstMatch: DateMatch | null = null;
  const texts: string[] = [];
  for (const line of lines) {
    let working = removeLinkText(line.text, line.links);
    if (!period) {
      const found = findDateRange(working);
      if (found) {
        period = found.range;
        firstMatch = found;
        working = removeDateText(working, found);
      }
    }
    if (working.trim()) texts.push(working);
  }
  return { period, texts, match: firstMatch };
}

function explicitTechnologies(lines: readonly EntryLine[]): string[] {
  const techs: string[] = [];
  for (const line of lines) {
    const match = META_LINE_RE.exec(line.text);
    if (match) techs.push(...splitList(match[2] ?? "").map(canonicalizeSkill));
  }
  return uniqueBy(techs, (tech) => tech.toLowerCase());
}

/** Splits "Acme Corp (Remote)" into the organisation and a trailing location / employment-type qualifier. */
function peelQualifier(part: string): { value: string; location: string | null; type: EmploymentType | null } {
  const match = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(part);
  if (!match) return { value: part, location: null, type: null };
  const inner = (match[2] ?? "").trim();
  const type = employmentTypeOf(inner);
  if (type) return { value: (match[1] ?? "").trim(), location: null, type };
  if (isLocationLike(inner)) return { value: (match[1] ?? "").trim(), location: inner, type: null };
  return { value: part, location: null, type: null };
}

function assignRoleAndCompany(parts: string[]): { role: string; company: string } {
  if (parts.length === 0) return { role: "", company: "" };
  if (parts.length === 1) {
    const only = parts[0] ?? "";
    const comma = /^(.+?),\s+(.+)$/.exec(only);
    if (comma && !/^(inc|llc|ltd|corp|gmbh|co)\.?$/i.test((comma[2] ?? "").trim())) {
      const left = (comma[1] ?? "").trim();
      const right = (comma[2] ?? "").trim();
      if (roleScore(left) > roleScore(right)) return { role: left, company: right };
      if (roleScore(right) > roleScore(left)) return { role: right, company: left };
    }
    return roleScore(only) > 0 ? { role: only, company: "" } : { role: "", company: only };
  }

  const scored = parts.map((part, index) => ({ part, index, role: roleScore(part), company: companyScore(part) }));
  const roleCandidate = [...scored].filter((entry) => entry.role > 0).sort((a, b) => b.role - a.role || a.index - b.index)[0];
  if (roleCandidate) {
    const others = scored.filter((entry) => entry.index !== roleCandidate.index);
    const companyCandidate = [...others].sort((a, b) => b.company - a.company || a.index - b.index)[0];
    return { role: roleCandidate.part, company: companyCandidate?.part ?? "" };
  }
  const companyCandidate = [...scored].sort((a, b) => b.company - a.company || a.index - b.index)[0];
  if (companyCandidate && companyCandidate.company > 0) {
    const role = scored.find((entry) => entry.index !== companyCandidate.index)?.part ?? "";
    return { role, company: companyCandidate.part };
  }
  return { role: parts[0] ?? "", company: parts[1] ?? "" };
}

export function interpretExperience(entry: RawEntry): Draft<WorkExperience> {
  const { period, texts } = extractPeriod(entry.header);
  let role = "";
  let company = "";
  let location: string | null = null;
  let employmentType: EmploymentType | null = null;
  const parts: string[] = [];

  for (const text of texts) {
    for (const part of splitParts(text)) {
      const at = /^(.+?)\s+(?:at|@)\s+(.+)$/i.exec(part);
      if (at && !role && !company && roleScore(at[1] ?? "") > 0) {
        role = trimDecorations(at[1] ?? "");
        const peeled = peelQualifier(trimDecorations(at[2] ?? ""));
        company = peeled.value;
        location ??= peeled.location;
        employmentType ??= peeled.type;
        continue;
      }
      parts.push(part);
    }
  }

  const remaining: string[] = [];
  for (const part of parts) {
    const type = employmentTypeOf(part);
    if (type) {
      employmentType ??= type;
      continue;
    }
    if (!location && isLocationLike(part)) {
      location = part;
      continue;
    }
    const peeled = peelQualifier(part);
    location ??= peeled.location;
    employmentType ??= peeled.type;
    const suffix = location ? { value: peeled.value, location: null } : peelLocationSuffix(peeled.value);
    location ??= suffix.location;
    remaining.push(suffix.value);
  }

  if (!role && !company) {
    const assigned = assignRoleAndCompany(remaining);
    role = assigned.role;
    company = assigned.company;
  } else if (!company && remaining.length) {
    company = remaining[0] ?? "";
  } else if (!role && remaining.length) {
    role = remaining[0] ?? "";
  }

  const narrative = entry.body.filter((line) => !META_LINE_RE.test(line.text) && !LINK_LINE_RE.test(line.text));
  const highlights = entry.bullets.filter((line) => !META_LINE_RE.test(line.text)).map((line) => line.text);
  const explicit = explicitTechnologies([...entry.body, ...entry.bullets]);
  const summary = narrative.length ? toParagraphs(narrative.map((line) => line.text)).join(" ") : null;
  const technologies = explicit.length ? explicit : detectTechnologies([summary ?? "", ...highlights].join("\n"), 8);
  const headerLink = entry.header.flatMap((line) => line.links).find((link) => !/^mailto:/i.test(link.url));

  return {
    role: trimDecorations(role),
    company: trimDecorations(company),
    location,
    employmentType,
    period,
    url: headerLink ? normalizeUrl(headerLink.url) : null,
    summary,
    highlights,
    technologies,
  };
}

function classifyProjectLink(link: InlineLink): ProjectLink {
  const url = normalizeUrl(link.url);
  const host = hostOf(url);
  if (/(^|\.)(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org|sr\.ht)$/.test(host)) {
    return { kind: "repo", label: "Source", url };
  }
  const label = link.label && link.label !== link.url ? link.label : "";
  if (/demo|live|try|play/i.test(label)) return { kind: "live", label: "Live demo", url };
  if (/site|app|website|visit/i.test(label)) return { kind: "live", label: "Visit site", url };
  return { kind: "link", label: label && !label.includes(".") ? label : prettyUrl(url), url };
}

const NAME_DESCRIPTION_RE = /^(.{2,60}?)\s*(?::|—|–|\s-\s|\|)\s*(.{3,})$/;

export function interpretProject(entry: RawEntry): Draft<Project> {
  const { period, texts } = extractPeriod(entry.header);
  const [first = "", ...otherHeaders] = texts;
  let name = first;
  const description: string[] = [];
  let role: string | null = null;
  const technologies: string[] = [...explicitTechnologies([...entry.header, ...entry.body, ...entry.bullets])];

  const split = NAME_DESCRIPTION_RE.exec(first);
  if (split && wordCount(split[1] ?? "") <= 7) {
    name = split[1] ?? first;
    description.push((split[2] ?? "").trim());
  }

  // "Nebula (React, WebRTC)" → tech list in parentheses.
  const parenthetical = /^(.*?)\s*\(([^()]+)\)\s*$/.exec(name);
  if (parenthetical) {
    const items = splitList(parenthetical[2] ?? "");
    if (items.length && techRatio(items) >= 0.5) {
      technologies.push(...items.map(canonicalizeSkill));
      name = parenthetical[1] ?? name;
    }
  }

  for (const text of otherHeaders) {
    const roleMatch = /^(?:role|position)\s*[:\-–—]\s*(.+)$/i.exec(text);
    if (roleMatch) {
      role = trimDecorations(roleMatch[1] ?? "");
      continue;
    }
    if (META_LINE_RE.test(text) || LINK_LINE_RE.test(text)) continue;
    const items = splitList(text);
    if (items.length >= 2 && techRatio(items) >= 0.5) {
      technologies.push(...items.map(canonicalizeSkill));
      continue;
    }
    description.push(text);
  }

  for (const line of entry.body) {
    if (META_LINE_RE.test(line.text) || LINK_LINE_RE.test(line.text)) continue;
    const cleaned = removeLinkText(line.text, line.links);
    if (cleaned) description.push(cleaned);
  }

  const highlights = entry.bullets.filter((line) => !META_LINE_RE.test(line.text)).map((line) => removeLinkText(line.text, line.links) || line.text);
  const descriptionText = description.length ? collapseWhitespace(description.join(" ")) : null;
  const detected = technologies.length ? [] : detectTechnologies([name, descriptionText ?? "", ...highlights].join("\n"), 6);
  const links = uniqueBy(allLinks(entry).filter((link) => !/^mailto:/i.test(link.url)).map(classifyProjectLink), (link) => link.url.toLowerCase());

  return {
    name: trimDecorations(name) || "Untitled project",
    role,
    description: descriptionText,
    highlights,
    technologies: uniqueBy([...technologies, ...detected], (tech) => tech.toLowerCase()),
    links,
    period,
  };
}

const DEGREE_RE =
  /(?<![A-Za-z])(?:ph\.?\s?d\.?|doctor(?:ate)?(?:\s+of\s+[a-z]+)?|master(?:'s)?(?:\s+of\s+(?:business\s+)?[a-z]+)?|bachelor(?:'s)?(?:\s+of\s+[a-z]+(?:\s+arts)?)?|associate(?:'s)?(?:\s+(?:of|in)\s+[a-z]+)?|m\.?b\.?a\.?|b\.?\s?sc\.?|m\.?\s?sc\.?|b\.?\s?eng\.?|m\.?\s?eng\.?|b\.?\s?tech\.?|m\.?\s?tech\.?|b\.?\s?[as]\.|m\.?\s?[as]\.|b\.?f\.?a\.?|m\.?f\.?a\.?|b\.?b\.?a\.?|j\.?d\.?|ll\.?[bm]\.?|high school diploma|diploma|certificate|ged|bootcamp|nanodegree)(?![A-Za-z])/i;
/** Bare abbreviations are matched case-sensitively so words like "be" or "me" never count as degrees. */
const DEGREE_ABBREVIATION_RE = /(?<![A-Za-z])(?:BS|BA|MS|MA|BE|ME|BSc|MSc|BEng|MEng|MBA|PhD|BFA|MFA|BBA)(?![A-Za-z])/;

function isDegree(text: string): boolean {
  return DEGREE_RE.test(text) || DEGREE_ABBREVIATION_RE.test(text);
}

function degreeMatch(text: string): RegExpExecArray | null {
  return DEGREE_RE.exec(text) ?? DEGREE_ABBREVIATION_RE.exec(text);
}
const INSTITUTION_RE =
  /\b(universit(?:y|ies|é|ät|at|ad|à|y college)|college|institute|institut|school|academy|polytechnic|conservatory|seminary|bootcamp|école|ecole|hochschule|campus|coursera|udacity|recurse center|general assembly|hack reactor|app academy)\b/i;
const INSTITUTION_ACRONYM_RE = /\b(MIT|UCLA|UCSD|UCSB|UC Berkeley|NYU|CMU|ETH Zürich|ETH Zurich|ETH|EPFL|IIT\s?\w*|KTH|TU \w+|LSE|UBC|NUS|NTU|KAIST|UNSW|UW)\b/;
const GPA_RE = /\b(?:GPA|grade|cgpa)\s*[:\-]?\s*([0-9]+(?:\.[0-9]+)?(?:\s*\/\s*[0-9]+(?:\.[0-9]+)?)?)/i;

function looksLikeInstitution(text: string): boolean {
  return INSTITUTION_RE.test(text) || INSTITUTION_ACRONYM_RE.test(text);
}

function splitDegree(value: string): { degree: string; field: string | null } {
  const inMatch = /^(.*?)(?:\s+in\s+|,\s+)(.+)$/i.exec(value);
  if (inMatch && isDegree(inMatch[1] ?? "")) return { degree: (inMatch[1] ?? "").trim(), field: trimDecorations(inMatch[2] ?? "") || null };
  const found = degreeMatch(value);
  if (found && found.index === 0) {
    const rest = trimDecorations(value.slice(found[0].length));
    if (rest && !/^of\b/i.test(rest)) return { degree: found[0].trim(), field: rest };
  }
  return { degree: value.trim(), field: null };
}

export function interpretEducation(entry: RawEntry): Draft<Education> {
  const { period: found, texts } = extractPeriod(entry.header);
  // A single date on an education entry is almost always the graduation date.
  const period: DateRange | null = found && found.start && !found.end ? { start: null, end: found.start } : found;
  let institution = "";
  let degree: string | null = null;
  let field: string | null = null;
  let location: string | null = null;
  let score: string | null = null;
  const leftovers: string[] = [];
  const details: string[] = [];

  const candidates: string[] = [];
  for (const text of texts) {
    for (const part of splitParts(text)) {
      // Peel a trailing "City, ST" / "City, Country" before splitting on commas.
      const tail = /^(.*?),\s*([^,]+,\s*[^,]+)$/.exec(part);
      if (tail && isLocationLike(tail[2] ?? "")) {
        location ??= (tail[2] ?? "").trim();
        candidates.push(...(tail[1] ?? "").split(/,\s+/));
        continue;
      }
      const hasDegree = isDegree(part);
      const hasInstitution = looksLikeInstitution(part);
      // "B.S. Computer Science, Stanford University" → split the degree from the institution.
      if (hasDegree && hasInstitution && part.includes(",")) candidates.push(...part.split(/,\s+/));
      else candidates.push(part);
    }
  }

  for (const candidate of candidates.map(trimDecorations).filter(Boolean)) {
    const gpa = GPA_RE.exec(candidate);
    if (gpa) {
      score ??= (gpa[1] ?? "").replace(/\s+/g, "");
      const rest = trimDecorations(candidate.replace(gpa[0], ""));
      if (rest) leftovers.push(rest);
      continue;
    }
    if (!institution && looksLikeInstitution(candidate) && !(isDegree(candidate) && !INSTITUTION_RE.test(candidate))) {
      const peeled = peelQualifier(candidate);
      institution = peeled.value;
      location ??= peeled.location;
      continue;
    }
    if (!degree && isDegree(candidate)) {
      const split = splitDegree(candidate);
      degree = split.degree;
      field = split.field;
      continue;
    }
    if (!location && isLocationLike(candidate)) {
      location = candidate;
      continue;
    }
    leftovers.push(candidate);
  }

  if (!institution && leftovers.length) institution = leftovers.shift() ?? "";
  if (!field && degree && leftovers.length && wordCount(leftovers[0] ?? "") <= 6) field = leftovers.shift() ?? null;
  if (!degree && leftovers.length && wordCount(leftovers[0] ?? "") <= 8) degree = leftovers.shift() ?? null;
  details.push(...leftovers);

  for (const line of [...entry.body, ...entry.bullets]) {
    const gpa = GPA_RE.exec(line.text);
    if (gpa && !score) {
      score = (gpa[1] ?? "").replace(/\s+/g, "");
      const rest = trimDecorations(line.text.replace(gpa[0], ""));
      if (rest) details.push(rest);
      continue;
    }
    details.push(line.text);
  }

  return { institution: trimDecorations(institution), degree, field, location, period, score, details };
}

const ISSUER_HINTS: ReadonlyArray<[RegExp, string]> = [
  [/\b(aws|amazon)\b/i, "Amazon Web Services"],
  [/\b(google|gcp)\b/i, "Google Cloud"],
  [/\b(azure|microsoft)\b/i, "Microsoft"],
  [/\b(cka|ckad|cks|kubernetes|cncf)\b/i, "Cloud Native Computing Foundation"],
  [/\b(terraform|hashicorp|vault)\b/i, "HashiCorp"],
  [/\b(csm|cspo|scrum)\b/i, "Scrum Alliance"],
  [/\b(pmp|capm)\b/i, "Project Management Institute"],
  [/\b(comptia|security\+|network\+|a\+)/i, "CompTIA"],
  [/\b(ccna|ccnp|cisco)\b/i, "Cisco"],
  [/\b(oracle|ocp)\b/i, "Oracle"],
];

const CERT_LEVEL_RE = /^(?:associate|professional|specialty|speciality|foundational|practitioner|expert|fundamentals|advanced|developer|administrator|architect)$/i;

function splitNameIssuer(text: string): { name: string; issuer: string | null } {
  const parts = splitParts(text);
  // "AWS Certified Developer – Associate" keeps its level suffix as part of the name.
  while (parts.length >= 2 && CERT_LEVEL_RE.test(parts[1] ?? "")) parts.splice(0, 2, `${parts[0]} – ${parts[1]}`);
  if (parts.length >= 2) return { name: parts[0] ?? text, issuer: parts[1] ?? null };
  if (parts.length === 1 && parts[0] !== text) text = parts[0] ?? text;
  const byMatch = /^(.+?)\s+(?:by|from|issued by|—)\s+(.+)$/i.exec(text);
  if (byMatch) return { name: trimDecorations(byMatch[1] ?? ""), issuer: trimDecorations(byMatch[2] ?? "") };
  const paren = /^(.+?)\s*\(([^()]+)\)\s*$/.exec(text);
  // "(CKAD)" is an acronym of the credential itself, not its issuer.
  if (paren && !/^[A-Z0-9+&-]{2,8}$/.test((paren[2] ?? "").trim())) {
    return { name: trimDecorations(paren[1] ?? ""), issuer: trimDecorations(paren[2] ?? "") };
  }
  const comma = /^(.+?),\s+([^,]+)$/.exec(text);
  if (comma && wordCount(comma[2] ?? "") <= 5) return { name: trimDecorations(comma[1] ?? ""), issuer: trimDecorations(comma[2] ?? "") };
  return { name: text, issuer: null };
}

export function interpretCertifications(section: RawSection): Array<Draft<Certification>> {
  return sectionItems(section.lines)
    .filter((item) => item.text.length > 1)
    .map((item) => {
      const found = findDateRange(item.text);
      const text = trimDecorations(found ? removeDateText(item.text, found) : item.text);
      const { name, issuer } = splitNameIssuer(removeLinkText(text, item.links) || text);
      const inferred = issuer ?? ISSUER_HINTS.find(([pattern]) => pattern.test(name))?.[1] ?? null;
      const link = item.links[0];
      return {
        name: trimDecorations(name),
        issuer: inferred,
        date: found ? (found.range.end ?? found.range.start) : null,
        url: link ? normalizeUrl(link.url) : null,
      };
    })
    .filter((certification) => certification.name.length > 1);
}

export function interpretAwards(section: RawSection): Array<Draft<Award>> {
  return sectionItems(section.lines)
    .filter((item) => item.text.length > 1)
    .map((item) => {
      const found = findDateRange(item.text);
      const text = trimDecorations(found ? removeDateText(item.text, found) : item.text);
      const parts = splitParts(text);
      if (parts.length === 1) {
        const comma = /^(.{3,60}?),\s+([A-Z].+)$/.exec(parts[0] ?? "");
        if (comma) parts.splice(0, 1, comma[1] ?? "", comma[2] ?? "");
      }
      if (parts.length >= 2) {
        const second = parts[1] ?? "";
        // Organisations are capitalised and short; lowercase or long fragments are details.
        const secondIsIssuer = /^[A-Z0-9]/.test(second) && wordCount(second) <= 7;
        return {
          title: parts[0] ?? text,
          issuer: secondIsIssuer ? second : null,
          date: found ? (found.range.end ?? found.range.start) : null,
          summary: (secondIsIssuer ? parts.slice(2) : parts.slice(1)).join(" · ") || null,
        };
      }
      const sentence = /^(.{3,80}?)[:.]\s+(.{12,})$/.exec(text);
      return {
        title: sentence ? (sentence[1] ?? text) : text,
        issuer: null,
        date: found ? (found.range.end ?? found.range.start) : null,
        summary: sentence ? (sentence[2] ?? null) : null,
      };
    });
}

export function interpretLanguages(section: RawSection): Array<Draft<SpokenLanguage>> {
  const results: Array<Draft<SpokenLanguage>> = [];
  for (const item of sectionItems(section.lines)) {
    for (const piece of splitList(item.text)) {
      const match = /^(.+?)\s*(?:\(([^)]+)\)|[:\-–—]\s*(.+))$/.exec(piece);
      const language = trimDecorations(match ? (match[1] ?? piece) : piece);
      const fluency = match ? trimDecorations(match[2] ?? match[3] ?? "") || null : null;
      if (language && wordCount(language) <= 4) results.push({ language, fluency });
    }
  }
  return uniqueBy(results, (entry) => entry.language.toLowerCase());
}

const CATEGORY_LINE_RE = /^([^:]{2,40}):\s*(.+)$/;
const CATEGORY_DASH_RE = /^([A-Za-z][\w &/+#.-]{1,32}?)\s+[—–]\s+(.+)$/;

/** Parses a skills section into categorised groups; flat lists are auto-grouped with the taxonomy. */
export function interpretSkills(section: RawSection): Array<Draft<SkillGroup>> {
  const groups: Array<{ category: string | null; items: string[] }> = [];
  let currentCategory: string | null = null;
  const groupFor = (category: string | null) => {
    let group = groups.find((entry) => entry.category === category);
    if (!group) {
      group = { category, items: [] };
      groups.push(group);
    }
    return group;
  };

  for (const line of section.lines) {
    if (!isContentLine(line)) continue;
    const text = line.text;
    const standaloneLabel =
      line.kind === "heading" || (line.kind === "text" && (line.style === "bold" || line.style === "colon" || line.style === "caps") && !text.includes(","));
    if (standaloneLabel) {
      const label = trimDecorations(text.replace(/:$/, ""));
      currentCategory = smartCase(label);
      continue;
    }
    const labeled = CATEGORY_LINE_RE.exec(text) ?? (text.includes(",") ? CATEGORY_DASH_RE.exec(text) : null);
    if (labeled && !/^https?$/i.test(labeled[1] ?? "")) {
      const label = trimDecorations(labeled[1] ?? "");
      groupFor(smartCase(label)).items.push(...splitList(labeled[2] ?? ""));
      continue;
    }
    groupFor(currentCategory).items.push(...splitList(text));
  }

  return finalizeSkillGroups(groups);
}

const LEVEL_SUFFIX_RE =
  /\s*\((?:expert|advanced|proficient|intermediate|beginner|familiar|basic|native|fluent|\d+\+?\s*(?:yrs?|years?))\)$/i;

/**
 * Canonicalises and de-duplicates skill groups. Uncategorised lists of six or more skills are auto-grouped
 * with the taxonomy; shorter ones become a single "Core Stack" group.
 */
export function finalizeSkillGroups(groups: ReadonlyArray<{ category: string | null; items: string[] }>): Array<Draft<SkillGroup>> {
  const cleaned = groups
    .map((group) => ({
      category: group.category,
      items: uniqueBy(
        group.items
          .map((item) => item.replace(LEVEL_SUFFIX_RE, ""))
          .map(canonicalizeSkill)
          .filter((item) => item.length > 0 && item.length <= 40 && wordCount(item) <= 5),
        (item) => item.toLowerCase(),
      ),
    }))
    .filter((group) => group.items.length > 0);

  const result: Array<Draft<SkillGroup>> = [];
  // Explicit categories and auto-grouped buckets share one namespace, so "Languages: Go" plus a flat list
  // containing Python yields a single "Languages" group rather than two.
  const addGroup = (category: string, items: string[]) => {
    const existing = result.find((entry) => entry.category.toLowerCase() === category.toLowerCase());
    if (existing) existing.items = uniqueBy([...existing.items, ...items], (item) => item.toLowerCase());
    else result.push({ category, items, inferred: false });
  };
  for (const group of cleaned) {
    if (group.category) addGroup(group.category, group.items);
    else if (group.items.length >= 6) for (const bucket of groupByCategory(group.items)) addGroup(bucket.category, bucket.items);
    else addGroup("Core Stack", group.items);
  }
  return result;
}

export function interpretSummary(section: RawSection): string[] {
  const texts: string[] = [];
  for (const line of section.lines) {
    if (line.kind === "blank" || line.kind === "rule") texts.push("");
    else if (line.kind === "bullet") texts.push("", line.text, "");
    else texts.push(line.text);
  }
  return toParagraphs(texts);
}

export function interpretCustom(section: RawSection): string[] {
  return sectionItems(section.lines)
    .map((item) => item.text)
    .filter(Boolean);
}

export function interpretEntrySection(section: RawSection, mode: "experience" | "projects" | "education"): RawEntry[] {
  return explodeBulletEntries(groupEntries(section.lines), mode);
}

export function contactLines(section: RawSection): SourceLine[] {
  return section.lines.filter(isContentLine);
}
