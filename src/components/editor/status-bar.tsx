"use client";

import { CircleAlert, CircleCheck, CircleX, Info, Lightbulb, RotateCcw, TriangleAlert, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import type { Diagnostic, ParseResult } from "@/parser";
import type { ImportState } from "@/store/import-action";
import { usePortfolioStore } from "@/store/portfolio-store";
import { FORMAT_LABELS } from "./editor-toolbar";

const plural = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

const LEVEL_STYLES: Record<Diagnostic["level"], { icon: typeof Info; className: string }> = {
  error: { icon: CircleX, className: "text-destructive" },
  warning: { icon: TriangleAlert, className: "text-warning" },
  info: { icon: Info, className: "text-muted-foreground" },
};

function StrengthRing({ score }: { score: number }) {
  const radius = 7;
  const circumference = 2 * Math.PI * radius;
  const tone = score >= 80 ? "text-success" : score >= 50 ? "text-warning" : "text-destructive";
  return (
    <span className="inline-flex items-center gap-1.5">
      <svg viewBox="0 0 18 18" className="size-4 -rotate-90" aria-hidden="true">
        <circle cx="9" cy="9" r={radius} fill="none" strokeWidth="2.5" className="stroke-border" />
        <circle
          cx="9"
          cy="9"
          r={radius}
          fill="none"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - score / 100)}
          className={cn("stroke-current transition-[stroke-dashoffset] duration-700 ease-out-expo", tone)}
        />
      </svg>
      <span className="tabular-nums">{score}%</span>
    </span>
  );
}

