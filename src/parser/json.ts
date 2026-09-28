import { classifyUrl, emptyContact, profileFromLabel } from "./contact";
import { coerceDate, findDateRange, formatRange } from "./dates";
import { finalizeSkillGroups } from "./interpret";
import { canonicalizeSkill, detectTechnologies } from "./taxonomy";
import { collapseWhitespace, humanizeKey, normalizeUrl, prettyUrl, splitList, uniqueBy } from "./text";
import type {
  Award,
  Certification,
  ContactInfo,
  DateRange,
  Diagnostic,
  Education,
  EmploymentType,
  Project,
  ProjectLink,
  Resume,
  SkillGroup,
  SocialProfile,
  SpokenLanguage,
  WorkExperience,
} from "./types";

type JsonObject = Record<string, unknown>;

export type JsonParseOutcome =
  | { ok: true; resume: Resume; diagnostics: Diagnostic[] }
  | { ok: false; diagnostic: Diagnostic };

const isObject = (value: unknown): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);
const keyOf = (key: string) => key.toLowerCase().replace(/[^a-z0-9]/g, "");

/* -------------------------------------------------------------------------------------------------
 * Tolerant JSON parsing
 * -----------------------------------------------------------------------------------------------*/

const FENCE_RE = /^\s*```(?:json5?|jsonc)?\s*\n([\s\S]*?)\n?```\s*$/i;

