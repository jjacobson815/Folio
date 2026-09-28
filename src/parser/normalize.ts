import { totalMonths } from "./dates";
import { detectTechnologies, groupByCategory, techRatio } from "./taxonomy";
import { hostOf, smartCase, titleCase, uniqueBy } from "./text";
import type { CompletenessCheck, Diagnostic, Resume, ResumeStats } from "./types";

function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const words = local
    .replace(/\d+/g, " ")
    .split(/[._\-+]+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 1);
  return words.length >= 2 ? titleCase(words.slice(0, 3).join(" ")) : "";
}

/**
 * Cross-section clean-up and fallbacks shared by every input format:
 * name/headline recovery, spoken-vs-programming language disambiguation, tech-stack inference,
 * empty-entry pruning and stable, index-based ids (so React keys survive edits to entry text).
 */
export function finalizeResume(input: Resume, diagnostics: Diagnostic[]): Resume {
  const resume: Resume = structuredClone(input);
  const { basics } = resume;

  basics.name = basics.name.trim();
  if (!basics.name && basics.contact.email) {
    const derived = nameFromEmail(basics.contact.email);
    if (derived) {
      basics.name = derived;
      diagnostics.push({ level: "info", code: "name-from-email", message: `No name found — using “${derived}” derived from your email.`, line: null });
    }
  }

  resume.experience = resume.experience
    .map((entry) => ({ ...entry, role: smartCase(entry.role), company: smartCase(entry.company) }))
    .filter((entry) => entry.role || entry.company || entry.highlights.length || entry.summary);

  if (!basics.headline) {
    const current = resume.experience.find((entry) => entry.period?.end?.isPresent) ?? resume.experience[0];
    if (current?.role) {
      basics.headline = current.role;
      diagnostics.push({ level: "info", code: "headline-fallback", message: `No headline found — using your latest role “${current.role}”.`, line: null });
    }
  }

  resume.projects = resume.projects.filter(
    (project) => project.name !== "Untitled project" || project.description || project.highlights.length,
  );
  resume.education = resume.education.filter((entry) => entry.institution || entry.degree);

  // "Languages: TypeScript, Go" is a tech list, not spoken languages.
  if (resume.languages.length && techRatio(resume.languages.map((entry) => entry.language)) >= 0.5) {
    const items = resume.languages.map((entry) => entry.language);
    const existing = resume.skills.find((group) => group.category.toLowerCase() === "languages");
    if (existing) existing.items = uniqueBy([...existing.items, ...items], (item) => item.toLowerCase());
    else resume.skills.unshift({ id: "", category: "Languages", items, inferred: false });
    resume.languages = [];
    diagnostics.push({ level: "info", code: "languages-as-skills", message: "“Languages” looked like programming languages, so they were added to Skills.", line: null });
  }

  if (!resume.skills.length) {
    const corpus = [
      ...basics.summary,
      ...resume.experience.flatMap((entry) => [entry.summary ?? "", ...entry.highlights, ...entry.technologies]),
      ...resume.projects.flatMap((project) => [project.description ?? "", ...project.highlights, ...project.technologies]),
    ].join("\n");
    const inferred = detectTechnologies(corpus);
    if (inferred.length) {
      resume.skills = groupByCategory(inferred).map((bucket) => ({ id: "", category: bucket.category, items: bucket.items, inferred: true }));
      diagnostics.push({
        level: "info",
        code: "skills-inferred",
        message: `No skills section — inferred ${inferred.length} technologies from your experience and projects.`,
        line: null,
      });
    }
  }

  const contact = basics.contact;
  if (contact.website) {
    const websiteHost = hostOf(contact.website);
    if (contact.profiles.some((profile) => hostOf(profile.url) === websiteHost && profile.network !== "website")) contact.website = null;
  }
  contact.profiles = contact.profiles.filter((profile) => profile.network !== "website" || profile.url !== contact.website);

  resume.experience = resume.experience.map((entry, index) => ({ ...entry, id: `experience-${index}` }));
  resume.projects = resume.projects.map((entry, index) => ({ ...entry, id: `project-${index}` }));
  resume.skills = resume.skills.map((group, index) => ({ ...group, id: `skills-${index}` }));
  resume.education = resume.education.map((entry, index) => ({ ...entry, id: `education-${index}` }));
  resume.certifications = resume.certifications.map((entry, index) => ({ ...entry, id: `certification-${index}` }));
  resume.awards = resume.awards.map((entry, index) => ({ ...entry, id: `award-${index}` }));
  resume.languages = resume.languages.map((entry, index) => ({ ...entry, id: `language-${index}` }));
  resume.extras = resume.extras.map((entry, index) => ({ ...entry, id: `extra-${index}` }));
  return resume;
}

