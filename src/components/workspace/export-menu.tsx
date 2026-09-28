"use client";

import { Check, ClipboardCopy, Download, FileDown, FileText, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { downloadText } from "@/lib/download";
import { slugify } from "@/lib/utils";
import { toJsonResume, type ParseResult, type SourceFormat } from "@/parser";
import { documentLabel } from "@/storage/documents";
import { usePortfolioStore } from "@/store/portfolio-store";

type Feedback = "copied" | "downloaded" | "failed" | null;

const SOURCE_FILES: Record<SourceFormat, { extension: string; type: string }> = {
  json: { extension: "json", type: "application/json" },
  markdown: { extension: "md", type: "text/markdown" },
  text: { extension: "txt", type: "text/plain" },
};

function serialize(result: ParseResult): string {
  return `${JSON.stringify(toJsonResume(result.resume), null, 2)}\n`;
}

export function ExportMenu({ result }: { result: ParseResult }) {
  const [feedback, setFeedback] = useState<Feedback>(null);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(null), 1800);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(serialize(result));
      setFeedback("copied");
    } catch {
      setFeedback("failed");
    }
  };

  const downloadJsonResume = () => {
    downloadText(`${slugify(result.resume.basics.name) || "your-name"}-resume.json`, serialize(result), "application/json");
    setFeedback("downloaded");
  };

  /** The raw text is the canonical copy (the JSON Resume export is lossy), so this is the real backup. */
  const downloadSource = () => {
    const { source, documents, activeDocumentId } = usePortfolioStore.getState();
    const active = documents.find((document) => document.id === activeDocumentId);
    const file = SOURCE_FILES[result.detected.format];
    downloadText(`${slugify(active ? documentLabel(active) : result.resume.basics.name) || "resume"}.${file.extension}`, source, file.type);
    setFeedback("downloaded");
  };

  const label = feedback === "copied" ? "Copied" : feedback === "downloaded" ? "Saved" : feedback === "failed" ? "Copy failed" : "Export";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="default" size="sm" className="h-8 min-w-24" disabled={result.isEmpty}>
          {feedback && feedback !== "failed" ? <Check aria-hidden="true" /> : <FileDown aria-hidden="true" />}
          <span aria-live="polite">{label}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Portfolio</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => window.print()}>
          <Printer aria-hidden="true" />
          Print / save as PDF
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Structured data (JSON Resume)</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => void copy()}>
          <ClipboardCopy aria-hidden="true" />
          Copy JSON Resume
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={downloadJsonResume}>
          <Download aria-hidden="true" />
          Download resume.json
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Backup</DropdownMenuLabel>
        <DropdownMenuItem onSelect={downloadSource}>
          <FileText aria-hidden="true" />
          Download source (.{SOURCE_FILES[result.detected.format].extension})
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
