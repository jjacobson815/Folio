import { describe, expect, it } from "vitest";
import { getSample } from "../lib/samples";
import { findDateRange, formatRange, parseDateToken, totalMonths } from "./dates";
import { parseResume, toJsonResume } from "./index";
import { relaxedJsonParse } from "./json";

const NOW = new Date(2026, 8, 1);

describe("markdown sample", () => {
  const result = parseResume(getSample("markdown").source);
  const { resume } = result;

  it("detects markdown and extracts identity + contact", () => {
    expect(result.format).toBe("markdown");
    expect(resume.basics.name).toBe("Maya Okafor");
    expect(resume.basics.headline).toMatch(/^Senior Product Engineer/);
    expect(resume.basics.availability).toMatch(/^Open to staff-level/);
    expect(resume.basics.contact.email).toBe("maya@okafor.example");
    expect(resume.basics.contact.location).toBe("Berlin, Germany");
    expect(resume.basics.contact.website).toBe("https://okafor.example");
    expect(resume.basics.contact.profiles.map((profile) => profile.network)).toEqual(["github", "linkedin"]);
    expect(resume.basics.summary).toHaveLength(2);
  });

  it("splits roles, companies, locations and dates", () => {
    expect(resume.experience.map((entry) => [entry.role, entry.company, entry.location])).toEqual([
      ["Senior Product Engineer", "Lumen Labs", "Remote"],
      ["Frontend Engineer", "Parcelly", "Berlin, Germany"],
      ["Software Engineer", "Northwind Health", "Lagos, Nigeria"],
    ]);
    const [lumen] = resume.experience;
    expect(lumen?.period?.end?.isPresent).toBe(true);
    expect(formatRange(lumen?.period ?? null)).toBe("Mar 2022 – Present");
    expect(lumen?.summary).toMatch(/^Lumen builds analytics/);
    expect(lumen?.highlights).toHaveLength(4);
    expect(lumen?.technologies).toEqual(["TypeScript", "React", "Next.js", "Tailwind CSS", "PostgreSQL", "Vercel"]);
  });

  it("turns titled bullets with nested bullets into projects", () => {
    expect(resume.projects.map((project) => project.name)).toEqual(["Nebula", "Contrastly", "perf-budget-action"]);
    const [nebula] = resume.projects;
    expect(nebula?.description).toBe("Real-time collaborative whiteboard built on CRDTs.");
    expect(nebula?.highlights).toHaveLength(2);
    expect(nebula?.links.map((link) => link.kind)).toEqual(["repo", "live"]);
  });

  it("parses skills, education, certifications and languages", () => {
    expect(resume.skills.map((group) => group.category)).toEqual(["Languages", "Frontend", "Backend & Data", "Tooling"]);
    expect(resume.education[0]).toMatchObject({ institution: "University of Lagos", degree: "B.Sc.", field: "Computer Science" });
    expect(resume.education[0]?.period?.end?.year).toBe(2017);
    expect(resume.certifications.map((certification) => [certification.name, certification.issuer])).toEqual([
      ["AWS Certified Developer – Associate", "Amazon Web Services"],
      ["Certified Kubernetes Application Developer (CKAD)", "Cloud Native Computing Foundation"],
    ]);
    expect(resume.languages.map((entry) => `${entry.language}:${entry.fluency}`)).toEqual(["English:Native", "German:B2", "Yoruba:Native"]);
  });

  it("scores a complete resume highly", () => {
    expect(result.completeness.score).toBe(100);
    expect(result.diagnostics.filter((diagnostic) => diagnostic.level !== "info")).toEqual([]);
  });
});

describe("JSON Resume sample", () => {
  const result = parseResume(getSample("json").source);
  const { resume } = result;

  it("maps the JSON Resume schema", () => {
    expect(result.format).toBe("json");
    expect(result.diagnostics.some((diagnostic) => diagnostic.message === "JSON Resume schema detected.")).toBe(true);
    expect(resume.basics).toMatchObject({ name: "Daniel Reyes", headline: "Staff Platform Engineer" });
    expect(resume.basics.contact.location).toBe("Austin, TX");
    expect(resume.experience[0]?.period?.end?.isPresent).toBe(true);
    expect(resume.experience[0]?.technologies).toContain("Argo CD");
    expect(resume.skills.map((group) => group.category)).toEqual(["Infrastructure", "Languages", "Observability"]);
    expect(resume.skills[0]?.items).toContain("Google Cloud");
  });

  it("keeps unknown keys as custom sections", () => {
    expect(resume.extras[0]?.title).toBe("Volunteer");
    expect(resume.extras[0]?.items[0]).toMatch(/^Mentor — Austin Code Academy \(Jan 2019\)/);
  });
});

