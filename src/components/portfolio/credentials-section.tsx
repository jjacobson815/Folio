"use client";

import { Award as AwardIcon, BadgeCheck, GraduationCap, Languages } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { formatDate, formatRange, type Resume } from "@/parser";
import { ArrowLink, Reveal, Section } from "./primitives";

function Group({ title, icon, children, delay }: { title: string; icon: ReactNode; children: ReactNode; delay: number }) {
  return (
    <Reveal delay={delay} className="min-w-0">
      <h3 className="flex items-center gap-2 pf-label text-pf-muted brutalist:font-bold brutalist:text-pf-fg glass:text-pf-accent [&_svg]:size-3.5">
        {icon}
        {title}
      </h3>
      <ul className="mt-4 space-y-3 minimal:space-y-0">{children}</ul>
    </Reveal>
  );
}

/** One credential row: plain hairline rows in Minimal, bordered blocks in Brutal, frosted cards in Glass. */
function Item({ title, subtitle, meta, children }: { title: string; subtitle?: string | null; meta?: string | null; children?: ReactNode }) {
  return (
    <li className={cn("minimal:pf-border-b minimal:py-4 minimal:first:pt-0", "brutalist:pf-border brutalist:bg-pf-card brutalist:p-4", "glass:pf-surface glass:p-5")}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="font-medium leading-snug brutalist:font-bold">{title}</p>
        {meta ? <p className="shrink-0 font-pf-label text-xs text-pf-muted">{meta}</p> : null}
      </div>
      {subtitle ? <p className="mt-1 text-sm text-pf-muted">{subtitle}</p> : null}
      {children}
    </li>
  );
}

export function CredentialsSection({ resume, index }: { resume: Resume; index: number }) {
  const { education, certifications, awards, languages } = resume;
  const title = education.length ? (certifications.length || awards.length ? "Education & credentials" : "Education") : "Credentials";
  const groups = [
    education.length ? "education" : null,
    certifications.length ? "certifications" : null,
    awards.length ? "awards" : null,
    languages.length ? "languages" : null,
  ].filter(Boolean);
  const delayOf = (group: string) => (groups.indexOf(group) + 1) * 70;

  return (
    <Section id="credentials" index={index} title={title}>
      <div className="grid gap-10 @3xl:grid-cols-2 @3xl:gap-x-12">
        {education.length ? (
          <Group title="Education" icon={<GraduationCap aria-hidden="true" />} delay={delayOf("education")}>
            {education.map((entry) => (
              <Item
                key={entry.id}
                title={[entry.degree, entry.field].filter(Boolean).join(" in ") || entry.institution}
                subtitle={[entry.degree || entry.field ? entry.institution : null, entry.location].filter(Boolean).join(" · ") || null}
                meta={formatRange(entry.period) || null}
              >
                {entry.score ? <p className="mt-2 text-sm">GPA {entry.score}</p> : null}
                {entry.details.length ? (
                  <ul className="mt-2 space-y-1 text-sm leading-relaxed text-pf-muted">
                    {entry.details.map((detail, detailIndex) => (
                      <li key={detailIndex}>{detail}</li>
                    ))}
                  </ul>
                ) : null}
              </Item>
            ))}
          </Group>
        ) : null}

        {certifications.length ? (
          <Group title="Certifications" icon={<BadgeCheck aria-hidden="true" />} delay={delayOf("certifications")}>
            {certifications.map((certification) => (
              <Item key={certification.id} title={certification.name} subtitle={certification.issuer} meta={formatDate(certification.date) || null}>
                {certification.url ? (
                  <div className="mt-2">
                    <ArrowLink href={certification.url}>Verify</ArrowLink>
                  </div>
                ) : null}
              </Item>
            ))}
          </Group>
        ) : null}

        {awards.length ? (
          <Group title="Awards" icon={<AwardIcon aria-hidden="true" />} delay={delayOf("awards")}>
            {awards.map((award) => (
              <Item key={award.id} title={award.title} subtitle={award.issuer} meta={formatDate(award.date) || null}>
                {award.summary ? <p className="mt-1.5 text-sm leading-relaxed text-pf-muted">{award.summary}</p> : null}
              </Item>
            ))}
          </Group>
        ) : null}

        {languages.length ? (
          <Group title="Languages" icon={<Languages aria-hidden="true" />} delay={delayOf("languages")}>
            {languages.map((entry) => (
              <Item key={entry.id} title={entry.language} meta={entry.fluency} />
            ))}
          </Group>
        ) : null}
      </div>
    </Section>
  );
}
