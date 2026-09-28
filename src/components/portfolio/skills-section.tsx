"use client";

import { Sparkles } from "lucide-react";
import type { SkillGroup } from "@/parser";
import { Reveal, Section, Tag } from "./primitives";
import { usePortfolioTheme } from "./theme-context";

function InferredNote({ groups }: { groups: SkillGroup[] }) {
  if (!groups.some((group) => group.inferred)) return null;
  return (
    <Reveal as="p" className="mb-6 inline-flex items-center gap-2 text-xs text-pf-muted">
      <Sparkles aria-hidden="true" className="size-3.5" />
      Inferred from the technologies mentioned in your experience and projects.
    </Reveal>
  );
}

export function SkillsSection({ groups, index }: { groups: SkillGroup[]; index: number }) {
  const theme = usePortfolioTheme();

  if (theme.layout.skills === "blocks") {
    return (
      <Section id="skills" index={index} title="Tech stack">
        <InferredNote groups={groups} />
        <div className="grid gap-5 @2xl:grid-cols-2 @5xl:grid-cols-3">
          {groups.map((group, position) => (
            <Reveal key={group.id} delay={position * 60} className="pf-surface">
              <h3 className="pf-border-b bg-pf-fg px-4 py-2 pf-label font-bold text-pf-accent">{group.category}</h3>
              <ul className="flex flex-wrap gap-2 p-4">
                {group.items.map((item) => (
                  <li key={item}>
                    <Tag>{item}</Tag>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </Section>
    );
  }

  if (theme.layout.skills === "pills") {
    return (
      <Section id="skills" index={index} title="Tech stack">
        <InferredNote groups={groups} />
        <div className="grid gap-4 @2xl:grid-cols-2">
          {groups.map((group, position) => (
            <Reveal key={group.id} delay={position * 60} className="pf-surface p-5 @2xl:p-6">
              <h3 className="pf-label text-pf-accent">{group.category}</h3>
              <ul className="mt-4 flex flex-wrap gap-2">
                {group.items.map((item) => (
                  <li key={item}>
                    <Tag className="glass:px-3 glass:text-[0.8rem]">{item}</Tag>
                  </li>
                ))}
              </ul>
            </Reveal>
          ))}
        </div>
      </Section>
    );
  }

  return (
    <Section id="skills" index={index} title="Toolkit">
      <InferredNote groups={groups} />
      <dl>
        {groups.map((group, position) => (
          <Reveal key={group.id} delay={position * 50} className="grid gap-2 pf-border-b py-5 first:pt-1 @3xl:grid-cols-[12rem_1fr] @3xl:gap-10">
            <dt className="pf-label pt-1 text-pf-muted">{group.category}</dt>
            <dd className="text-[1.0625rem] leading-relaxed">{group.items.join(", ")}</dd>
          </Reveal>
        ))}
      </dl>
    </Section>
  );
}