/** True when the last emitted token ends a value, so a following value / key needs a separating comma. */
function endsValue(token: string): boolean {
  return /["}\]\d]$/.test(token) || /(?:true|false|null)$/.test(token);
}

/**
 * Repairs the most common hand-written JSON mistakes in a single pass that is aware of string boundaries:
 * comments, trailing commas, missing commas between members, single-quoted strings, unquoted keys,
 * raw newlines inside strings and Python literals.
 */
export function repairJson(input: string): string {
  let output = "";
  // Last non-whitespace chunk written. Inspecting it instead of `output.trimEnd()` keeps the pass linear:
  // trimming the growing output copies it on every token, which froze the editor on large invalid JSON.
  let last = "";
  const write = (chunk: string) => {
    output += chunk;
    if (chunk.trim()) last = chunk.trimEnd();
  };
  let quote: '"' | "'" | null = null;
  let index = 0;
  while (index < input.length) {
    const char = input[index] ?? "";
    const next = input[index + 1] ?? "";

    if (quote) {
      if (char === "\\") {
        write(char + next);
        index += 2;
        continue;
      }
      if (char === quote) {
        write('"');
        quote = null;
      } else if (quote === "'" && char === '"') {
        write('\\"');
      } else if (char === "\n") {
        write("\\n");
      } else {
        write(char);
      }
      index++;
      continue;
    }

    if (char === '"' || char === "'") {
      if (endsValue(last)) write(",");
      quote = char;
      write('"');
      index++;
      continue;
    }
    if (char === "/" && next === "/") {
      while (index < input.length && input[index] !== "\n") index++;
      continue;
    }
    if (char === "/" && next === "*") {
      const end = input.indexOf("*/", index + 2);
      index = end === -1 ? input.length : end + 2;
      continue;
    }
    if ((char === "{" || char === "[") && endsValue(last)) write(",");
    if (char === ",") {
      let lookahead = index + 1;
      while (lookahead < input.length && /\s/.test(input[lookahead] ?? "")) lookahead++;
      const upcoming = input[lookahead];
      if (upcoming === "}" || upcoming === "]" || upcoming === undefined) {
        index++;
        continue;
      }
    }
    if (/[A-Za-z_$]/.test(char)) {
      let end = index;
      while (end < input.length && /[\w$-]/.test(input[end] ?? "")) end++;
      const word = input.slice(index, end);
      let colon = end;
      while (colon < input.length && /[ \t]/.test(input[colon] ?? "")) colon++;
      const previous = last.at(-1);
      if (input[colon] === ":" && (previous === "{" || previous === "," || endsValue(last))) {
        write(`${endsValue(last) ? "," : ""}"${word}"`);
      } else {
        write(({ True: "true", False: "false", None: "null", undefined: "null", NaN: "null" } as Record<string, string>)[word] ?? word);
      }
      index = end;
      continue;
    }
    write(char);
    index++;
  }
  return output;
}

const JSON_LITERAL = /-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?|true|false|null/y;

/**
 * Strict recursive-descent scan that returns the offset of the first syntax error (or -1). Engine error
 * messages differ between V8, SpiderMonkey and JavaScriptCore and often omit a position, so we locate it ourselves.
 */
export function findJsonErrorOffset(text: string): number {
  let index = 0;
  const fail = (): never => {
    throw index;
  };
  const whitespace = () => {
    while (index < text.length && " \t\n\r".includes(text[index] ?? "")) index++;
  };
  const string = () => {
    index++;
    while (index < text.length) {
      const char = text[index];
      if (char === "\\") index += 2;
      else if (char === '"') {
        index++;
        return;
      } else if (char === "\n") fail();
      else index++;
    }
    fail();
  };
  const value = (): void => {
    whitespace();
    const char = text[index];
    if (char === "{" || char === "[") {
      const close = char === "{" ? "}" : "]";
      index++;
      whitespace();
      if (text[index] === close) {
        index++;
        return;
      }
      for (;;) {
        if (char === "{") {
          whitespace();
          if (text[index] !== '"') fail();
          string();
          whitespace();
          if (text[index] !== ":") fail();
          index++;
        }
        value();
        whitespace();
        if (text[index] === ",") {
          index++;
          continue;
        }
        if (text[index] === close) {
          index++;
          return;
        }
        fail();
      }
    }
    if (char === '"') return string();
    JSON_LITERAL.lastIndex = index;
    const literal = JSON_LITERAL.exec(text);
    if (!literal) fail();
    index += literal?.[0].length ?? 0;
  };
  try {
    value();
    whitespace();
    if (index < text.length) fail();
    return -1;
  } catch (offset) {
    return typeof offset === "number" ? offset : -1;
  }
}

function locateJsonError(error: unknown, text: string): { line: number | null; message: string } {
  const message = error instanceof Error ? error.message : String(error);
  const offset = findJsonErrorOffset(text);
  return { line: offset >= 0 ? text.slice(0, offset).split("\n").length : null, message };
}

function cleanErrorMessage(message: string): string {
  return message
    .replace(/^JSON\.parse:\s*/i, "")
    .replace(/\s*in JSON at position \d+.*$/i, "")
    .replace(/\s*of the JSON data$/i, "")
    .replace(/,\s*(?:"|\.\.\.)[\s\S]* is not valid JSON$/i, "")
    .trim();
}

export function relaxedJsonParse(
  source: string,
): { ok: true; value: unknown; repaired: boolean } | { ok: false; message: string; line: number | null } {
  const fenced = FENCE_RE.exec(source);
  const body = fenced ? (fenced[1] ?? "") : source;
  const lineOffset = fenced ? source.slice(0, source.indexOf(body)).split("\n").length - 1 : 0;
  try {
    return { ok: true, value: JSON.parse(body), repaired: false };
  } catch (strictError) {
    try {
      return { ok: true, value: JSON.parse(repairJson(body)), repaired: true };
    } catch {
      const located = locateJsonError(strictError, body);
      return { ok: false, message: cleanErrorMessage(located.message), line: located.line === null ? null : located.line + lineOffset };
    }
  }
}

/* -------------------------------------------------------------------------------------------------
 * Value coercion helpers
 * -----------------------------------------------------------------------------------------------*/

class KeyTracker {
  readonly used = new Set<string>();
  /** Marks every key matching one of the aliases as consumed without reading it. */
  consume(object: JsonObject, aliases: readonly string[]): void {
    const wanted = new Set(aliases.map(keyOf));
    for (const key of Object.keys(object)) if (wanted.has(keyOf(key))) this.used.add(key);
  }
  pick(object: JsonObject, aliases: readonly string[]): unknown {
    const wanted = aliases.map(keyOf);
    for (const alias of wanted) {
      for (const [key, value] of Object.entries(object)) {
        if (keyOf(key) !== alias || value === null || value === undefined || value === "") continue;
        this.used.add(key);
        return value;
      }
    }
    return undefined;
  }
}

function pick(object: JsonObject, aliases: readonly string[]): unknown {
  return new KeyTracker().pick(object, aliases);
}

function asString(value: unknown): string {
  if (typeof value === "string") return collapseWhitespace(value);
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) return value.map(asString).filter(Boolean).join(", ");
  if (isObject(value)) return asString(pick(value, ["name", "title", "label", "value", "text"]));
  return "";
}

const BULLET_PREFIX = /^\s*(?:[-*+•●▪◦‣–—]|\d{1,2}[.)])\s+/;

/** Narrative arrays: highlights, responsibilities, course lists. Multiline strings are split per line. */
function asLines(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(asLines);
  if (isObject(value)) {
    const summary = summarizeObject(value);
    return summary ? [summary] : [];
  }
  const text = typeof value === "string" ? value : asString(value);
  return text
    .split(/\n+/)
    .map((line) => collapseWhitespace(line.replace(BULLET_PREFIX, "")))
    .filter(Boolean);
}

/** Keyword arrays: technologies, skills. Comma-separated strings are split. */
function asList(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(asList);
  if (isObject(value)) return [asString(value)].filter(Boolean);
  return splitList(typeof value === "string" ? value : asString(value));
}

function asBoolean(value: unknown): boolean {
  return value === true || (typeof value === "string" && /^(true|yes|y|1|current|present)$/i.test(value.trim()));
}

/** One-line rendering of an arbitrary object for custom sections ("Mentor — Code.org (2020): taught…"). */
function summarizeObject(value: JsonObject): string {
  const title = asString(pick(value, ["title", "name", "position", "role", "language", "award"]));
  const org = asString(pick(value, ["organization", "organisation", "company", "institution", "publisher", "issuer", "awarder", "entity"]));
  const period = periodFrom(value);
  const detail = asString(pick(value, ["summary", "description", "details", "keywords", "fluency", "level", "reference"]));
  const head = [title, org].filter(Boolean).join(" — ");
  const dates = period ? ` (${formatRange(period)})` : "";
  return collapseWhitespace(`${head}${dates}${detail ? `${head ? ": " : ""}${detail}` : ""}`);
}

const START_KEYS = ["startDate", "start", "from", "since", "begin", "started", "startYear"];
const END_KEYS = ["endDate", "end", "to", "until", "finished", "ended", "endYear", "graduationDate", "graduated", "graduation"];
const DATES_KEYS = ["dates", "period", "duration", "date", "timeline", "years", "tenure"];

function periodFrom(object: JsonObject, tracker?: KeyTracker, openEndedMeansPresent = false): DateRange | null {
  const read = (aliases: readonly string[]) => (tracker ? tracker.pick(object, aliases) : pick(object, aliases));
  const start = coerceDate(read(START_KEYS));
  let end = coerceDate(read(END_KEYS));
  const current = read(["current", "isCurrent", "present", "ongoing", "currentlyWorking"]);
  if (asBoolean(current)) end = { raw: "Present", year: null, month: null, isPresent: true };
  if (start || end) {
    // JSON Resume convention: a start date without an end date means the role is ongoing.
    if (start && !end && openEndedMeansPresent) end = { raw: "Present", year: null, month: null, isPresent: true };
    return { start, end };
  }
  const dates = read(DATES_KEYS);
  if (typeof dates === "string" || typeof dates === "number") return findDateRange(String(dates))?.range ?? null;
  if (isObject(dates)) return periodFrom(dates, undefined, openEndedMeansPresent);
  return null;
}

function employmentTypeFrom(value: unknown): EmploymentType | null {
  const text = asString(value).toLowerCase();
  if (/full/.test(text)) return "Full-time";
  if (/part/.test(text)) return "Part-time";
  if (/contract/.test(text)) return "Contract";
  if (/freelance|self/.test(text)) return "Freelance";
  if (/intern|co-?op/.test(text)) return "Internship";
  return null;
}

function locationFrom(value: unknown): string | null {
  if (typeof value === "string") return collapseWhitespace(value) || null;
  if (!isObject(value)) return null;
  const city = asString(pick(value, ["city", "town", "locality"]));
  const region = asString(pick(value, ["region", "state", "province"]));
  const country = asString(pick(value, ["countryCode", "country"]));
  const parts = [city, region, city && region ? "" : country].filter(Boolean);
  return parts.join(", ") || asString(pick(value, ["address"])) || null;
}

/* -------------------------------------------------------------------------------------------------
 * Schema mapping
 * -----------------------------------------------------------------------------------------------*/

const KEYS = {
  basics: ["basics", "personal", "personalInfo", "personalInformation", "header", "identity", "me", "info", "candidate", "person"],
  name: ["name", "fullName", "displayName", "candidateName"],
  firstName: ["firstName", "givenName", "first"],
  lastName: ["lastName", "surname", "familyName", "last"],
  headline: ["label", "headline", "title", "role", "position", "jobTitle", "tagline", "profession", "currentRole", "occupation"],
  email: ["email", "mail", "emailAddress", "e-mail"],
  phone: ["phone", "phoneNumber", "mobile", "tel", "telephone", "cell"],
  website: ["url", "website", "site", "homepage", "portfolio", "web", "blog", "personalWebsite"],
  location: ["location", "address", "city", "basedIn", "region", "residence"],
  summary: ["summary", "about", "bio", "objective", "overview", "description", "profile", "intro", "introduction", "aboutMe"],
  availability: ["availability", "status", "openTo", "lookingFor"],
  profiles: ["profiles", "social", "socials", "socialLinks", "links", "networks", "accounts", "socialProfiles"],
  contact: ["contact", "contactInfo", "contactInformation", "contacts"],
  experience: ["work", "experience", "workExperience", "employment", "employmentHistory", "jobs", "positions", "career", "workHistory", "professionalExperience", "roles"],
  projects: ["projects", "sideProjects", "openSource", "selectedWork", "personalProjects", "portfolioProjects"],
  skills: ["skills", "techStack", "stack", "technologies", "technicalSkills", "tech", "tools", "competencies", "expertise", "skillset"],
  education: ["education", "schools", "academics", "degrees", "studies", "academicBackground"],
  certifications: ["certificates", "certifications", "certs", "licenses", "credentials"],
  awards: ["awards", "honors", "honours", "achievements", "accomplishments"],
  languages: ["languages", "spokenLanguages", "humanLanguages"],
} as const;

const IGNORED_KEYS = new Set(["$schema", "schema", "meta", "id", "version", "updated", "updatedat", "createdat", "theme", "settings", "config", "template"].map(keyOf));
const PROFILE_KEYS = ["github", "gitlab", "linkedin", "twitter", "x", "dribbble", "behance", "medium", "devto", "stackoverflow", "youtube", "bluesky", "mastodon", "instagram"];

function profilesFrom(value: unknown): SocialProfile[] {
  const profiles: SocialProfile[] = [];
  const addUrlOrHandle = (network: string, raw: string) => {
    if (!raw) return;
    const profile = /[./]/.test(raw) && /\.[a-z]{2,}/i.test(raw) ? classifyUrl(raw) : profileFromLabel(network, raw);
    if (profile) profiles.push(profile);
  };
  if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string") {
        addUrlOrHandle("", item);
        continue;
      }
      if (!isObject(item)) continue;
      const url = asString(pick(item, ["url", "link", "href"]));
      const network = asString(pick(item, ["network", "platform", "name", "site", "type", "label"]));
      const handle = asString(pick(item, ["username", "handle", "user", "id"]));
      if (url) {
        const profile = classifyUrl(url);
        profiles.push(profile.network === "website" && network ? { ...profile, label: network } : profile);
      } else if (network && handle) {
        addUrlOrHandle(network, handle);
      }
    }
  } else if (isObject(value)) {
    for (const [network, raw] of Object.entries(value)) addUrlOrHandle(network, asString(raw));
  } else if (typeof value === "string") {
    for (const item of splitList(value)) addUrlOrHandle("", item);
  }
  return profiles;
}

