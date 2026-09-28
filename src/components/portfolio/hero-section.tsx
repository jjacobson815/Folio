"use client";

import { ArrowUpRight, Mail, MapPin } from "lucide-react";
import { ProfileIcon } from "@/components/icons/profile-icon";
import { cn } from "@/lib/utils";
import type { ContactInfo, Resume, ResumeStats } from "@/parser";
import { ExternalLink, pfButton, Reveal } from "./primitives";
import { usePortfolioTheme } from "./theme-context";

interface Stat {
  value: string;
  label: string;
}

function statsFor(stats: ResumeStats): Stat[] {
  const items: Array<Stat | null> = [
    stats.yearsOfExperience ? { value: `${stats.yearsOfExperience}+`, label: "Years experience" } : null,
    stats.roles ? { value: String(stats.roles), label: stats.roles === 1 ? "Role" : "Roles" } : null,
    stats.projects ? { value: String(stats.projects), label: stats.projects === 1 ? "Project" : "Projects" } : null,
    stats.technologies ? { value: String(stats.technologies), label: stats.technologies === 1 ? "Technology" : "Technologies" } : null,
  ];
  return items.filter((item): item is Stat => item !== null);
}

function CallsToAction({ contact }: { contact: ContactInfo }) {
  const primaryHref = contact.email ? `mailto:${contact.email}` : (contact.profiles[0]?.url ?? contact.website);
  const secondary = contact.profiles.filter((profile) => profile.url !== primaryHref).slice(0, 2);
  const showWebsite = contact.website && contact.website !== primaryHref;
  if (!primaryHref) return null;
  return (
    <>
      <ExternalLink href={primaryHref} className={pfButton("primary")}>
        {contact.email ? <Mail aria-hidden="true" /> : null}
        {contact.email ? "Get in touch" : "View profile"}
        {!contact.email ? <ArrowUpRight aria-hidden="true" /> : null}
      </ExternalLink>
      {secondary.map((profile) => (
        <ExternalLink key={profile.url} href={profile.url} className={pfButton("secondary")} ariaLabel={`${profile.label}: ${profile.handle}`}>
          <ProfileIcon network={profile.network} className="size-4" />
          <span>{profile.label}</span>
        </ExternalLink>
      ))}
      {showWebsite && contact.website ? (
        <ExternalLink href={contact.website} className={pfButton("secondary")}>
          <ProfileIcon network="website" className="size-4" />
          <span>Website</span>
        </ExternalLink>
      ) : null}
    </>
  );
}

function PulseDot({ className }: { className?: string }) {
  return (
    <span aria-hidden="true" className={cn("relative inline-flex size-2 shrink-0", className)}>
      <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-50 motion-reduce:animate-none" />
      <span className="relative inline-flex size-2 rounded-full bg-current" />
    </span>
  );
}

