/** Server-rendered shell shown until the persisted workspace is restored from localStorage. */
export function WorkspaceSkeleton() {
  return (
    <div aria-busy="true" aria-label="Loading workspace" className="flex h-dvh flex-col">
      <div className="flex h-14 shrink-0 items-center gap-3 border-b px-4">
        <span className="size-8 rounded-lg bg-linear-to-br from-violet-500 to-cyan-400 opacity-80" />
        <span className="h-3 w-16 animate-pulse rounded bg-muted" />
        <span className="ml-auto h-8 w-56 animate-pulse rounded-lg bg-muted" />
      </div>
      <div className="flex min-h-0 flex-1">
        <div className="hidden w-[42%] flex-col gap-3 border-r bg-editor p-5 lg:flex">
          {[92, 64, 78, 40, 86, 70, 55, 88, 60].map((width, index) => (
            <span key={index} className="h-3 animate-pulse rounded bg-muted" style={{ width: `${width}%` }} />
          ))}
        </div>
        <div className="flex flex-1 items-center justify-center bg-canvas">
          <span className="size-6 animate-spin rounded-full border-2 border-muted-foreground/30 border-t-brand" />
        </div>
      </div>
    </div>
  );
}
