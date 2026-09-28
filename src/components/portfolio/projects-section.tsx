"use client";

import { ArrowUpRight } from "lucide-react";
import { ProfileIcon } from "@/components/icons/profile-icon";
import { cn } from "@/lib/utils";
import { formatRange, type Project, type ProjectLink } from "@/parser";
import { ArrowLink, ExternalLink, Reveal, Section, Tag } from "./primitives";
import { usePortfolioTheme } from "./theme-context";

function LinkIcon({ link }: { link: ProjectLink }) {
  if (link.kind === "repo") return <ProfileIcon network={/gitlab/i.test(link.url) ? "gitlab" : "github"} className="size-4" />;
  return <ArrowUpRight aria-hidden="true" className="size-4" />;
}

function ProjectLinks({ links, variant }: { links: ProjectLink[]; variant: "text" | "blocks" | "pills" }) {
  if (!links.length) return null;
  if (variant === "text") {
    return (
      <div className="flex flex-wrap gap-x-5 gap-y-2 @3xl:flex-col @3xl:items-end">
        {links.map((link) => (
          <ArrowLink key={link.url} href={link.url}>
            {link.label}
          </ArrowLink>
        ))}
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <ExternalLink
          key={link.url}
          href={link.url}
          ariaLabel={`${link.label}: ${link.url}`}
          className={cn(
            "inline-flex h-9 items-center gap-2 px-3 text-xs font-semibold transition-colors",
            variant === "blocks" && "border-2 border-pf-border bg-pf-card font-pf-label uppercase hover:bg-pf-fg hover:text-pf-accent",
            variant === "pills" && "rounded-full border border-white/10 bg-white/[0.04] text-pf-fg/80 hover:bg-white/[0.1] hover:text-white",
          )}
        >
          <LinkIcon link={link} />
          {link.label}
        </ExternalLink>
      ))}
    </div>
  );
}

export function ProjectsSection({ items, index }: { items: Project[]; index: number }) {
  const theme = usePortfolioTheme();

  if (theme.layout.projects === "list") {
    return (
      <Section id="projects" index={index} title="Selected work">
        <ul>
          {items.map((project, position) => (
            <Reveal as="li" key={project.id} delay={position * 60} className="grid gap-5 pf-border-b py-8 first:pt-2 @3xl:grid-cols-[1fr_auto] @3xl:gap-12">
              <div>
                <div className="flex items-baseline gap-4">
                  <span aria-hidden="true" className="pf-label text-pf-muted">
                    {String(position + 1).padStart(2, "0")}
                  </span>
                  <h3 className="font-pf-display text-3xl leading-tight @3xl:text-4xl">{project.name}</h3>
                </div>
                {project.role || project.period ? (
                  <p className="mt-2 pf-label text-pf-muted">{[project.role, formatRange(project.period)].filter(Boolean).join(" · ")}</p>
                ) : null}
                {project.description ? <p className="mt-3 max-w-2xl leading-relaxed text-pf-fg/85 text-pretty">{project.description}</p> : null}
                {project.highlights.length ? (
                  <ul className="mt-3 max-w-2xl space-y-1.5 text-sm leading-relaxed text-pf-muted">
                    {project.highlights.map((highlight, highlightIndex) => (
                      <li key={highlightIndex}>— {highlight}</li>
                    ))}
                  </ul>
                ) : null}
                {project.technologies.length ? <p className="mt-4 pf-label text-pf-muted">{project.technologies.join(" · ")}</p> : null}
              </div>
              <ProjectLinks links={project.links} variant="text" />
            </Reveal>
          ))}
        </ul>
      </Section>
    );
  }

  const brutal = theme.id === "brutalist";
  const featureFirst = items.length >= 3 && items.length % 2 === 1;

  return (
    <Section id="projects" index={index} title={brutal ? "Projects" : "Selected work"}>
      <div className="grid gap-6 @2xl:grid-cols-2">
        {items.map((project, position) => (
          <Reveal
            as="article"
            key={project.id}
            delay={position * 70}
            className={cn(
              "group relative flex flex-col overflow-hidden pf-surface p-6 @2xl:p-7",
              featureFirst && position === 0 && "@2xl:col-span-2",
              brutal
                ? "transition-[translate,box-shadow,opacity] hover:-translate-x-1 hover:-translate-y-1 hover:shadow-pf-hover"
                : "transition-[translate,box-shadow,border-color,opacity] duration-300 hover:-translate-y-1 hover:border-white/20 hover:shadow-pf-hover",
            )}
          >
            {brutal ? null : (
              <span
                aria-hidden="true"
                className="pointer-events-none absolute -top-24 -right-24 size-64 rounded-full bg-[radial-gradient(circle,rgb(167_139_250/0.35),transparent_65%)] opacity-40 blur-2xl transition-opacity duration-500 group-hover:opacity-100"
              />
            )}
            <div className="relative flex items-start justify-between gap-4">
              {brutal ? (
                <span className="bg-pf-fg px-2 py-1 font-pf-label text-xs font-bold text-pf-accent">{String(position + 1).padStart(2, "0")}</span>
              ) : (
                <span className="pf-label text-pf-accent">{project.period ? formatRange(project.period) : `Project ${String(position + 1).padStart(2, "0")}`}</span>
              )}
              {project.role ? <span className={cn("text-xs", brutal ? "pf-label font-bold" : "text-pf-muted")}>{project.role}</span> : null}
            </div>
            <h3 className={cn("relative mt-5", brutal ? "font-pf-display text-2xl font-bold uppercase tracking-tight @3xl:text-3xl" : "text-xl font-semibold tracking-tight")}>
              {project.name}
            </h3>
            {project.description ? (
              <p className="relative mt-3 leading-relaxed text-pf-muted text-pretty">{project.description}</p>
            ) : null}
            {project.highlights.length ? (
              <ul className="relative mt-4 space-y-2 text-sm leading-relaxed">
                {project.highlights.map((highlight, highlightIndex) => (
                  <li
                    key={highlightIndex}
                    className={cn(
                      "relative pl-5",
                      brutal
                        ? "before:absolute before:left-0 before:font-bold before:text-pf-accent-2 before:content-['+']"
                        : "text-pf-fg/75 before:absolute before:top-[0.55em] before:left-0.5 before:size-1.5 before:rounded-full before:bg-cyan-300/80",
                    )}
                  >
                    {highlight}
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="relative mt-auto flex flex-col gap-5 pt-6">
              {project.technologies.length ? (
                <div className="flex flex-wrap gap-1.5">
                  {project.technologies.map((tech) => (
                    <Tag key={tech}>{tech}</Tag>
                  ))}
                </div>
              ) : null}
              <ProjectLinks links={project.links} variant={brutal ? "blocks" : "pills"} />
            </div>
          </Reveal>
        ))}
      </div>
    </Section>
  );
}
