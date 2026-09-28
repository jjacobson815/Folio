"use client";

import { usePortfolioTheme } from "./theme-context";

/** Decorative, theme-specific background layer: floating gradient orbs (Glass) or a rigid grid (Brutal). */
export function Backdrop() {
  const theme = usePortfolioTheme();

  if (theme.id === "glass") {
    return (
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[1400px] overflow-hidden">
        <div className="absolute -top-40 left-1/2 h-[36rem] w-[36rem] -translate-x-[70%] animate-float rounded-full bg-violet-600/35 blur-[120px] motion-reduce:animate-none" />
        <div className="absolute top-20 left-1/2 h-[30rem] w-[30rem] translate-x-[10%] animate-float rounded-full bg-cyan-500/20 blur-[120px] [animation-delay:-5s] motion-reduce:animate-none" />
        <div className="absolute top-[42rem] left-[10%] h-[26rem] w-[26rem] animate-float rounded-full bg-fuchsia-600/15 blur-[120px] [animation-delay:-9s] motion-reduce:animate-none" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,rgb(255_255_255/0.035)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/0.035)_1px,transparent_1px)] bg-size-[64px_64px] [mask-image:radial-gradient(ellipse_at_top,#000_20%,transparent_70%)]" />
      </div>
    );
  }

  if (theme.id === "brutalist") {
    return (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(to_right,rgb(11_11_11/0.07)_1px,transparent_1px),linear-gradient(to_bottom,rgb(11_11_11/0.07)_1px,transparent_1px)] bg-size-[40px_40px]"
      />
    );
  }

  return null;
}