function UndoBanner() {
  const undo = usePortfolioStore((state) => state.undo);
  const undoReplace = usePortfolioStore((state) => state.undoReplace);
  const dismissUndo = usePortfolioStore((state) => state.dismissUndo);

  useEffect(() => {
    if (!undo) return;
    const timer = window.setTimeout(dismissUndo, 10_000);
    return () => window.clearTimeout(timer);
  }, [undo, dismissUndo]);

  if (!undo) return null;
  return (
    <div role="status" className="flex h-10 items-center gap-2 border-b bg-brand/[0.07] px-3 text-xs transition-[opacity,translate] duration-300 starting:translate-y-1 starting:opacity-0 sm:px-4">
      <span className="truncate font-medium">{undo.label}</span>
      <button type="button" onClick={undoReplace} className="ml-auto inline-flex items-center gap-1 rounded-md px-2 py-1 font-semibold text-brand hover:bg-brand/10 focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none">
        <RotateCcw aria-hidden="true" className="size-3.5" />
        Undo
      </button>
      <button type="button" onClick={dismissUndo} aria-label="Dismiss" className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground">
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

function ImportErrorBanner({ state }: { state: ImportState }) {
  const [dismissedAt, setDismissedAt] = useState(0);
  useEffect(() => {
    if (state.status !== "error") return;
    const timer = window.setTimeout(() => setDismissedAt(state.at), 7000);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (state.status !== "error" || state.at === dismissedAt) return null;
  return (
    <div role="alert" className="flex min-h-10 items-center gap-2 border-b bg-destructive/[0.07] px-3 py-2 text-xs text-destructive transition-opacity duration-300 starting:opacity-0 sm:px-4">
      <CircleAlert aria-hidden="true" className="size-3.5 shrink-0" />
      <span className="min-w-0 flex-1">{state.message}</span>
      <button type="button" onClick={() => setDismissedAt(state.at)} aria-label="Dismiss" className="rounded-md p-1 hover:bg-destructive/10">
        <X aria-hidden="true" className="size-3.5" />
      </button>
    </div>
  );
}

export function StatusBar({ result, importState }: { result: ParseResult; importState: ImportState }) {
  const [open, setOpen] = useState(false);
  const focusLine = usePortfolioStore((state) => state.focusLine);
  const problems = result.diagnostics.filter((diagnostic) => diagnostic.level !== "info");
  const suggestions = result.completeness.checks.filter((check) => !check.passed);
  const hasError = problems.some((diagnostic) => diagnostic.level === "error");
  const skillCount = result.resume.skills.reduce((total, group) => total + group.items.length, 0);
  const StatusIcon = hasError ? CircleX : problems.length ? TriangleAlert : CircleCheck;

  return (
    <footer className="shrink-0 border-t bg-background/60 print:hidden">
      <UndoBanner />
      <ImportErrorBanner state={importState} />
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="parse-report"
        className="flex h-10 w-full items-center gap-2.5 px-3 text-left text-xs outline-none hover:bg-accent/50 focus-visible:bg-accent/60 sm:px-4"
      >
        <StatusIcon aria-hidden="true" className={cn("size-3.5 shrink-0", hasError ? "text-destructive" : problems.length ? "text-warning" : "text-success")} />
        <span className="truncate font-medium">
          {result.isEmpty ? "Waiting for input" : `Parsed as ${FORMAT_LABELS[result.format]}`}
          <span className="font-normal text-muted-foreground"> · {result.elapsedMs.toFixed(1)} ms</span>
        </span>
        {!result.isEmpty ? (
          <span className="hidden truncate text-muted-foreground @md/editor:inline">
            {plural(result.stats.roles, "role")} · {plural(result.stats.projects, "project")} · {plural(skillCount, "skill")}
          </span>
        ) : null}
        <span className="ml-auto flex shrink-0 items-center gap-2 text-muted-foreground">
          {problems.length ? <span className="tabular-nums">{plural(problems.length, "issue")}</span> : null}
          <StrengthRing score={result.completeness.score} />
          <svg viewBox="0 0 12 12" aria-hidden="true" className={cn("size-3 transition-transform duration-300", open && "rotate-180")}>
            <path d="M2.5 7.5 6 4l3.5 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      </button>

      <div id="parse-report" className={cn("grid transition-[grid-template-rows] duration-300 ease-out-expo", open ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}>
        <div className="min-h-0 overflow-hidden">
          <div className="max-h-60 space-y-4 overflow-y-auto px-3 pt-1 pb-4 text-xs scrollbar-thin sm:px-4">
            <section>
              <h3 className="mb-2 font-semibold text-muted-foreground">Parser report</h3>
              {result.diagnostics.length ? (
                <ul className="space-y-1">
                  {result.diagnostics.map((diagnostic, index) => {
                    const { icon: Icon, className } = LEVEL_STYLES[diagnostic.level];
                    const line = diagnostic.line;
                    return (
                      <li key={`${diagnostic.code}-${index}`}>
                        <button
                          type="button"
                          disabled={line === null}
                          onClick={() => line !== null && focusLine(line)}
                          className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left enabled:hover:bg-accent disabled:cursor-default"
                        >
                          <Icon aria-hidden="true" className={cn("mt-px size-3.5 shrink-0", className)} />
                          <span className="min-w-0 flex-1 leading-relaxed">{diagnostic.message}</span>
                          {line !== null ? <span className="shrink-0 font-mono text-muted-foreground">L{line}</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p className="flex items-center gap-2 px-2 text-muted-foreground">
                  <CircleCheck aria-hidden="true" className="size-3.5 text-success" />
                  Every section was recognised.
                </p>
              )}
            </section>
            {suggestions.length ? (
              <section>
                <h3 className="mb-2 font-semibold text-muted-foreground">Boost your portfolio</h3>
                <ul className="space-y-1">
                  {suggestions.map((check) => (
                    <li key={check.id} className="flex items-start gap-2 px-2 py-1 leading-relaxed">
                      <Lightbulb aria-hidden="true" className="mt-px size-3.5 shrink-0 text-warning" />
                      <span>
                        <span className="font-medium">{check.label}:</span> {check.hint}
                        <span className="text-muted-foreground"> (+{check.weight}%)</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        </div>
      </div>
    </footer>
  );
}
