"use client";

import type { CustomSection } from "@/parser";
import { Reveal, Section } from "./primitives";

/** Sections the parser could not map onto the schema are rendered verbatim so nothing is lost. */
export function ExtrasSection({ section, index }: { section: CustomSection; index: number }) {
  return (
    <Section id={section.id} index={index} title={section.title}>
      <ul className="grid gap-3 @3xl:grid-cols-2">
        {section.items.map((item, itemIndex) => (
          <Reveal
            as="li"
            key={itemIndex}
            delay={itemIndex * 50}
            className="leading-relaxed text-pretty minimal:pf-border-b minimal:pb-3 brutalist:pf-border brutalist:bg-pf-card brutalist:p-4 glass:pf-surface glass:p-5 glass:text-pf-muted"
          >
            {item}
          </Reveal>
        ))}
      </ul>
    </Section>
  );
}
