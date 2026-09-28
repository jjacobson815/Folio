"use client";

import { memo } from "react";
import { THEMES, type ThemeId } from "@/lib/themes";
import type { Resume, ResumeStats } from "@/parser";
import { AboutSection } from "./about-section";
import { Backdrop } from "./backdrop";
import { ContactSection } from "./contact-section";
import { CredentialsSection } from "./credentials-section";
import { ExperienceSection } from "./experience-section";
import { ExtrasSection } from "./extras-section";
import { HeroSection } from "./hero-section";
import { PortfolioNav, type NavItem } from "./portfolio-nav";
import { ProjectsSection } from "./projects-section";
import { SkillsSection } from "./skills-section";
import { PortfolioThemeContext } from "./theme-context";

interface PortfolioViewProps {
  resume: Resume;
  stats: ResumeStats;
  themeId: ThemeId;
}

/**
 * The generated portfolio. Memoised on (resume, stats, themeId): during an urgent keystroke render the parse
 * result is the same object reference, so this whole tree is skipped and only the deferred render updates it.
 * It is an @container, so every responsive rule responds to the preview pane width, not the browser window.
 */
export const PortfolioView = memo(function PortfolioView({ resume, stats, themeId }: PortfolioViewProps) {
  const theme = THEMES[themeId];
  const hasAbout = resume.basics.summary.length > 1;
  const hasCredentials = resume.education.length + resume.certifications.length + resume.awards.length + resume.languages.length > 0;

  // Sequential numbering ("01", "02", …) for whichever sections actually render.
  const rendered = [
    hasAbout ? "about" : null,
    resume.experience.length ? "experience" : null,
    resume.projects.length ? "projects" : null,
    resume.skills.length ? "skills" : null,
    hasCredentials ? "credentials" : null,
    ...resume.extras.map((section) => section.id),
  ].filter((key): key is string => key !== null);
  const numberOf = (key: string) => rendered.indexOf(key) + 1;

  const navItems: NavItem[] = [
    hasAbout ? { id: "about", label: "About" } : null,
    resume.experience.length ? { id: "experience", label: "Experience" } : null,
    resume.projects.length ? { id: "projects", label: "Work" } : null,
    resume.skills.length ? { id: "skills", label: "Stack" } : null,
    hasCredentials ? { id: "credentials", label: resume.education.length ? "Education" : "Credentials" } : null,
  ].filter((item): item is NavItem => item !== null);

  return (
    <PortfolioThemeContext value={theme}>
      <article
        data-theme={theme.id}
        className="@container relative isolate min-h-full overflow-x-clip bg-pf-bg font-pf-body text-pf-fg antialiased selection:bg-pf-accent selection:text-pf-accent-fg"
      >
        <Backdrop />
        <PortfolioNav basics={resume.basics} items={navItems} />
        <main className="mx-auto max-w-5xl px-5 @3xl:px-10">
          <HeroSection resume={resume} stats={stats} />
          {hasAbout ? <AboutSection resume={resume} index={numberOf("about")} /> : null}
          {resume.experience.length ? <ExperienceSection items={resume.experience} index={numberOf("experience")} /> : null}
          {resume.projects.length ? <ProjectsSection items={resume.projects} index={numberOf("projects")} /> : null}
          {resume.skills.length ? <SkillsSection groups={resume.skills} index={numberOf("skills")} /> : null}
          {hasCredentials ? <CredentialsSection resume={resume} index={numberOf("credentials")} /> : null}
          {resume.extras.map((section) => (
            <ExtrasSection key={section.id} section={section} index={numberOf(section.id)} />
          ))}
          <ContactSection basics={resume.basics} />
        </main>
      </article>
    </PortfolioThemeContext>
  );
});
