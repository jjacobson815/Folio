"use client";

import { FileJson, FileText, Hash } from "lucide-react";
import { SAMPLES, type SampleId } from "@/lib/samples";
import { usePortfolioStore } from "@/store/portfolio-store";

const ICONS: Record<SampleId, typeof FileJson> = { markdown: Hash, json: FileJson, text: FileText };

export function EmptyPortfolio() {
  const loadSample = usePortfolioStore((state) => state.loadSample);
  return (
    <div className="grid min-h-full place-items-center bg-card p-8">
      <div className="max-w-sm text-center transition-[opacity,translate] duration-700 ease-out-expo starting:translate-y-3 starting:opacity-0">
        <div aria-hidden="true" className="mx-auto grid size-14 place-items-center rounded-2xl bg-linear-to-br from-violet-500 to-cyan-400 text-2xl font-semibold text-white shadow-lg shadow-violet-500/30">
          F
        </div>
        <h2 className="mt-6 text-xl font-semibold tracking-tight">Your portfolio appears here</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Paste a résumé into the editor — Markdown, JSON Resume or plain text — or drop a file. Every keystroke re-renders this page.
        </p>
        <div className="mt-6 grid gap-2">
          {SAMPLES.map((sample) => {
            const Icon = ICONS[sample.id];
            return (
              <button
                key={sample.id}
                type="button"
                onClick={() => loadSample(sample.id)}
                className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5 text-left text-sm transition-colors hover:bg-accent focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none"
              >
                <Icon aria-hidden="true" className="size-4 text-muted-foreground" />
                <span className="font-medium">{sample.label}</span>
                <span className="ml-auto truncate text-xs text-muted-foreground">{sample.description}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
