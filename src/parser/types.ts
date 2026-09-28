/**
 * Strongly typed resume schema produced by the client-side parser.
 * Every renderer in /components consumes these types and nothing else.
 */

export type SourceFormat = "json" | "markdown" | "text";
export type FormatPreference = "auto" | SourceFormat;

export interface DateValue {
  /** The token as written in the source, e.g. "Mar 2021", "2019-04" or "Present". */
  raw: string;
  year: number | null;
  /** 1–12 when the source specified a month or season. */
  month: number | null;
  isPresent: boolean;
}

export interface DateRange {
  start: DateValue | null;
  end: DateValue | null;
}

export type ProfileNetwork =
  | "github"
  | "gitlab"
  | "linkedin"
  | "x"
  | "dribbble"
  | "behance"
  | "medium"
  | "devto"
  | "stackoverflow"
  | "youtube"
  | "bluesky"
  | "mastodon"
  | "instagram"
  | "website";

export interface SocialProfile {
  network: ProfileNetwork;
  /** Display name of the network, e.g. "GitHub". */
  label: string;
  handle: string;
  url: string;
}

export interface ContactInfo {
  email: string | null;
  phone: string | null;
  location: string | null;
  website: string | null;
  profiles: SocialProfile[];
}

export interface Basics {
  name: string;
  headline: string;
  /** Short availability statement such as "Open to staff-level roles". */
  availability: string | null;
  summary: string[];
  contact: ContactInfo;
}

export type EmploymentType = "Full-time" | "Part-time" | "Contract" | "Freelance" | "Internship";

export interface WorkExperience {
  id: string;
  role: string;
  company: string;
  location: string | null;
  employmentType: EmploymentType | null;
  period: DateRange | null;
  url: string | null;
  summary: string | null;
  highlights: string[];
  technologies: string[];
}

export interface ProjectLink {
  kind: "repo" | "live" | "link";
  label: string;
  url: string;
}

export interface Project {
  id: string;
  name: string;
  role: string | null;
  description: string | null;
  highlights: string[];
  technologies: string[];
  links: ProjectLink[];
  period: DateRange | null;
}

export interface SkillGroup {
  id: string;
  category: string;
  items: string[];
  /** True when the group was inferred from prose rather than an explicit skills section. */
  inferred: boolean;
}

export interface Education {
  id: string;
  institution: string;
  degree: string | null;
  field: string | null;
  location: string | null;
  period: DateRange | null;
  score: string | null;
  details: string[];
}

export interface Certification {
  id: string;
  name: string;
  issuer: string | null;
  date: DateValue | null;
  url: string | null;
}

export interface Award {
  id: string;
  title: string;
  issuer: string | null;
  date: DateValue | null;
  summary: string | null;
}

export interface SpokenLanguage {
  id: string;
  language: string;
  fluency: string | null;
}

/** Any section the parser could not map onto the schema is preserved verbatim here. */
export interface CustomSection {
  id: string;
  title: string;
  items: string[];
}

export interface Resume {
  basics: Basics;
  experience: WorkExperience[];
  projects: Project[];
  skills: SkillGroup[];
  education: Education[];
  certifications: Certification[];
  awards: Award[];
  languages: SpokenLanguage[];
  extras: CustomSection[];
}

export type DiagnosticLevel = "error" | "warning" | "info";

export interface Diagnostic {
  level: DiagnosticLevel;
  code: string;
  message: string;
  /** 1-based source line the diagnostic refers to, when known. */
  line: number | null;
}

export interface CompletenessCheck {
  id: string;
  label: string;
  weight: number;
  passed: boolean;
  hint: string;
}

export interface ResumeStats {
  yearsOfExperience: number | null;
  roles: number;
  projects: number;
  technologies: number;
  sections: number;
}

export interface ParseResult {
  resume: Resume;
  /** Engine that produced `resume` (may differ from the detected format after a fallback). */
  format: SourceFormat;
  detected: { format: SourceFormat; confidence: number };
  diagnostics: Diagnostic[];
  stats: ResumeStats;
  completeness: { score: number; checks: CompletenessCheck[] };
  elapsedMs: number;
  isEmpty: boolean;
}
