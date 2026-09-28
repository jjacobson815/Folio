"use client";

import { ToggleGroup as ToggleGroupPrimitive } from "radix-ui";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

/** Segmented control built on Radix ToggleGroup (roving focus, arrow-key navigation, aria-pressed). */
export function ToggleGroup({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Root>) {
  return (
    <ToggleGroupPrimitive.Root
      data-slot="toggle-group"
      className={cn("inline-flex items-center gap-0.5 rounded-lg bg-muted p-0.5", className)}
      {...props}
    />
  );
}

export function ToggleGroupItem({ className, ...props }: ComponentProps<typeof ToggleGroupPrimitive.Item>) {
  return (
    <ToggleGroupPrimitive.Item
      data-slot="toggle-group-item"
      className={cn(
        "inline-flex h-7 items-center justify-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-muted-foreground outline-none transition-[color,background-color,box-shadow]",
        "hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50",
        // Selected state keys off ARIA, not data-state: a Tooltip trigger wrapping the item (asChild) replaces
        // data-state with its own "closed"/"delayed-open" value, while aria-checked / aria-pressed stay intact.
        "aria-checked:bg-card aria-checked:text-foreground aria-checked:shadow-sm aria-checked:ring-1 aria-checked:ring-foreground/10 dark:aria-checked:bg-foreground/15",
        "aria-pressed:bg-card aria-pressed:text-foreground aria-pressed:shadow-sm aria-pressed:ring-1 aria-pressed:ring-foreground/10 dark:aria-pressed:bg-foreground/15",
        "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-3.5",
        className,
      )}
      {...props}
    />
  );
}
