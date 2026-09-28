"use client"; // Error boundaries must be Client Components

import { useEffect } from "react";
import { buttonVariants } from "@/components/ui/button";

/** Route error boundary: without it, any render error in the workspace left a blank page. */
export default function WorkspaceError({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="grid min-h-dvh place-items-center bg-background p-6 text-center">
      <div className="max-w-sm">
        <h1 className="text-lg font-semibold tracking-tight">Something went wrong</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The editor hit an unexpected error. Your résumés are kept in this browser&apos;s storage, and trying again won&apos;t
          delete them.
        </p>
        <button type="button" onClick={() => retry()} className={buttonVariants({ className: "mt-5" })}>
          Try again
        </button>
      </div>
    </main>
  );
}
