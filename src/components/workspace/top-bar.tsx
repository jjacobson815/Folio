"use client";

import { memo } from "react";
import type { ParseResult } from "@/parser";
import { ExportMenu } from "./export-menu";
import { ThemeSwitcher } from "./theme-switcher";

export const TopBar = memo(function TopBar({ result }: { result: ParseResult }) {
  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/80 px-3 backdrop-blur sm:px-4 print:hidden">
      <div className="flex min-w-0 items-center gap-2.5">
        <span
          aria-hidden="true"
          className="grid size-8 shrink-0 place-items-center rounded-lg bg-linear-to-br from-violet-500 to-cyan-400 text-sm font-bold text-white shadow-md shadow-violet-500/25"
        >
          F
        </span>
        <div className="hidden min-w-0 leading-tight sm:block">
          <h1 className="text-sm font-semibold tracking-tight">Folio</h1>
          <p className="truncate text-xs text-muted-foreground">Résumé → portfolio, live</p>
        </div>
      </div>
      <div className="ml-auto flex items-center gap-2">
        <ThemeSwitcher />
        <ExportMenu result={result} />
      </div>
    </header>
  );
});
