"use client";

import { cn } from "@/lib/utils";
import { formatRange, rangeDuration, type WorkExperience } from "@/parser";
import { ExternalLink, Reveal, Section, Tag } from "./primitives";
import { usePortfolioTheme } from "./theme-context";

function Company({ entry, className }: { entry: WorkExperience; className?: string }) {
  if (!entry.company) return null;
  if (!entry.url) return <span className={className}>{entry.company}</span>;
  return (
    <ExternalLink href={entry.url} className={cn("underline-offset-4 hover:underline", className)}>
      {entry.company}
    </ExternalLink>
  );
}

function meta(entry: WorkExperience): string {
  return [entry.location, entry.employmentType].filter(Boolean).join(" · ");
}

function Highlights({ items, marker }: { items: string[]; marker: "dash" | "arrow" | "dot" }) {
  if (!items.length) return null;
  return (
    <ul className="mt-4 space-y-2.5">
      {items.map((item, index) => (
        <li
          key={index}
          className={cn(
            "relative pl-6 leading-relaxed text-pretty",
            marker === "dash" && "text-pf-fg/85 before:absolute before:top-[0.75em] before:left-0 before:h-px before:w-3 before:bg-pf-muted",
            marker === "arrow" && "before:absolute before:left-0 before:font-bold before:text-pf-accent-2 before:content-['▸']",
            marker === "dot" && "text-pf-fg/80 before:absolute before:top-[0.6em] before:left-1 before:size-1.5 before:rounded-full before:bg-linear-to-br before:from-violet-300 before:to-cyan-300",
          )}
        >
          {item}
        </li>
      ))}
    </ul>
  );
}

const CARD_ACCENTS = ["bg-pf-accent", "bg-pf-accent-3", "bg-pf-accent-2"] as const;

