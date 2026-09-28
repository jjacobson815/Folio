"use client";

import { ChevronDown, FilePlus2, FileText, Pencil, Trash2 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogFooter, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatRelativeTime } from "@/lib/utils";
import { documentLabel, type DocumentSummary } from "@/storage/documents";
import { usePortfolioStore } from "@/store/portfolio-store";
import { createDocument, deleteDocument, renameDocument, switchDocument } from "@/store/workspace";

function RenameForm({ document, onDone }: { document: DocumentSummary; onDone: () => void }) {
  // Mounted fresh each time the dialog opens, so the field always starts from the current label.
  const [title, setTitle] = useState(document.title || document.name);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // Matching the parsed name means "no custom title", so the label keeps following the résumé's name.
    void renameDocument(document.id, title.trim() === document.name ? "" : title);
    onDone();
  };

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogTitle>Rename résumé</DialogTitle>
      <DialogDescription>
        Leave it empty to use the name from the résumé{document.name ? ` (“${document.name}”)` : ""}.
      </DialogDescription>
      <input
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        maxLength={80}
        aria-label="Résumé name"
        placeholder={document.name || "Untitled résumé"}
        className="h-9 rounded-md border bg-background px-3 text-sm outline-none placeholder:text-muted-foreground/70 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
      <DialogFooter>
        <DialogClose asChild>
          <Button type="button" variant="outline" size="sm">
            Cancel
          </Button>
        </DialogClose>
        <Button type="submit" size="sm">
          Save
        </Button>
      </DialogFooter>
    </form>
  );
}

/** Switches between saved résumés and creates, renames or deletes them. Doubles as the editor's title. */
export function DocumentMenu() {
  const documents = usePortfolioStore((state) => state.documents);
  const activeId = usePortfolioStore((state) => state.activeDocumentId);
  const active = documents.find((document) => document.id === activeId);
  const [dialog, setDialog] = useState<"rename" | "delete" | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const label = active ? documentLabel(active) : "Résumé";

  // The dialogs open from menu items that have unmounted by the time they close: return focus to the trigger.
  const restoreFocus = (event: Event) => {
    event.preventDefault();
    triggerRef.current?.focus();
  };
  const closeDialog = (open: boolean) => {
    if (!open) setDialog(null);
  };

  return (
    <>
      {/* Non-modal so opening a dialog from a menu item doesn't leave pointer events disabled on <body>. */}
      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <Button
            ref={triggerRef}
            variant="ghost"
            size="sm"
            aria-label={`Résumé: ${label}. Switch, create, rename or delete résumés`}
            className="-ml-2 max-w-64 min-w-0 shrink gap-1.5 px-2 text-sm font-semibold text-foreground"
          >
            <FileText aria-hidden="true" className="text-muted-foreground" />
            <span className="truncate">{label}</span>
            <ChevronDown aria-hidden="true" className="size-3.5 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel>Your résumés</DropdownMenuLabel>
          <DropdownMenuRadioGroup
            value={activeId ?? ""}
            onValueChange={(id) => void switchDocument(id)}
            className="max-h-72 overflow-y-auto scrollbar-thin"
          >
            {documents.map((document) => (
              <DropdownMenuRadioItem key={document.id} value={document.id}>
                <span className="flex min-w-0 flex-col">
                  <span className="truncate font-medium">{documentLabel(document)}</span>
                  <span className="text-xs text-muted-foreground">Edited {formatRelativeTime(document.updatedAt)}</span>
                </span>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={() => void createDocument()}>
            <FilePlus2 aria-hidden="true" />
            New résumé
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!active} onSelect={() => setDialog("rename")}>
            <Pencil aria-hidden="true" />
            Rename…
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={!active || documents.length < 2}
            onSelect={() => setDialog("delete")}
            className="text-destructive data-highlighted:bg-destructive/10 data-highlighted:text-destructive"
          >
            <Trash2 aria-hidden="true" className="text-destructive" />
            {documents.length < 2 ? "Delete (keep at least one)" : "Delete…"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={dialog === "rename"} onOpenChange={closeDialog}>
        {active ? (
          <DialogContent onCloseAutoFocus={restoreFocus}>
            <RenameForm document={active} onDone={() => setDialog(null)} />
          </DialogContent>
        ) : null}
      </Dialog>

      <AlertDialog open={dialog === "delete"} onOpenChange={closeDialog}>
        {active ? (
          <AlertDialogContent onCloseAutoFocus={restoreFocus}>
            <AlertDialogTitle>Delete “{label}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes it from this browser. To keep a copy, use Export → Download source first.
            </AlertDialogDescription>
            <div className="flex justify-end gap-2">
              <AlertDialogCancel asChild>
                <Button variant="outline" size="sm">
                  Cancel
                </Button>
              </AlertDialogCancel>
              <AlertDialogAction asChild>
                <Button variant="destructive" size="sm" onClick={() => void deleteDocument(active.id)}>
                  Delete
                </Button>
              </AlertDialogAction>
            </div>
          </AlertDialogContent>
        ) : null}
      </AlertDialog>
    </>
  );
}
