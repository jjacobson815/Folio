"use client";

import { Check, ClipboardCopy, Download, FileDown, Printer } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { vanityDomain } from "@/lib/utils";
import { toJsonResume, type ParseResult } from "@/parser";

type Feedback = "copied" | "downloaded" | "failed" | null;

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

  const download = () => {
    const blob = new Blob([serialize(result)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${vanityDomain(result.resume.basics.name).replace(/\.dev$/, "")}-resume.json`;
    anchor.click();
    URL.revokeObjectURL(url);
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
        <DropdownMenuItem onSelect={download}>
          <Download aria-hidden="true" />
          Download resume.json
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
