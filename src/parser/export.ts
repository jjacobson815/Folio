import { toIsoDate } from "./dates";
import type { DateRange, Resume } from "./types";

/** Subset of the JSON Resume v1 schema (https://jsonresume.org/schema) produced by the exporter. */
export interface JsonResumeDocument {
  $schema: string;
  basics: {
    name: string;
    label?: string;
    email?: string;
    phone?: string;
    url?: string;
    summary?: string;
    location?: { address: string };
    profiles: Array<{ network: string; username: string; url: string }>;
  };
  work: Array<{
    name?: string;
    position?: string;
    location?: string;
    url?: string;
    startDate?: string;
    endDate?: string;
    summary?: string;
    highlights: string[];
  }>;
  projects: Array<{
    name: string;
    description?: string;
    highlights: string[];
    keywords: string[];
    url?: string;
    roles?: string[];
    startDate?: string;
    endDate?: string;
  }>;
  skills: Array<{ name: string; keywords: string[] }>;
  education: Array<{
    institution: string;
    studyType?: string;
    area?: string;
    startDate?: string;
    endDate?: string;
    score?: string;
    courses: string[];
  }>;
  certificates: Array<{ name: string; issuer?: string; date?: string; url?: string }>;
  awards: Array<{ title: string; awarder?: string; date?: string; summary?: string }>;
  languages: Array<{ language: string; fluency?: string }>;
  meta: { canonical: string; version: string; lastModified: string };
}

function dates(period: DateRange | null): { startDate?: string; endDate?: string } {
  return { startDate: toIsoDate(period?.start ?? null), endDate: toIsoDate(period?.end ?? null) };
}

const orUndefined = (value: string | null | undefined) => (value ? value : undefined);

/** Converts the parsed resume into standard JSON Resume, so messy text can round-trip into a portable format. */
export function toJsonResume(resume: Resume, now: Date = new Date()): JsonResumeDocument {
  const { basics } = resume;
  return {
    $schema: "https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json",
    basics: {
      name: basics.name,
      label: orUndefined(basics.headline),
      email: orUndefined(basics.contact.email),
      phone: orUndefined(basics.contact.phone),
      url: orUndefined(basics.contact.website),
      summary: orUndefined(basics.summary.join("\n\n")),
      location: basics.contact.location ? { address: basics.contact.location } : undefined,
      profiles: basics.contact.profiles.map((profile) => ({ network: profile.label, username: profile.handle, url: profile.url })),
    },
    work: resume.experience.map((entry) => ({
      name: orUndefined(entry.company),
      position: orUndefined(entry.role),
      location: orUndefined(entry.location),
      url: orUndefined(entry.url),
      ...dates(entry.period),
      summary: orUndefined(entry.summary),
      highlights: entry.highlights,
    })),
    projects: resume.projects.map((project) => ({
      name: project.name,
      description: orUndefined(project.description),
      highlights: project.highlights,
      keywords: project.technologies,
      url: project.links[0]?.url,
      roles: project.role ? [project.role] : undefined,
      ...dates(project.period),
    })),
    skills: resume.skills.map((group) => ({ name: group.category, keywords: group.items })),
    education: resume.education.map((entry) => ({
      institution: entry.institution,
      studyType: orUndefined(entry.degree),
      area: orUndefined(entry.field),
      ...dates(entry.period),
      score: orUndefined(entry.score),
      courses: entry.details,
    })),
    certificates: resume.certifications.map((certification) => ({
      name: certification.name,
      issuer: orUndefined(certification.issuer),
      date: toIsoDate(certification.date),
      url: orUndefined(certification.url),
    })),
    awards: resume.awards.map((award) => ({
      title: award.title,
      awarder: orUndefined(award.issuer),
      date: toIsoDate(award.date),
      summary: orUndefined(award.summary),
    })),
    languages: resume.languages.map((entry) => ({ language: entry.language, fluency: orUndefined(entry.fluency) })),
    meta: { canonical: "https://jsonresume.org/schema", version: "v1.0.0", lastModified: now.toISOString() },
  };
}