export function computeStats(resume: Resume, now: Date = new Date()): ResumeStats {
  const months = totalMonths(resume.experience.map((entry) => entry.period), now);
  const technologies = new Set(
    [
      ...resume.skills.flatMap((group) => group.items),
      ...resume.experience.flatMap((entry) => entry.technologies),
      ...resume.projects.flatMap((project) => project.technologies),
    ].map((item) => item.toLowerCase()),
  );
  const sections = [
    resume.basics.summary.length,
    resume.experience.length,
    resume.projects.length,
    resume.skills.length,
    resume.education.length,
    resume.certifications.length,
    resume.awards.length,
    resume.languages.length,
    ...resume.extras.map((extra) => extra.items.length),
  ].filter((count) => count > 0).length;
  return {
    yearsOfExperience: months >= 12 ? Math.floor(months / 12) : null,
    roles: resume.experience.length,
    projects: resume.projects.length,
    technologies: technologies.size,
    sections,
  };
}

/** Weighted checklist that powers the editor's "portfolio strength" meter and its suggestions. */
export function computeCompleteness(resume: Resume): { score: number; checks: CompletenessCheck[] } {
  const { basics } = resume;
  const skillCount = resume.skills.reduce((total, group) => total + group.items.length, 0);
  const checks: CompletenessCheck[] = [
    { id: "name", label: "Name", weight: 14, passed: Boolean(basics.name), hint: "Put your full name on the first line (or as a # heading)." },
    { id: "headline", label: "Headline", weight: 10, passed: Boolean(basics.headline), hint: "Add a one-line headline under your name, e.g. “Senior Frontend Engineer”." },
    {
      id: "contact",
      label: "Contact",
      weight: 12,
      passed: Boolean(basics.contact.email || basics.contact.profiles.length),
      hint: "Add an email or a LinkedIn/GitHub link so visitors can reach you.",
    },
    { id: "summary", label: "Summary", weight: 10, passed: basics.summary.length > 0, hint: "Add a short “Summary” or “About” section — it becomes your hero pitch." },
    { id: "experience", label: "Experience", weight: 18, passed: resume.experience.length > 0, hint: "Add an “Experience” section with your roles and dates." },
    {
      id: "impact",
      label: "Impact bullets",
      weight: 10,
      passed: resume.experience.some((entry) => entry.highlights.length >= 2),
      hint: "Give each role two or more bullet points describing measurable outcomes.",
    },
    { id: "projects", label: "Projects", weight: 12, passed: resume.projects.length > 0, hint: "Add a “Projects” section — showcased work converts better than a job list." },
    { id: "skills", label: "Skills", weight: 9, passed: skillCount >= 5, hint: "List at least five skills, ideally grouped (“Frontend: React, Next.js”)." },
    { id: "education", label: "Education", weight: 5, passed: resume.education.length > 0, hint: "Add education, a bootcamp or relevant training." },
  ];
  const total = checks.reduce((sum, check) => sum + check.weight, 0);
  const earned = checks.filter((check) => check.passed).reduce((sum, check) => sum + check.weight, 0);
  return { score: Math.round((earned / total) * 100), checks };
}
