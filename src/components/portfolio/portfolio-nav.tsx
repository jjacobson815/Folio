"use client";

import { cn, initialsOf } from "@/lib/utils";
import type { Basics } from "@/parser";
import { pfButton, scrollToSection } from "./primitives";
import { usePortfolioTheme } from "./theme-context";

export interface NavItem {
  id: string;
  label: string;
}

export function PortfolioNav({ basics, items }: { basics: Basics; items: NavItem[] }) {
  const theme = usePortfolioTheme();
  const contactHref = basics.contact.email ? `mailto:${basics.contact.email}` : "#pf-contact";

  return (
    <header
      className={cn(
        "sticky top-0 z-30 print:hidden",
        theme.id === "minimal" && "bg-pf-bg/85 backdrop-blur-md pf-border-b",
        theme.id === "brutalist" && "border-b-[3px] border-pf-border bg-pf-bg",
        theme.id === "glass" && "border-b border-white/[0.06] bg-[#07070d]/55 backdrop-blur-xl",
      )}
    >
      <nav aria-label="Portfolio" className="mx-auto flex h-16 max-w-5xl items-center gap-4 px-5 @3xl:px-10">
        <a href="#pf-top" onClick={(event) => scrollToSection(event, "pf-top")} className="flex min-w-0 items-center gap-2.5 font-semibold">
          <span
            aria-hidden="true"
            className={cn(
              "grid size-9 shrink-0 place-items-center text-sm",
              theme.id === "minimal" && "rounded-full bg-pf-fg font-pf-display text-base text-pf-bg",
              theme.id === "brutalist" && "border-[3px] border-pf-border bg-pf-accent font-pf-label font-bold",
              theme.id === "glass" && "rounded-xl bg-linear-to-br from-violet-400 to-cyan-400 font-bold text-[#0b0718] shadow-[0_0_24px_-4px_rgb(167_139_250/0.8)]",
            )}
          >
            {initialsOf(basics.name)}
          </span>
          <span className={cn("hidden truncate @md:block", theme.id === "brutalist" && "font-pf-label text-sm uppercase", theme.id === "minimal" && "font-pf-display text-lg font-normal")}>
            {basics.name || "Your Name"}
          </span>
        </a>

        <ul className="ml-auto hidden items-center gap-1 @3xl:flex">
          {items.map((item) => (
            <li key={item.id}>
              <a
                href={`#pf-${item.id}`}
                onClick={(event) => scrollToSection(event, `pf-${item.id}`)}
                className={cn(
                  "inline-flex h-9 items-center px-3 text-sm transition-colors",
                  theme.id === "minimal" && "text-pf-muted hover:text-pf-fg",
                  theme.id === "brutalist" && "font-pf-label text-xs font-bold uppercase hover:bg-pf-fg hover:text-pf-accent",
                  theme.id === "glass" && "rounded-full text-pf-fg/65 hover:bg-white/[0.06] hover:text-white",
                )}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>

        <a
          href={contactHref}
          onClick={contactHref.startsWith("#") ? (event) => scrollToSection(event, "pf-contact") : undefined}
          className={pfButton("primary", "ml-auto h-9 px-4 text-xs @3xl:ml-2 brutalist:h-10")}
        >
          Let’s talk
        </a>
      </nav>
    </header>
  );
}
