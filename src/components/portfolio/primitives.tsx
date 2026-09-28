"use client";

import { ArrowUpRight } from "lucide-react";
import type { CSSProperties, ElementType, MouseEvent, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { usePortfolioTheme } from "./theme-context";

type RevealTag = "div" | "li" | "section" | "article" | "header" | "p" | "h1" | "h2" | "dl" | "ul" | "ol" | "span" | "footer";

/**
 * Entry animation driven purely by CSS: Tailwind's `starting:` variant compiles to `@starting-style`, so an
 * element fades/rises in the first time it is inserted. Re-renders with the same key never re-animate, which
 * keeps live typing calm while newly parsed entries still animate in.
 */
export function Reveal({
  as,
  delay = 0,
  className,
  style,
  children,
  id,
}: {
  as?: RevealTag;
  delay?: number;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
  id?: string;
}) {
  const Tag: ElementType = as ?? "div";
  return (
    <Tag
      id={id}
      style={{ ...style, transitionDelay: delay ? `${Math.min(delay, 900)}ms` : undefined }}
      className={cn(
        "transition-[opacity,translate] duration-700 ease-out-expo starting:translate-y-4 starting:opacity-0",
        "motion-reduce:transition-none motion-reduce:starting:translate-y-0",
        className,
      )}
    >
      {children}
    </Tag>
  );
}

export function scrollToSection(event: MouseEvent<HTMLAnchorElement>, id: string) {
  const target = document.getElementById(id);
  if (!target) return;
  event.preventDefault();
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export function SectionHeading({ index, title, id }: { index: number; title: string; id: string }) {
  const theme = usePortfolioTheme();
  const number = String(index).padStart(2, "0");

  if (theme.id === "brutalist") {
    return (
      <Reveal className="flex items-center gap-4">
        <h2
          id={id}
          className="inline-flex items-center gap-3 pf-border bg-pf-fg px-3 py-1.5 font-pf-label text-sm font-bold uppercase tracking-[0.18em] text-pf-accent shadow-[4px_4px_0_0_var(--pf-accent-2)]"
        >
          <span aria-hidden="true">[{number}]</span>
          {title}
        </h2>
        <span aria-hidden="true" className="h-[3px] flex-1 bg-pf-border" />
      </Reveal>
    );
  }

  if (theme.id === "glass") {
    return (
      <Reveal className="flex flex-col gap-3">
        <span aria-hidden="true" className="pf-label text-pf-accent">
          {number} <span className="text-pf-muted">/</span> {title}
        </span>
        <h2 id={id} className="bg-linear-to-br from-white via-white to-white/45 bg-clip-text text-3xl font-semibold tracking-tight text-transparent @3xl:text-4xl">
          {title}
        </h2>
      </Reveal>
    );
  }

  return (
    <Reveal className="flex items-baseline gap-5 pf-border-t pt-5">
      <span aria-hidden="true" className="pf-label text-pf-muted">
        {number}
      </span>
      <h2 id={id} className="font-pf-display text-[2.25rem] leading-none tracking-tight @3xl:text-[2.75rem]">
        {title}
      </h2>
    </Reveal>
  );
}

export function Section({
  id,
  index,
  title,
  children,
  className,
}: {
  id: string;
  index: number;
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section id={`pf-${id}`} aria-labelledby={`pf-${id}-title`} className={cn("scroll-mt-20 py-12 @3xl:py-16", className)}>
      <SectionHeading index={index} title={title} id={`pf-${id}-title`} />
      <div className="mt-8 @3xl:mt-10">{children}</div>
    </section>
  );
}

export function Tag({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap text-xs font-medium",
        "minimal:rounded-full minimal:border minimal:border-pf-border minimal:px-2.5 minimal:py-0.5 minimal:text-pf-muted",
        "brutalist:border-2 brutalist:border-pf-border brutalist:bg-pf-card brutalist:px-2 brutalist:py-0.5 brutalist:font-pf-label brutalist:text-[0.68rem] brutalist:uppercase brutalist:tracking-wide brutalist:transition-colors brutalist:hover:bg-pf-fg brutalist:hover:text-pf-accent",
        "glass:rounded-full glass:bg-white/[0.06] glass:px-2.5 glass:py-1 glass:text-pf-fg/80 glass:ring-1 glass:ring-inset glass:ring-white/10",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function ExternalLink({ href, children, className, ariaLabel }: { href: string; children: ReactNode; className?: string; ariaLabel?: string }) {
  const isExternal = /^https?:/i.test(href);
  return (
    <a
      href={href}
      aria-label={ariaLabel}
      target={isExternal ? "_blank" : undefined}
      rel={isExternal ? "noreferrer noopener" : undefined}
      className={className}
    >
      {children}
    </a>
  );
}

/** Theme-aware call-to-action button styles, shared by the hero, nav and contact sections. */
export function pfButton(variant: "primary" | "secondary", className?: string) {
  return cn(
    "inline-flex h-11 items-center justify-center gap-2 px-5 text-sm font-medium outline-none transition-[translate,box-shadow,background-color,opacity,color] duration-200",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pf-accent [&_svg]:size-4 [&_svg]:shrink-0",
    variant === "primary"
      ? [
          "minimal:rounded-full minimal:bg-pf-fg minimal:text-pf-bg minimal:hover:opacity-85",
          "brutalist:h-12 brutalist:border-[3px] brutalist:border-pf-border brutalist:bg-pf-accent brutalist:font-pf-label brutalist:font-bold brutalist:uppercase brutalist:tracking-wide brutalist:text-pf-accent-fg",
          "brutalist:shadow-[4px_4px_0_0_var(--pf-border)] brutalist:hover:-translate-x-0.5 brutalist:hover:-translate-y-0.5 brutalist:hover:shadow-[6px_6px_0_0_var(--pf-border)] brutalist:active:translate-x-0.5 brutalist:active:translate-y-0.5 brutalist:active:shadow-none",
          "glass:rounded-full glass:bg-white glass:text-[#0b0718] glass:shadow-[0_10px_40px_-12px_rgb(167_139_250/0.75)] glass:hover:-translate-y-px glass:hover:shadow-[0_16px_50px_-10px_rgb(167_139_250/0.9)]",
        ]
      : [
          "minimal:rounded-full minimal:border minimal:border-pf-border minimal:px-4 minimal:hover:bg-pf-subtle",
          "brutalist:h-12 brutalist:border-[3px] brutalist:border-pf-border brutalist:bg-pf-card brutalist:px-4 brutalist:font-pf-label brutalist:font-bold brutalist:uppercase brutalist:tracking-wide",
          "brutalist:shadow-[4px_4px_0_0_var(--pf-border)] brutalist:hover:-translate-x-0.5 brutalist:hover:-translate-y-0.5 brutalist:hover:shadow-[6px_6px_0_0_var(--pf-border)] brutalist:active:translate-x-0.5 brutalist:active:translate-y-0.5 brutalist:active:shadow-none",
          "glass:rounded-full glass:border glass:border-white/10 glass:bg-white/[0.04] glass:px-4 glass:text-pf-fg/90 glass:backdrop-blur glass:hover:bg-white/[0.09]",
        ],
    className,
  );
}

export function ArrowLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <ExternalLink
      href={href}
      className={cn(
        "group/link inline-flex items-center gap-1 text-sm font-medium underline-offset-4 hover:underline",
        "brutalist:font-pf-label brutalist:text-xs brutalist:font-bold brutalist:uppercase brutalist:no-underline brutalist:hover:bg-pf-accent",
        "glass:text-pf-fg/80 glass:hover:text-white",
        className,
      )}
    >
      {children}
      <ArrowUpRight aria-hidden="true" className="size-3.5 transition-transform group-hover/link:-translate-y-0.5 group-hover/link:translate-x-0.5" />
    </ExternalLink>
  );
}