export function HeroSection({ resume, stats }: { resume: Resume; stats: ResumeStats }) {
  const theme = usePortfolioTheme();
  const { basics } = resume;
  const name = basics.name || "Your Name";
  const lead = basics.summary[0] ?? null;
  const statItems = statsFor(stats);
  const nameClass = basics.name ? "" : "opacity-40";

  if (theme.layout.hero === "blocks") {
    const marquee = resume.skills.flatMap((group) => group.items).slice(0, 18);
    return (
      <section id="pf-top" className="scroll-mt-20 pt-8 pb-10 @3xl:pt-12">
        <Reveal className={cn("grid pf-surface", statItems.length && "@4xl:grid-cols-[1.4fr_1fr]")}>
          <div className={cn("p-6 @2xl:p-10", statItems.length && "pf-border-b @4xl:border-b-0 @4xl:border-r-[3px] @4xl:border-r-pf-border")}>
            <div className="flex flex-wrap gap-2">
              {basics.availability ? (
                <span className="inline-flex items-center gap-2 border-2 border-pf-border bg-pf-accent px-2 py-1 pf-label font-bold text-pf-accent-fg">
                  <PulseDot />
                  <span className="max-w-[36ch] truncate">{basics.availability}</span>
                </span>
              ) : null}
              {basics.contact.location ? (
                <span className="inline-flex items-center gap-1.5 border-2 border-pf-border bg-pf-card px-2 py-1 pf-label">
                  <MapPin aria-hidden="true" className="size-3" />
                  {basics.contact.location}
                </span>
              ) : null}
            </div>
            <h1 className={cn("mt-6 font-pf-display text-[clamp(2.6rem,9.5cqi,6.25rem)] font-bold uppercase leading-[0.86] tracking-[-0.045em] break-words", nameClass)}>
              {name}
            </h1>
            {basics.headline ? (
              <p className="mt-6 inline-block bg-pf-fg px-3 py-1.5 font-pf-label text-xs font-bold uppercase leading-relaxed tracking-wider text-pf-bg @2xl:text-sm">
                {basics.headline}
              </p>
            ) : null}
          </div>
          {statItems.length ? (
            <dl className="grid grid-cols-2 gap-[3px] bg-pf-border">
              {statItems.map((stat, index) => (
                <div
                  key={stat.label}
                  className={cn(
                    "flex flex-col-reverse justify-between gap-6 p-5 @2xl:p-6",
                    ["bg-pf-accent", "bg-pf-card", "bg-pf-accent-3", "bg-pf-accent-2"][index % 4],
                    statItems.length === 3 && index === 2 && "col-span-2",
                  )}
                >
                  <dt className="pf-label font-bold">{stat.label}</dt>
                  <dd className="font-pf-display text-5xl font-bold leading-none tracking-tighter @2xl:text-6xl">{stat.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </Reveal>

        <div className="mt-8 grid gap-7 @5xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] @5xl:items-end">
          {lead ? (
            <Reveal as="p" delay={120} className="max-w-2xl border-l-[6px] border-pf-accent-2 pl-5 text-lg leading-relaxed text-pretty">
              {lead}
            </Reveal>
          ) : null}
          <Reveal delay={200} className="flex flex-wrap gap-3 @5xl:justify-end">
            <CallsToAction contact={basics.contact} />
          </Reveal>
        </div>

        {marquee.length >= 4 ? (
          <Reveal delay={260} className="mt-10 overflow-hidden pf-border bg-pf-fg py-3 text-pf-accent" style={{ maskImage: "linear-gradient(90deg, transparent, #000 6%, #000 94%, transparent)" }}>
            <div aria-hidden="true" className="flex w-max animate-marquee gap-8 motion-reduce:animate-none">
              {[...marquee, ...marquee].map((item, index) => (
                <span key={`${item}-${index}`} className="flex items-center gap-8 font-pf-label text-sm font-bold uppercase tracking-widest">
                  {item}
                  <span className="text-pf-accent-2">✦</span>
                </span>
              ))}
            </div>
          </Reveal>
        ) : null}
      </section>
    );
  }

  if (theme.layout.hero === "spotlight") {
    return (
      <section id="pf-top" className="relative flex scroll-mt-20 flex-col items-center pt-16 pb-12 text-center @3xl:pt-24">
        {basics.availability ? (
          <Reveal className="inline-flex max-w-full items-center gap-2.5 rounded-full border border-white/10 bg-white/[0.04] px-3.5 py-1.5 text-xs text-pf-fg/80 backdrop-blur">
            <PulseDot className="text-emerald-400" />
            <span className="truncate">{basics.availability}</span>
          </Reveal>
        ) : null}
        <Reveal
          as="h1"
          delay={80}
          className={cn(
            "mt-7 bg-linear-to-b from-white to-white/55 bg-clip-text pb-2 text-[clamp(2.6rem,8.5cqi,5.75rem)] font-semibold leading-[0.98] tracking-[-0.04em] text-balance text-transparent",
            nameClass,
          )}
        >
          {name}
        </Reveal>
        {basics.headline ? (
          <Reveal
            as="p"
            delay={140}
            className="mt-4 max-w-2xl bg-linear-to-r from-violet-300 via-fuchsia-200 to-cyan-200 bg-clip-text text-lg font-medium text-balance text-transparent @3xl:text-xl"
          >
            {basics.headline}
          </Reveal>
        ) : null}
        {lead ? (
          <Reveal as="p" delay={200} className="mt-6 max-w-2xl leading-relaxed text-pf-muted text-pretty">
            {lead}
          </Reveal>
        ) : null}
        <Reveal delay={260} className="mt-9 flex flex-wrap justify-center gap-3">
          <CallsToAction contact={basics.contact} />
        </Reveal>
        {statItems.length ? (
          <Reveal
            as="dl"
            delay={340}
            className={cn(
              "mt-14 grid w-full max-w-3xl grid-cols-2 gap-px overflow-hidden rounded-pf bg-white/[0.07] shadow-pf ring-1 ring-white/10",
              statItems.length >= 4 ? "@2xl:grid-cols-4" : statItems.length === 3 ? "@2xl:grid-cols-3" : "",
            )}
          >
            {statItems.map((stat) => (
              <div key={stat.label} className="flex flex-col-reverse gap-1 bg-[#0a0a12]/80 px-4 py-5 backdrop-blur-xl">
                <dt className="text-xs text-pf-muted">{stat.label}</dt>
                <dd className="bg-linear-to-br from-white to-violet-300 bg-clip-text text-3xl font-semibold tracking-tight text-transparent">{stat.value}</dd>
              </div>
            ))}
          </Reveal>
        ) : null}
      </section>
    );
  }

  return (
    <section id="pf-top" className="scroll-mt-20 pt-14 pb-12 @3xl:pt-24 @3xl:pb-16">
      <Reveal className="flex flex-wrap items-center gap-x-5 gap-y-2 pf-label text-pf-muted">
        {basics.availability ? (
          <span className="inline-flex items-center gap-2 text-pf-fg">
            <PulseDot className="text-emerald-600" />
            {basics.availability}
          </span>
        ) : null}
        {basics.contact.location ? <span>{basics.contact.location}</span> : null}
      </Reveal>
      <Reveal as="h1" delay={80} className={cn("mt-6 font-pf-display text-[clamp(3rem,11cqi,7.5rem)] leading-[0.92] tracking-[-0.02em] text-balance", nameClass)}>
        {name}
      </Reveal>
      {basics.headline ? (
        <Reveal as="p" delay={140} className="mt-5 max-w-2xl text-xl text-pf-muted text-balance @3xl:text-2xl">
          {basics.headline}
        </Reveal>
      ) : null}
      {lead ? (
        <Reveal as="p" delay={200} className="mt-8 max-w-2xl text-[1.0625rem] leading-relaxed text-pretty">
          {lead}
        </Reveal>
      ) : null}
      <Reveal delay={260} className="mt-10 flex flex-wrap items-center gap-3">
        <CallsToAction contact={basics.contact} />
      </Reveal>
      {statItems.length ? (
        <Reveal as="dl" delay={320} className="mt-16 grid grid-cols-2 gap-y-6 pf-border-t @2xl:grid-cols-4">
          {statItems.map((stat, index) => (
            <div key={stat.label} className={cn("flex flex-col-reverse gap-2 pt-5 pr-4", index > 0 && "@2xl:border-l @2xl:border-pf-border @2xl:pl-6")}>
              <dt className="pf-label text-pf-muted">{stat.label}</dt>
              <dd className="font-pf-display text-5xl leading-none">{stat.value}</dd>
            </div>
          ))}
        </Reveal>
      ) : null}
    </section>
  );
}
