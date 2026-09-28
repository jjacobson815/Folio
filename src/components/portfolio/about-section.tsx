"use client";

import type { Resume } from "@/parser";
import { Reveal, Section } from "./primitives";

/** Summary paragraphs beyond the hero lead, plus quick facts derived from the rest of the resume. */
export function AboutSection({ resume, index }: { resume: Resume; index: number }) {
  const { basics } = resume;
  const paragraphs = basics.summary.slice(1);
  const current = resume.experience.find((entry) => entry.period?.end?.isPresent);
  const facts = [
    basics.contact.location ? { label: "Based in", value: basics.contact.location } : null,
    current?.company ? { label: "Currently", value: current.role ? `${current.role} at ${current.company}` : current.company } : null,
    resume.languages.length ? { label: "Speaks", value: resume.languages.map((entry) => entry.language).join(", ") } : null,
    resume.education[0]?.institution ? { label: "Studied at", value: resume.education[0].institution } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);

  return (
    <Section id="about" index={index} title="About">
      <div className="grid gap-10 @3xl:grid-cols-[1fr_16rem] @3xl:gap-14">
        <div className="space-y-5 text-[1.0625rem] leading-relaxed text-pretty minimal:font-pf-display minimal:text-2xl minimal:leading-snug brutalist:text-lg glass:text-pf-muted">
          {paragraphs.map((paragraph, paragraphIndex) => (
            <Reveal as="p" key={paragraphIndex} delay={paragraphIndex * 80}>
              {paragraph}
            </Reveal>
          ))}
        </div>
        {facts.length ? (
          <Reveal as="dl" delay={120} className="space-y-4 self-start brutalist:pf-surface brutalist:p-5 glass:pf-surface glass:p-5">
            {facts.map((fact) => (
              <div key={fact.label}>
                <dt className="pf-label text-pf-muted">{fact.label}</dt>
                <dd className="mt-1 text-sm font-medium">{fact.value}</dd>
              </div>
            ))}
          </Reveal>
        ) : null}
      </div>
    </Section>
  );
}