describe("plain-text sample", () => {
  const result = parseResume(getSample("text").source);
  const { resume } = result;

  it("handles ALL-CAPS headings and a pipe-delimited contact line", () => {
    expect(result.format).toBe("text");
    expect(resume.basics.name).toBe("Priya Ramanathan");
    expect(resume.basics.headline).toBe("Machine Learning Engineer — NLP & Recommendation Systems");
    expect(resume.basics.contact).toMatchObject({ phone: "+1 (415) 555-0134", location: "San Francisco, CA" });
    expect(resume.basics.contact.profiles).toHaveLength(2);
  });

  it("reads column-aligned dates, comma headers and wrapped bullets", () => {
    expect(resume.experience.map((entry) => [entry.role, entry.company])).toEqual([
      ["Senior Machine Learning Engineer", "Stratus Analytics"],
      ["Machine Learning Engineer", "Brightpath Education"],
      ["Research Intern", "University of Toronto Vector Lab"],
    ]);
    expect(resume.experience[1]?.highlights[0]).toMatch(/students and improving course completion/);
    expect(resume.experience[2]?.location).toBe("Toronto, ON");
    expect(formatRange(resume.experience[2]?.period ?? null)).toBe("Summer 2017");
  });

  it("parses two education lines, GPA, awards and custom sections", () => {
    expect(resume.education.map((entry) => [entry.degree, entry.field, entry.institution])).toEqual([
      ["M.S.", "Computer Science", "University of Toronto"],
      ["B.Tech", "Information Technology", "Anna University"],
    ]);
    expect(resume.education[1]?.score).toBe("8.9/10");
    expect(resume.skills.map((group) => group.category)).toEqual(["Languages", "ML", "Data & Infra"]);
    expect(resume.awards[1]).toMatchObject({ title: "Best Paper", issuer: "NeurIPS LatinX in AI Workshop" });
    expect(resume.extras[0]?.title).toBe("Volunteering");
  });
});