function mapContact(sources: readonly JsonObject[]): ContactInfo {
  const contact = emptyContact();
  const profiles: SocialProfile[] = [];
  for (const source of sources) {
    contact.email ??= asString(pick(source, KEYS.email)) || null;
    contact.phone ??= asString(pick(source, KEYS.phone)) || null;
    contact.location ??= locationFrom(pick(source, KEYS.location));
    const website = pick(source, KEYS.website);
    if (typeof website === "string" && website.trim()) {
      const profile = classifyUrl(website);
      if (profile.network === "website") contact.website ??= profile.url;
      else profiles.push(profile);
    }
    profiles.push(...profilesFrom(pick(source, KEYS.profiles)));
    for (const key of PROFILE_KEYS) {
      const raw = pick(source, [key]);
      if (typeof raw === "string") {
        const profile = /[./]/.test(raw) && /\.[a-z]{2,}/i.test(raw) ? classifyUrl(raw) : profileFromLabel(key, raw);
        if (profile) profiles.push(profile);
      }
    }
  }
  if (contact.email) contact.email = contact.email.replace(/^mailto:/i, "");
  contact.profiles = uniqueBy(profiles, (profile) => profile.url.toLowerCase().replace(/\/$/, ""));
  return contact;
}

function mapExperience(value: unknown): Array<Omit<WorkExperience, "id">> {
  const items = Array.isArray(value) ? value : isObject(value) ? Object.values(value) : [];
  return items.filter(isObject).map((item) => {
    const role = asString(pick(item, ["position", "role", "title", "jobTitle", "designation"]));
    const company = asString(pick(item, ["name", "company", "employer", "organization", "organisation", "org", "business", "entity"]));
    const summaryValue = pick(item, ["summary", "description", "about", "overview", "details"]);
    let highlights = asLines(pick(item, ["highlights", "achievements", "accomplishments", "bullets", "responsibilities", "duties", "impact", "points", "items"]));
    let summary = typeof summaryValue === "string" || Array.isArray(summaryValue) ? asLines(summaryValue) : [];
    // A multi-line description with bullet markers is really a highlight list.
    if (!highlights.length && summary.length > 1) {
      highlights = summary;
      summary = [];
    }
    const explicitTech = asList(pick(item, ["technologies", "tech", "techStack", "stack", "tools", "keywords", "skills", "builtWith"])).map(canonicalizeSkill);
    const summaryText = summary.join(" ") || null;
    const url = asString(pick(item, ["url", "website", "link", "homepage"]));
    return {
      role,
      company,
      location: locationFrom(pick(item, ["location", "city", "place"])),
      employmentType: employmentTypeFrom(pick(item, ["employmentType", "type", "contractType"])),
      period: periodFrom(item, undefined, true),
      url: url ? normalizeUrl(url) : null,
      summary: summaryText,
      highlights,
      technologies: explicitTech.length ? uniqueBy(explicitTech, (tech) => tech.toLowerCase()) : detectTechnologies([summaryText ?? "", ...highlights].join("\n"), 8),
    };
  });
}

