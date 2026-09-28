"use client";

import { ArrowRight, Mail, Phone } from "lucide-react";
import { ProfileIcon } from "@/components/icons/profile-icon";
import { cn } from "@/lib/utils";
import { prettyUrl, type Basics } from "@/parser";
import { ExternalLink, pfButton, Reveal } from "./primitives";
import { usePortfolioTheme } from "./theme-context";

const HEADLINES = {
  minimal: "Let’s work together.",
  brutalist: "Let’s build something →",
  glass: "Have something ambitious in mind?",
} as const;

export function ContactSection({ basics }: { basics: Basics }) {
  const theme = usePortfolioTheme();
  const { contact } = basics;
  const hasContact = Boolean(contact.email || contact.phone || contact.profiles.length || contact.website);
  const year = new Date().getFullYear();

  return (
    <footer id="pf-contact" className="scroll-mt-20 pt-12 pb-10 @3xl:pt-20">
      {hasContact ? (
        <Reveal
          className={cn(
            "relative overflow-hidden",
            theme.id === "minimal" && "pf-border-t pt-12",
            theme.id === "brutalist" && "pf-surface bg-pf-accent p-7 @2xl:p-10",
            theme.id === "glass" && "pf-surface p-8 text-center @2xl:p-12",
          )}
        >
          {theme.id === "glass" ? (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-80 w-[36rem] max-w-full rounded-full bg-[radial-gradient(closest-side,rgb(139_92_246/0.45),rgb(34_211_238/0.15),transparent)] blur-2xl"
            />
          ) : null}
          <p className={cn("relative pf-label", theme.id === "glass" ? "text-pf-accent" : "text-pf-muted brutalist:text-pf-accent-fg")}>Contact</p>
          <h2
            className={cn(
              "relative mt-4 text-balance",
              theme.id === "minimal" && "font-pf-display text-[clamp(2.5rem,8cqi,5.5rem)] leading-[0.95] tracking-tight",
              theme.id === "brutalist" && "font-pf-display text-[clamp(2.25rem,7.5cqi,5rem)] font-bold uppercase leading-[0.9] tracking-tighter text-pf-accent-fg",
              theme.id === "glass" && "mx-auto max-w-2xl bg-linear-to-b from-white to-white/60 bg-clip-text text-[clamp(2rem,5.5cqi,3.5rem)] font-semibold leading-tight tracking-tight text-transparent",
            )}
          >
            {HEADLINES[theme.id]}
          </h2>

          {contact.email ? (
            <ExternalLink
              href={`mailto:${contact.email}`}
              className={cn(
                "group relative mt-8 inline-flex max-w-full items-center gap-3 break-all",
                theme.id === "minimal" && "font-pf-display text-2xl underline decoration-1 underline-offset-8 @3xl:text-3xl",
                theme.id === "brutalist" && pfButton("secondary", "h-14 text-base normal-case"),
                theme.id === "glass" && pfButton("primary", "h-12 px-6"),
              )}
            >
              <Mail aria-hidden="true" className="size-5 shrink-0" />
              {contact.email}
              <ArrowRight aria-hidden="true" className="size-4 shrink-0 transition-transform group-hover:translate-x-1" />
            </ExternalLink>
          ) : null}

          <div className={cn("relative mt-8 flex flex-wrap gap-2.5", theme.id === "glass" && "justify-center")}>
            {contact.profiles.map((profile) => (
              <ExternalLink key={profile.url} href={profile.url} className={pfButton("secondary", "h-10 text-xs")} ariaLabel={`${profile.label}: ${profile.handle}`}>
                <ProfileIcon network={profile.network} className="size-4" />
                {profile.label}
              </ExternalLink>
            ))}
            {contact.website ? (
              <ExternalLink href={contact.website} className={pfButton("secondary", "h-10 text-xs")}>
                <ProfileIcon network="website" className="size-4" />
                {prettyUrl(contact.website)}
              </ExternalLink>
            ) : null}
            {contact.phone ? (
              <ExternalLink href={`tel:${contact.phone.replace(/[^\d+]/g, "")}`} className={pfButton("secondary", "h-10 text-xs")}>
                <Phone aria-hidden="true" className="size-4" />
                {contact.phone}
              </ExternalLink>
            ) : null}
          </div>
        </Reveal>
      ) : null}

      <div className="mt-12 flex flex-wrap items-center justify-between gap-3 pf-label text-pf-muted">
        <span>
          © {year} {basics.name || "Your Name"}
        </span>
        {contact.location ? <span>{contact.location}</span> : null}
      </div>
    </footer>
  );
}