describe("fallbacks for messy input", () => {
  it("repairs hand-written JSON", () => {
    const parsed = relaxedJsonParse(`{
      // comment
      name: 'Ana Silva',
      title: "Data Engineer",
      skills: ["Python", "dbt",],
    }`);
    expect(parsed.ok && parsed.repaired).toBe(true);
    const result = parseResume(`{ name: 'Ana Silva', title: "Data Engineer", skills: ["Python", "dbt",], }`);
    expect(result.resume.basics.name).toBe("Ana Silva");
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "json-repaired")).toBe(true);
  });

  it("repairs missing commas between members", () => {
    const result = parseResume('{\n  "name": "Ana Silva",\n  "email": "ana@example.com"\n  "title": "Data Engineer"\n  "skills": ["SQL" "dbt"]\n}');
    expect(result.format).toBe("json");
    expect(result.resume.basics).toMatchObject({ name: "Ana Silva", headline: "Data Engineer" });
    expect(result.resume.skills[0]?.items).toEqual(["SQL", "dbt"]);
  });

  it("reports the line of unrecoverable JSON and falls back to text heuristics", () => {
    const result = parseResume('{\n  "name": "Ana Silva",\n  "email": "ana@example.com",\n  "title": : "Data Engineer"\n}');
    const error = result.diagnostics.find((diagnostic) => diagnostic.level === "error");
    expect(error?.code).toBe("json-syntax");
    expect(error?.line).toBe(4);
    expect(error?.message).toBe("Invalid JSON: Unexpected token ':'. Showing a best-effort text parse instead.");
    expect(result.format).toBe("text");
    expect(result.resume.basics.contact.email).toBe("ana@example.com");
  });

  it("maps custom JSON layouts through key aliases", () => {
    const result = parseResume(
      JSON.stringify({
        fullName: "Kenji Watanabe",
        headline: "iOS Engineer",
        contact: { email: "kenji@example.com", github: "kenjiw" },
        jobs: [{ employer: "Tidepool", title: "Senior iOS Engineer", dates: "2020 - Present", achievements: "Built offline sync\nShipped widgets" }],
        techStack: { mobile: ["Swift", "SwiftUI"], backend: "Go, PostgreSQL" },
      }),
    );
    const { resume } = result;
    expect(resume.basics.name).toBe("Kenji Watanabe");
    expect(resume.basics.contact.profiles[0]?.url).toBe("https://github.com/kenjiw");
    expect(resume.experience[0]).toMatchObject({ company: "Tidepool", role: "Senior iOS Engineer", highlights: ["Built offline sync", "Shipped widgets"] });
    expect(resume.experience[0]?.period?.end?.isPresent).toBe(true);
    expect(resume.skills).toEqual([
      { id: "skills-0", category: "Mobile", items: ["Swift", "SwiftUI"], inferred: false },
      { id: "skills-1", category: "Backend", items: ["Go", "PostgreSQL"], inferred: false },
    ]);
  });

  it("infers work history and skills from text with no headings", () => {
    const result = parseResume(
      [
        "Lena Fischer",
        "lena.fischer@example.com",
        "",
        "Backend Developer at Quanta GmbH (2019 - 2023)",
        "- Built payment APIs in Go and PostgreSQL",
        "- Ran Kubernetes clusters on AWS",
      ].join("\n"),
    );
    const { resume } = result;
    expect(result.diagnostics.some((diagnostic) => diagnostic.code === "sections-inferred")).toBe(true);
    expect(resume.experience[0]).toMatchObject({ role: "Backend Developer", company: "Quanta GmbH" });
    expect(resume.skills.every((group) => group.inferred)).toBe(true);
    expect(resume.skills.flatMap((group) => group.items)).toEqual(expect.arrayContaining(["PostgreSQL", "Kubernetes", "AWS"]));
    expect(resume.basics.headline).toBe("Backend Developer");
  });

  it("treats a programming 'Languages' section as skills", () => {
    const result = parseResume("# Sam Lee\n\n## Languages\nTypeScript, Rust, Go\n");
    expect(result.resume.languages).toEqual([]);
    expect(result.resume.skills[0]).toMatchObject({ category: "Languages", items: ["TypeScript", "Rust", "Go"] });
  });

  it("auto-groups a flat skills list with the taxonomy", () => {
    const result = parseResume("# Sam Lee\n\n## Skills\nReact, Node.js, PostgreSQL, Docker, Figma, Jest, k8s");
    const categories = Object.fromEntries(result.resume.skills.map((group) => [group.category, group.items]));
    expect(categories).toMatchObject({ Frontend: ["React"], Backend: ["Node.js"], Data: ["PostgreSQL"], "Cloud & DevOps": ["Docker", "Kubernetes"] });
  });

  it("opens sections from inline one-liners and derives a name from email", () => {
    const result = parseResume("sam.lee@example.com\nSkills: React, TypeScript, GraphQL\nSummary: Frontend engineer focused on accessibility.");
    expect(result.resume.basics.name).toBe("Sam Lee");
    expect(result.resume.skills[0]?.items).toEqual(["React", "TypeScript", "GraphQL"]);
    expect(result.resume.basics.summary).toEqual(["Frontend engineer focused on accessibility."]);
  });

  it("returns an empty result for blank input", () => {
    const result = parseResume("   \n  ");
    expect(result.isEmpty).toBe(true);
    expect(result.completeness.score).toBe(0);
  });
});

describe("dates", () => {
  it.each([
    ["Jan 2020 – Present", "Jan 2020 – Present"],
    ["2019-2021", "2019 – 2021"],
    ["03/2018 to 06/2020", "Mar 2018 – Jun 2020"],
    ["Sept. 2017 — Current", "Sep 2017 – Present"],
    ["Since 2021", "2021 – Present"],
    ["2022 –", "2022 – Present"],
    ["2021-04-01 - 2023-02-15", "Apr 2021 – Feb 2023"],
  ])("parses %s", (input, expected) => {
    expect(formatRange(findDateRange(input)?.range ?? null)).toBe(expected);
  });

  it("parses short years and seasons", () => {
    expect(parseDateToken("Mar '19")).toMatchObject({ year: 2019, month: 3 });
    expect(parseDateToken("Fall 2020")).toMatchObject({ year: 2020, month: 9 });
  });

  it("merges overlapping ranges when totalling experience", () => {
    const a = findDateRange("Jan 2020 - Dec 2021")?.range ?? null;
    const b = findDateRange("Jun 2021 - Dec 2022")?.range ?? null;
    expect(totalMonths([a, b], NOW)).toBe(36);
  });
});

describe("JSON Resume export", () => {
  it("round-trips text into the JSON Resume schema", () => {
    const { resume } = parseResume(getSample("text").source);
    const exported = toJsonResume(resume, NOW);
    expect(exported.basics.name).toBe("Priya Ramanathan");
    expect(exported.work[0]).toMatchObject({ name: "Stratus Analytics", startDate: "2021-01", endDate: undefined });
    expect(exported.education[1]).toMatchObject({ institution: "Anna University", studyType: "B.Tech", endDate: "2016", score: "8.9/10" });
    expect(parseResume(JSON.stringify(exported)).resume.experience).toHaveLength(3);
  });
});