function mapProjects(value: unknown): Array<Omit<Project, "id">> {
  const items = Array.isArray(value) ? value : isObject(value) ? Object.entries(value).map(([name, body]) => (isObject(body) ? { name, ...body } : { name, description: body })) : [];
  return items
    .map((item) => (typeof item === "string" ? { name: item } : item))
    .filter(isObject)
    .map((item) => {
      const name = asString(pick(item, ["name", "title", "project"]));
      const description = asString(pick(item, ["description", "summary", "about", "tagline", "details", "overview"])) || null;
      const highlights = asLines(pick(item, ["highlights", "achievements", "bullets", "features", "impact", "points"]));
      const links: ProjectLink[] = [];
      const repo = asString(pick(item, ["repo", "repository", "github", "source", "sourceCode", "code", "git"]));
      const live = asString(pick(item, ["demo", "live", "liveUrl", "website", "site", "homepage", "url", "link", "href"]));
      const pushLink = (raw: string, kind: ProjectLink["kind"]) => {
        if (!raw) return;
        const url = normalizeUrl(raw);
        const isRepo = /(^|\.)(github\.com|gitlab\.com|bitbucket\.org|codeberg\.org)\//i.test(url.replace(/^https?:\/\//, ""));
        const resolved: ProjectLink["kind"] = isRepo ? "repo" : kind;
        links.push({ kind: resolved, label: resolved === "repo" ? "Source" : resolved === "live" ? "Visit site" : prettyUrl(url), url });
      };
      pushLink(repo, "repo");
      pushLink(live, "live");
      const extraLinks = pick(item, ["links", "urls"]);
      if (Array.isArray(extraLinks)) for (const entry of extraLinks) pushLink(isObject(entry) ? asString(pick(entry, ["url", "href", "link"])) : asString(entry), "link");
      else if (isObject(extraLinks)) for (const entry of Object.values(extraLinks)) pushLink(asString(entry), "link");
      const explicitTech = asList(pick(item, ["technologies", "tech", "techStack", "stack", "tools", "keywords", "skills", "builtWith", "languages"])).map(canonicalizeSkill);
      const roles = pick(item, ["roles", "role", "position"]);
      return {
        name: name || "Untitled project",
        role: asString(roles) || null,
        description,
        highlights,
        technologies: explicitTech.length ? uniqueBy(explicitTech, (tech) => tech.toLowerCase()) : detectTechnologies([name, description ?? "", ...highlights].join("\n"), 6),
        links: uniqueBy(links, (link) => link.url.toLowerCase()),
        period: periodFrom(item),
      };
    });
}

