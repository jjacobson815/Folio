import type { SourceLine } from "./lines";
import { hostOf, normalizeUrl, stripLeadingSymbols, trimDecorations, uniqueBy, wordCount, type InlineLink } from "./text";
import type { ContactInfo, ProfileNetwork, SocialProfile } from "./types";

export const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+\d{1,3}[\s.-]?)?(?:\(\d{1,4}\)[\s.-]?)?\d{2,4}(?:[\s.-]?\d{2,4}){1,4}/;
const YEAR_RANGE_RE = /^(?:19|20)\d{2}\s*[-–—]\s*(?:19|20)\d{2}$/;
const AVAILABILITY_RE = /\b(open to|available for|available from|seeking|looking for|currently exploring|actively interviewing)\b/i;

const NETWORK_RULES: ReadonlyArray<{ network: ProfileNetwork; label: string; host: RegExp }> = [
  { network: "github", label: "GitHub", host: /(^|\.)github\.com$/ },
  { network: "gitlab", label: "GitLab", host: /(^|\.)gitlab\.com$/ },
  { network: "linkedin", label: "LinkedIn", host: /(^|\.)linkedin\.com$/ },
  { network: "x", label: "X", host: /(^|\.)(twitter|x)\.com$/ },
  { network: "dribbble", label: "Dribbble", host: /(^|\.)dribbble\.com$/ },
  { network: "behance", label: "Behance", host: /(^|\.)behance\.net$/ },
  { network: "medium", label: "Medium", host: /(^|\.)medium\.com$/ },
  { network: "devto", label: "DEV", host: /^dev\.to$/ },
  { network: "stackoverflow", label: "Stack Overflow", host: /(^|\.)stackoverflow\.com$/ },
  { network: "youtube", label: "YouTube", host: /(^|\.)(youtube\.com|youtu\.be)$/ },
  { network: "bluesky", label: "Bluesky", host: /(^|\.)bsky\.app$/ },
  { network: "mastodon", label: "Mastodon", host: /(^|\.)(mastodon\.social|hachyderm\.io|fosstodon\.org|mas\.to|mastodon\.online|infosec\.exchange)$/ },
  { network: "instagram", label: "Instagram", host: /(^|\.)instagram\.com$/ },
];

const NETWORK_BASE_URL: Partial<Record<ProfileNetwork, string>> = {
  github: "https://github.com/",
  gitlab: "https://gitlab.com/",
  linkedin: "https://www.linkedin.com/in/",
  x: "https://x.com/",
  dribbble: "https://dribbble.com/",
  behance: "https://www.behance.net/",
  medium: "https://medium.com/@",
  devto: "https://dev.to/",
  instagram: "https://instagram.com/",
  bluesky: "https://bsky.app/profile/",
};

const LABEL_TO_NETWORK: Record<string, ProfileNetwork> = {
  github: "github",
  gitlab: "gitlab",
  linkedin: "linkedin",
  twitter: "x",
  x: "x",
  dribbble: "dribbble",
  behance: "behance",
  medium: "medium",
  "dev.to": "devto",
  stackoverflow: "stackoverflow",
  "stack overflow": "stackoverflow",
  youtube: "youtube",
  bluesky: "bluesky",
  bsky: "bluesky",
  mastodon: "mastodon",
  instagram: "instagram",
};

const LABELED_RE =
  /^(e-?mail|mail|phone|tel(?:ephone)?|mobile|cell|location|address|based in|city|website|web|site|homepage|portfolio|blog|github|gitlab|linkedin|twitter|x|dribbble|behance|medium|dev\.to|mastodon|bluesky|bsky|youtube|stack\s?overflow|instagram|name|full name|title|role|headline|position|availability)\s*[:：]\s*(.+)$/i;

