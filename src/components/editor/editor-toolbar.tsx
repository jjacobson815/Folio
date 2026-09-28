"use client";

import { BookOpen, ChevronDown, Eraser, FileJson, FileText, Hash, LoaderCircle, Upload } from "lucide-react";
import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip } from "@/components/ui/tooltip";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SAMPLES, type SampleId } from "@/lib/samples";
import type { FormatPreference, ParseResult, SourceFormat } from "@/parser";
import { ACCEPTED_FILE_TYPES } from "@/store/import-action";
import { usePortfolioStore } from "@/store/portfolio-store";

export const FORMAT_LABELS: Record<SourceFormat, string> = { json: "JSON", markdown: "Markdown", text: "Plain text" };

const FORMAT_OPTIONS: ReadonlyArray<{ value: FormatPreference; label: string }> = [
  { value: "auto", label: "Auto" },
  { value: "markdown", label: "MD" },
  { value: "json", label: "JSON" },
  { value: "text", label: "Text" },
];

const SAMPLE_ICONS: Record<SampleId, typeof Hash> = { markdown: Hash, json: FileJson, text: FileText };

export function EditorToolbar({ result, onImport, isImporting }: { result: ParseResult; onImport: (file: File) => void; isImporting: boolean }) {
  const formatPreference = usePortfolioStore((state) => state.formatPreference);
  const setFormatPreference = usePortfolioStore((state) => state.setFormatPreference);
  const loadSample = usePortfolioStore((state) => state.loadSample);
  const clearSource = usePortfolioStore((state) => state.clearSource);
  const characters = usePortfolioStore((state) => state.source.length);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const detected = result.isEmpty ? null : result.detected;

  return (
    <div className="shrink-0 border-b bg-background/60 print:hidden">
      <div className="flex h-12 items-center gap-2 px-3 sm:px-4">
        <h2 className="text-sm font-semibold">Source</h2>
        {detected ? (
          <Tooltip content={`Auto-detected with ${Math.round(detected.confidence * 100)}% confidence`}>
            <span className="inline-flex h-5 items-center rounded-full bg-brand/10 px-2 text-[0.6875rem] font-medium text-brand">
              {FORMAT_LABELS[detected.format]}
            </span>
          </Tooltip>
        ) : null}

        <div className="ml-auto flex items-center gap-1">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="gap-1">
                <BookOpen aria-hidden="true" />
                <span className="hidden sm:inline">Samples</span>
                <ChevronDown aria-hidden="true" className="size-3.5 opacity-60" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel>Load a sample résumé (undoable)</DropdownMenuLabel>
              {SAMPLES.map((sample) => {
                const Icon = SAMPLE_ICONS[sample.id];
                return (
                  <DropdownMenuItem key={sample.id} onSelect={() => loadSample(sample.id)}>
                    <Icon aria-hidden="true" />
                    <div className="flex min-w-0 flex-col">
                      <span className="font-medium">{sample.label}</span>
                      <span className="truncate text-xs text-muted-foreground">{sample.description}</span>
                    </div>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) onImport(file);
              event.target.value = "";
            }}
          />
          <Tooltip content="Import .md, .txt or .json (or drag & drop)">
            <Button variant="ghost" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isImporting} aria-label="Import file">
              {isImporting ? <LoaderCircle aria-hidden="true" className="animate-spin" /> : <Upload aria-hidden="true" />}
              <span className="hidden sm:inline">Import</span>
            </Button>
          </Tooltip>
          <Tooltip content="Clear editor (undoable)">
            <Button variant="ghost" size="icon-sm" onClick={clearSource} disabled={!characters} aria-label="Clear editor">
              <Eraser aria-hidden="true" />
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="flex h-10 items-center gap-3 px-3 sm:px-4">
        <ToggleGroup
          type="single"
          value={formatPreference}
          onValueChange={(value) => value && setFormatPreference(value as FormatPreference)}
          aria-label="Input format"
        >
          {FORMAT_OPTIONS.map((option) => (
            <ToggleGroupItem key={option.value} value={option.value} className="h-6 px-2 text-[0.6875rem]">
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        <span className="ml-auto font-mono text-[0.6875rem] tabular-nums text-muted-foreground">{characters.toLocaleString()} chars</span>
      </div>
    </div>
  );
}