function mapSkills(value: unknown): Array<Omit<SkillGroup, "id">> {
  const groups: Array<{ category: string | null; items: string[] }> = [];
  const flat: string[] = [];
  if (typeof value === "string") {
    flat.push(...splitList(value));
  } else if (Array.isArray(value)) {
    for (const item of value) {
      if (typeof item === "string" || typeof item === "number") {
        flat.push(...splitList(String(item)));
        continue;
      }
      if (!isObject(item)) continue;
      const items = asList(pick(item, ["keywords", "items", "skills", "list", "technologies", "tools", "values"]));
      const label = asString(pick(item, ["category", "name", "title", "group", "label", "area"]));
      if (items.length) groups.push({ category: label || null, items });
      else if (label) flat.push(label);
    }
  } else if (isObject(value)) {
    for (const [category, items] of Object.entries(value)) groups.push({ category: humanizeKey(category), items: asList(items) });
  }
  if (flat.length) groups.push({ category: null, items: flat });
  return finalizeSkillGroups(groups);
}

function mapEducation(value: unknown): Array<Omit<Education, "id">> {
  const items = Array.isArray(value) ? value : isObject(value) ? [value] : [];
  return items.filter(isObject).map((item) => {
    const period = periodFrom(item);
    return {
      institution: asString(pick(item, ["institution", "school", "university", "college", "name", "organization", "organisation"])),
      degree: asString(pick(item, ["studyType", "degree", "qualification", "diploma", "level", "type"])) || null,
      field: asString(pick(item, ["area", "field", "major", "fieldOfStudy", "subject", "program", "discipline"])) || null,
      location: locationFrom(pick(item, ["location", "city"])),
      period: period && period.start && !period.end && !pick(item, START_KEYS) ? { start: null, end: period.start } : period,
      score: asString(pick(item, ["score", "gpa", "grade"])) || null,
      details: asLines(pick(item, ["courses", "details", "honors", "highlights", "activities", "notes", "description", "summary"])),
    };
  });
}