const US_REGIONS = new Set(
  "AL AK AZ AR CA CO CT DE FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY DC AB BC MB NB NL NS NT NU ON PE QC SK YT".split(" "),
);
const COUNTRIES = new Set(
  [
    "usa", "us", "u.s.", "u.s.a.", "united states", "uk", "u.k.", "united kingdom", "england", "scotland", "wales", "ireland",
    "canada", "germany", "france", "spain", "portugal", "italy", "netherlands", "the netherlands", "belgium", "switzerland",
    "austria", "sweden", "norway", "denmark", "finland", "iceland", "poland", "czechia", "czech republic", "estonia",
    "lithuania", "latvia", "ukraine", "romania", "bulgaria", "greece", "turkey", "türkiye", "israel", "uae",
    "united arab emirates", "saudi arabia", "qatar", "egypt", "nigeria", "kenya", "ghana", "south africa", "morocco",
    "india", "pakistan", "bangladesh", "sri lanka", "nepal", "china", "hong kong", "taiwan", "japan", "south korea",
    "korea", "singapore", "malaysia", "indonesia", "philippines", "vietnam", "thailand", "australia", "new zealand",
    "mexico", "brazil", "argentina", "chile", "colombia", "peru", "uruguay", "costa rica", "europe", "eu", "emea",
    "apac", "latam", "north america",
  ],
);
const CITIES = new Set(
  [
    "new york", "new york city", "nyc", "san francisco", "sf", "bay area", "sf bay area", "san francisco bay area",
    "los angeles", "seattle", "austin", "boston", "chicago", "denver", "portland", "atlanta", "miami", "toronto",
    "vancouver", "montreal", "london", "berlin", "munich", "hamburg", "paris", "amsterdam", "dublin", "lisbon",
    "madrid", "barcelona", "stockholm", "copenhagen", "oslo", "helsinki", "zurich", "vienna", "prague", "warsaw",
    "tallinn", "tel aviv", "dubai", "lagos", "nairobi", "cape town", "bangalore", "bengaluru", "mumbai", "delhi",
    "new delhi", "hyderabad", "pune", "chennai", "tokyo", "seoul", "sydney", "melbourne", "auckland", "são paulo",
    "sao paulo", "mexico city", "buenos aires", "singapore", "hong kong", "brooklyn", "oakland", "palo alto",
    "mountain view", "cambridge", "washington", "washington dc", "philadelphia", "pittsburgh", "raleigh",
  ],
);

const ROLE_HINT = /\b(engineer|developer|designer|manager|lead|director|scientist|analyst|consultant|founder|architect|intern|officer|specialist)\b/i;

export function emptyContact(): ContactInfo {
  return { email: null, phone: null, location: null, website: null, profiles: [] };
}