export function ExperienceSection({ items, index }: { items: WorkExperience[]; index: number }) {
  const theme = usePortfolioTheme();

  if (theme.layout.experience === "cards") {
    return (
      <Section id="experience" index={index} title="Experience">
        <div className="grid gap-7">
          {items.map((entry, position) => (
            <Reveal
              as="article"
              key={entry.id}
              delay={position * 70}
              className="pf-surface transition-[translate,box-shadow,opacity] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-pf-hover"
            >
              <header className={cn("flex flex-wrap items-center justify-between gap-3 pf-border-b px-5 py-3", CARD_ACCENTS[position % CARD_ACCENTS.length])}>
                <h3 className="font-pf-display text-xl font-bold uppercase tracking-tight text-pf-accent-fg">
                  <Company entry={entry} />
                  {!entry.company ? entry.role : null}
                </h3>
                {entry.period ? <span className="bg-pf-fg px-2 py-1 font-pf-label text-xs text-pf-bg">{formatRange(entry.period)}</span> : null}
              </header>
              <div className={cn("grid", entry.technologies.length && "@3xl:grid-cols-[1fr_15rem]")}>
                <div className="p-5 @2xl:p-6">
                  {entry.company && entry.role ? (
                    <p className="font-pf-label text-sm font-bold uppercase">
                      {entry.role}
                      {meta(entry) ? <span className="font-normal text-pf-muted"> {"//"} {meta(entry)}</span> : null}
                    </p>
                  ) : null}
                  {entry.summary ? <p className="mt-3 leading-relaxed text-pf-muted">{entry.summary}</p> : null}
                  <Highlights items={entry.highlights} marker="arrow" />
                </div>
                {entry.technologies.length ? (
                  <aside className="pf-border-t bg-pf-subtle p-5 @3xl:border-t-0 @3xl:border-l-[3px] @3xl:border-l-pf-border">
                    <p className="pf-label font-bold">Stack</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {entry.technologies.map((tech) => (
                        <Tag key={tech}>{tech}</Tag>
                      ))}
                    </div>
                  </aside>
                ) : null}
              </div>
            </Reveal>
          ))}
        </div>
      </Section>
    );
  }

  if (theme.layout.experience === "timeline") {
    return (
      <Section id="experience" index={index} title="Experience">
        <ol className="relative space-y-6 before:absolute before:top-3 before:bottom-3 before:left-[7px] before:w-px before:bg-linear-to-b before:from-violet-400/70 before:via-white/10 before:to-transparent">
          {items.map((entry, position) => (
            <Reveal as="li" key={entry.id} delay={position * 80} className="relative pl-9 @2xl:pl-12">
              <span
                aria-hidden="true"
                className="absolute top-7 left-0 size-[15px] rounded-full border border-violet-300/40 bg-[#0b0718] shadow-[0_0_0_4px_rgb(167_139_250/0.12),0_0_18px_2px_rgb(167_139_250/0.5)]"
              >
                <span className="absolute inset-[4px] rounded-full bg-violet-300" />
              </span>
              <article className="pf-surface p-6 transition-[translate,box-shadow,border-color] duration-300 hover:-translate-y-0.5 hover:border-white/20 hover:shadow-pf-hover @2xl:p-7">
                <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold tracking-tight">{entry.role || entry.company}</h3>
                    {entry.role && entry.company ? (
                      <p className="mt-0.5 bg-linear-to-r from-violet-300 to-cyan-300 bg-clip-text text-sm font-medium text-transparent">
                        <Company entry={entry} />
                      </p>
                    ) : null}
                  </div>
                  {entry.period ? (
                    <span className="shrink-0 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 font-pf-label text-[0.7rem] text-pf-fg/70">
                      {formatRange(entry.period)}
                    </span>
                  ) : null}
                </div>
                {meta(entry) || rangeDuration(entry.period) ? (
                  <p className="mt-2 text-xs text-pf-muted">{[meta(entry), rangeDuration(entry.period)].filter(Boolean).join(" · ")}</p>
                ) : null}
                {entry.summary ? <p className="mt-4 leading-relaxed text-pf-muted">{entry.summary}</p> : null}
                <Highlights items={entry.highlights} marker="dot" />
                {entry.technologies.length ? (
                  <div className="mt-5 flex flex-wrap gap-1.5">
                    {entry.technologies.map((tech) => (
                      <Tag key={tech}>{tech}</Tag>
                    ))}
                  </div>
                ) : null}
              </article>
            </Reveal>
          ))}
        </ol>
      </Section>
    );
  }

  return (
    <Section id="experience" index={index} title="Experience">
      <ol>
        {items.map((entry, position) => (
          <Reveal as="li" key={entry.id} delay={position * 60} className="grid gap-3 pf-border-b py-8 first:pt-2 @3xl:grid-cols-[12rem_1fr] @3xl:gap-10">
            <div className="pf-label leading-relaxed text-pf-muted">
              {entry.period ? <p>{formatRange(entry.period)}</p> : null}
              {rangeDuration(entry.period) ? <p className="mt-1 tracking-[0.08em] normal-case">{rangeDuration(entry.period)}</p> : null}
            </div>
            <div>
              <h3 className="text-lg font-medium leading-snug">
                {entry.role || entry.company}
                {entry.role && entry.company ? (
                  <span className="text-pf-muted">
                    {" "}
                    · <Company entry={entry} />
                  </span>
                ) : null}
              </h3>
              {meta(entry) ? <p className="mt-1 text-sm text-pf-muted">{meta(entry)}</p> : null}
              {entry.summary ? <p className="mt-4 leading-relaxed text-pf-fg/85">{entry.summary}</p> : null}
              <Highlights items={entry.highlights} marker="dash" />
              {entry.technologies.length ? <p className="mt-5 pf-label leading-relaxed text-pf-muted">{entry.technologies.join(" / ")}</p> : null}
            </div>
          </Reveal>
        ))}
      </ol>
    </Section>
  );
}