function mapCertifications(value: unknown): Array<Omit<Certification, "id">> {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item) => (typeof item === "string" ? { name: item } : item))
    .filter(isObject)
    .map((item) => {
      const url = asString(pick(item, ["url", "link", "credentialUrl", "verify"]));
      return {
        name: asString(pick(item, ["name", "title", "certificate", "certification"])),
        issuer: asString(pick(item, ["issuer", "authority", "organization", "provider", "by", "issuedBy"])) || null,
        date: coerceDate(pick(item, ["date", "issued", "issueDate", "year", "awarded"])),
        url: url ? normalizeUrl(url) : null,
      };
    })
    .filter((item) => item.name);
}

function mapAwards(value: unknown): Array<Omit<Award, "id">> {
  const items = Array.isArray(value) ? value : [];
  return items
    .map((item) => (typeof item === "string" ? { title: item } : item))
    .filter(isObject)
    .map((item) => ({
      title: asString(pick(item, ["title", "name", "award"])),
      issuer: asString(pick(item, ["awarder", "issuer", "organization", "by", "from"])) || null,
      date: coerceDate(pick(item, ["date", "year", "awarded"])),
      summary: asString(pick(item, ["summary", "description", "details"])) || null,
    }))
    .filter((item) => item.title);
}

function mapLanguages(value: unknown): Array<Omit<SpokenLanguage, "id">> {
  if (typeof value === "string") return splitList(value).map((language) => ({ language, fluency: null }));
  if (isObject(value)) return Object.entries(value).map(([language, fluency]) => ({ language, fluency: asString(fluency) || null }));
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => {
      if (typeof item === "string") return { language: item, fluency: null };
      if (!isObject(item)) return null;
      return {
        language: asString(pick(item, ["language", "name"])),
        fluency: asString(pick(item, ["fluency", "level", "proficiency"])) || null,
      };
    })
    .filter((item): item is { language: string; fluency: string | null } => Boolean(item?.language));
}