/** Recognises "Berlin, Germany", "Austin, TX", "Remote (EU)", "San Francisco Bay Area" and similar. */
export function isLocationLike(input: string): boolean {
  const text = stripLeadingSymbols(input).replace(/\((?:remote|hybrid|on-?site)\)/i, "").trim();
  if (!text || text.length > 64 || /\d{3,}|@|https?:/i.test(text) || ROLE_HINT.test(text)) return false;
  if (/^(?:fully\s+)?(?:remote|hybrid|on-?site|worldwide|anywhere|distributed)\b/i.test(text) && wordCount(text) <= 5) return true;
  const lower = text.toLowerCase().replace(/\s*\/\s*remote$/i, "");
  if (CITIES.has(lower) || COUNTRIES.has(lower)) return true;
  if (/^greater\s+[\p{L} ]+\s+area$/iu.test(text)) return true;
  const parts = lower.split(/\s*,\s*/);
  if (parts.length < 2 || parts.length > 3) return false;
  const [first = "", ...rest] = parts;
  if (!/^\p{L}[\p{L}.'\- ]{1,40}$/u.test(first) || wordCount(first) > 4) return false;
  const last = rest.at(-1) ?? "";
  const originalLast = text.split(/\s*,\s*/).at(-1) ?? "";
  if (/^[A-Z]{2}$/.test(originalLast) && US_REGIONS.has(originalLast)) return true;
  return COUNTRIES.has(last) || CITIES.has(first);
}

function handleFromUrl(network: ProfileNetwork, url: URL): string {
  const segments = url.pathname.split("/").filter(Boolean);
  if (network === "linkedin") {
    const index = segments.findIndex((segment) => segment === "in" || segment === "company");
    return decodeURIComponent(segments[index + 1] ?? segments[0] ?? "");
  }
  if (network === "medium" && !segments.length) return url.hostname.split(".")[0] ?? "";
  if (network === "bluesky" && segments[0] === "profile") return segments[1] ?? "";
  const first = segments[0] ?? "";
  return decodeURIComponent(first.replace(/^@/, ""));
}

/** Classifies a URL as a known social network, or as a personal website when the host is unknown. */
export function classifyUrl(input: string): SocialProfile {
  const url = normalizeUrl(input);
  const host = hostOf(url);
  for (const rule of NETWORK_RULES) {
    if (!rule.host.test(host)) continue;
    let handle = "";
    try {
      handle = handleFromUrl(rule.network, new URL(url));
    } catch {
      handle = "";
    }
    return { network: rule.network, label: rule.label, handle: handle || host, url };
  }
  return { network: "website", label: "Website", handle: host || url, url };
}

/** "GitHub: mayaokafor" → https://github.com/mayaokafor */
export function profileFromLabel(label: string, value: string): SocialProfile | null {
  const network = LABEL_TO_NETWORK[label.toLowerCase()];
  if (!network) return null;
  const trimmed = value.trim();
  if (/[./]/.test(trimmed) && /\.[a-z]{2,}/i.test(trimmed)) return classifyUrl(trimmed);
  const handle = trimmed.replace(/^@/, "").replace(/^in\//i, "");
  const base = NETWORK_BASE_URL[network];
  if (!base || !handle || /\s/.test(handle)) return null;
  const rule = NETWORK_RULES.find((entry) => entry.network === network);
  return { network, label: rule?.label ?? label, handle, url: `${base}${handle}` };
}

export function findPhone(text: string): string | null {
  const match = PHONE_RE.exec(text);
  if (!match) return null;
  const candidate = match[0].trim();
  const digits = candidate.replace(/\D/g, "");
  if (digits.length < 7 || digits.length > 15) return null;
  if (YEAR_RANGE_RE.test(candidate) || /^(?:19|20)\d{2}$/.test(candidate)) return null;
  return candidate;
}

export interface ContactScan {
  contact: ContactInfo;
  /** Chunks of each line that were not contact data, in document order. */
  leftovers: Array<{ line: SourceLine; chunks: string[] }>;
  labeledName: string | null;
  labeledHeadline: string | null;
  availability: string | null;
}

const CHUNK_SPLIT = /\s+[|•·◦⋅∙]\s+|\s{3,}|\s+[–—]\s+|\s+\/\/\s+|\s*\|\s*/;

function linkForChunk(chunk: string, links: readonly InlineLink[]): InlineLink | null {
  const lower = chunk.toLowerCase();
  return (
    links.find((link) => link.label.toLowerCase() === lower) ??
    links.find((link) => lower.includes(link.url.toLowerCase().replace(/^https?:\/\//, "").replace(/^mailto:/, ""))) ??
    null
  );
}

/**
 * Walks header / contact lines chunk by chunk ("maya@site.dev | (555) 010-2030 | Berlin, Germany | github.com/maya"),
 * collecting contact data and returning everything else as leftovers for name / headline / summary detection.
 */
export function scanContactLines(lines: readonly SourceLine[], seed: ContactInfo = emptyContact()): ContactScan {
  const contact: ContactInfo = { ...seed, profiles: [...seed.profiles] };
  const leftovers: ContactScan["leftovers"] = [];
  let labeledName: string | null = null;
  let labeledHeadline: string | null = null;
  let availability: string | null = null;

  const addUrl = (url: string) => {
    if (/^mailto:/i.test(url)) {
      contact.email ??= url.replace(/^mailto:/i, "");
      return;
    }
    if (/^tel:/i.test(url)) {
      contact.phone ??= url.replace(/^tel:/i, "");
      return;
    }
    const profile = classifyUrl(url);
    if (profile.network === "website") contact.website ??= profile.url;
    else contact.profiles.push(profile);
  };

  for (const line of lines) {
    if (line.kind === "blank" || line.kind === "rule") continue;
    const chunks = line.text.split(CHUNK_SPLIT).map((chunk) => stripLeadingSymbols(chunk)).filter(Boolean);
    const rest: string[] = [];

    for (const rawChunk of chunks) {
      const chunk = rawChunk.trim();
      const labeled = LABELED_RE.exec(chunk);
      if (labeled) {
        const label = (labeled[1] ?? "").toLowerCase();
        const value = (labeled[2] ?? "").trim();
        if (/^(e-?mail|mail)$/.test(label)) contact.email ??= EMAIL_RE.exec(value)?.[0] ?? value;
        else if (/^(phone|tel|telephone|mobile|cell)$/.test(label)) contact.phone ??= value;
        else if (/^(location|address|based in|city)$/.test(label)) contact.location ??= value;
        else if (/^(website|web|site|homepage|portfolio|blog)$/.test(label)) {
          const link = linkForChunk(value, line.links);
          contact.website ??= normalizeUrl(link?.url ?? value);
        } else if (/^(name|full name)$/.test(label)) labeledName ??= value;
        else if (/^(title|role|headline|position)$/.test(label)) labeledHeadline ??= value;
        else if (label === "availability") availability ??= value;
        else {
          const link = linkForChunk(value, line.links);
          const profile = link ? classifyUrl(link.url) : profileFromLabel(label, value);
          if (profile) contact.profiles.push(profile);
        }
        continue;
      }

      const basedIn = /^based in\s+(.+)$/i.exec(chunk);
      if (basedIn) {
        contact.location ??= trimDecorations(basedIn[1] ?? "");
        continue;
      }

      const email = EMAIL_RE.exec(chunk);
      if (email) {
        contact.email ??= email[0];
        const remainder = chunk.replace(email[0], "").replace(/^(?:email|e-mail|mail)\b\s*(?:me)?\s*(?:at)?/i, "").trim();
        if (remainder.length > 2 && !/^[\s:()<>[\]-]+$/.test(remainder)) rest.push(remainder);
        continue;
      }

      const link = linkForChunk(chunk, line.links);
      if (link) {
        addUrl(link.url);
        continue;
      }

      const phone = findPhone(chunk);
      if (phone && chunk.replace(phone, "").replace(/[^\p{L}]/gu, "").length <= 6) {
        contact.phone ??= phone;
        continue;
      }

      if (isLocationLike(chunk)) {
        contact.location ??= chunk.replace(/^location\s*/i, "").trim();
        continue;
      }

      if (AVAILABILITY_RE.test(chunk) && wordCount(chunk) <= 18) {
        availability ??= chunk.replace(/[.!]$/, "");
        continue;
      }

      rest.push(chunk);
    }

    // Links the chunk walk did not consume (e.g. a link in the middle of a sentence).
    for (const link of line.links) {
      const url = link.url.toLowerCase();
      const known =
        contact.website?.toLowerCase().includes(url.replace(/^https?:\/\//, "")) ||
        contact.profiles.some((profile) => profile.url.toLowerCase().includes(url.replace(/^https?:\/\//, "")));
      if (!known && rest.some((chunk) => chunk.toLowerCase().includes(url.replace(/^https?:\/\//, "")))) addUrl(link.url);
    }

    if (rest.length) leftovers.push({ line, chunks: rest });
  }

  contact.profiles = uniqueBy(contact.profiles, (profile) => profile.url.toLowerCase().replace(/\/$/, ""));
  return { contact, leftovers, labeledName, labeledHeadline, availability };
}

export function mergeContact(primary: ContactInfo, secondary: ContactInfo): ContactInfo {
  return {
    email: primary.email ?? secondary.email,
    phone: primary.phone ?? secondary.phone,
    location: primary.location ?? secondary.location,
    website: primary.website ?? secondary.website,
    profiles: uniqueBy([...primary.profiles, ...secondary.profiles], (profile) => profile.url.toLowerCase().replace(/\/$/, "")),
  };
}