function unwrapRoot(value: unknown): unknown {
  if (!isObject(value)) return value;
  const keys = Object.keys(value);
  const onlyKey = keys[0];
  if (keys.length === 1 && onlyKey && /^(resume|cv|data|profile|portfolio|candidate)$/i.test(onlyKey) && isObject(value[onlyKey])) {
    return value[onlyKey];
  }
  return value;
}

/** Parses JSON (strict, then repaired) and maps JSON Resume or arbitrary key layouts onto the schema. */
export function parseJsonResume(source: string): JsonParseOutcome {
  const parsed = relaxedJsonParse(source);
  if (!parsed.ok) {
    return {
      ok: false,
      diagnostic: {
        level: "error",
        code: "json-syntax",
        message: `Invalid JSON: ${parsed.message || "unexpected token"}. Showing a best-effort text parse instead.`,
        line: parsed.line,
      },
    };
  }

  const diagnostics: Diagnostic[] = [];
  if (parsed.repaired) {
    diagnostics.push({
      level: "warning",
      code: "json-repaired",
      message: "JSON contained comments, trailing commas or unquoted keys — they were repaired automatically.",
      line: null,
    });
  }

  let root = unwrapRoot(parsed.value);
  if (Array.isArray(root)) {
    const looksLikeWork = root.some((item) => isObject(item) && pick(item, ["company", "employer", "position", "role"]) !== undefined);
    diagnostics.push({
      level: "warning",
      code: "json-array-root",
      message: looksLikeWork ? "Top-level array interpreted as work experience." : "Top-level array interpreted as a list of projects.",
      line: 1,
    });
    root = looksLikeWork ? { work: root } : { projects: root };
  }
  if (!isObject(root)) {
    return {
      ok: false,
      diagnostic: { level: "error", code: "json-shape", message: "JSON must be an object describing the resume.", line: 1 },
    };
  }

  const tracker = new KeyTracker();
  const basicsValue = tracker.pick(root, KEYS.basics);
  const basics = isObject(basicsValue) ? basicsValue : root;
  const contactValue = pick(basics, KEYS.contact) ?? tracker.pick(root, KEYS.contact);
  const contactSources = [basics, ...(isObject(contactValue) ? [contactValue] : []), root];

  // Keys consumed from the root when basics are flattened into it.
  const basicsTracker = basics === root ? tracker : new KeyTracker();
  const first = asString(basicsTracker.pick(basics, KEYS.firstName));
  const last = asString(basicsTracker.pick(basics, KEYS.lastName));
  const name = asString(basicsTracker.pick(basics, KEYS.name)) || [first, last].filter(Boolean).join(" ");
  const headline = asString(basicsTracker.pick(basics, KEYS.headline));
  const summaryValue = basicsTracker.pick(basics, KEYS.summary) ?? tracker.pick(root, KEYS.summary);
  const availability = asString(basicsTracker.pick(basics, KEYS.availability)) || null;
  for (const aliases of [KEYS.email, KEYS.phone, KEYS.website, KEYS.location, KEYS.profiles, KEYS.contact, PROFILE_KEYS]) tracker.consume(root, aliases);

  const detectedJsonResume = isObject(basicsValue) && (Array.isArray(root.work) || /jsonresume/i.test(asString(root.$schema)));
  diagnostics.push({
    level: "info",
    code: "json-schema",
    message: detectedJsonResume ? "JSON Resume schema detected." : "Custom JSON layout mapped using key aliases.",
    line: null,
  });

  const experience = mapExperience(tracker.pick(root, KEYS.experience));
  const projects = mapProjects(tracker.pick(root, KEYS.projects));
  const skills = mapSkills(tracker.pick(root, KEYS.skills));
  const education = mapEducation(tracker.pick(root, KEYS.education));
  const certifications = mapCertifications(tracker.pick(root, KEYS.certifications));
  const awards = mapAwards(tracker.pick(root, KEYS.awards));
  const languages = mapLanguages(tracker.pick(root, KEYS.languages));

  const extras: Array<{ title: string; items: string[] }> = [];
  for (const [key, value] of Object.entries(root)) {
    if (tracker.used.has(key) || IGNORED_KEYS.has(keyOf(key)) || key.startsWith("_")) continue;
    const items = asLines(value);
    if (!items.length) continue;
    extras.push({ title: humanizeKey(key), items });
    diagnostics.push({ level: "info", code: "json-custom-key", message: `Key “${key}” kept as a custom section.`, line: null });
  }

  const summary =
    typeof summaryValue === "string"
      ? summaryValue.split(/\n\s*\n/).map(collapseWhitespace).filter(Boolean)
      : Array.isArray(summaryValue)
        ? asLines(summaryValue)
        : [asString(summaryValue)].filter(Boolean);

  const resume: Resume = {
    basics: { name, headline, availability, summary, contact: mapContact(contactSources) },
    experience: experience.map((entry, index) => ({ id: `experience-${index}`, ...entry })),
    projects: projects.map((entry, index) => ({ id: `project-${index}`, ...entry })),
    skills: skills.map((group, index) => ({ id: `skills-${index}`, ...group })),
    education: education.map((entry, index) => ({ id: `education-${index}`, ...entry })),
    certifications: certifications.map((entry, index) => ({ id: `certification-${index}`, ...entry })),
    awards: awards.map((entry, index) => ({ id: `award-${index}`, ...entry })),
    languages: languages.map((entry, index) => ({ id: `language-${index}`, ...entry })),
    extras: extras.map((extra, index) => ({ id: `extra-${index}`, ...extra })),
  };
  return { ok: true, resume, diagnostics };
}
