# Folio: résumé → portfolio, live

Paste a résumé as Markdown, JSON (JSON Resume or any custom layout) or a messy plain-text export. A client-side parser turns it into a strongly typed schema and renders a portfolio that updates as you type, in three design systems.

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, Zustand 5, Radix UI and strict TypeScript.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # parser, storage and workspace tests (Vitest)
npm run typecheck && npm run lint && npm run build
```

## Structure

```
src/
  app/            layout (fonts, metadata), page (server shell), globals.css (tokens, theme variants)
  parser/         pure TypeScript: raw text → ParseResult (no React, no DOM)
    types.ts        Resume schema + ParseResult / Diagnostic types
    index.ts        parseResume(): detect → JSON or text engine → normalise → stats/score
    detect.ts       format sniffing (JSON / Markdown / plain text) with confidence
    json.ts         tolerant JSON (comments, trailing/missing commas, unquoted keys) + alias mapping
    lines.ts        tokenizer shared by Markdown and plain text (ATX/setext/CAPS/bold/colon headings)
    segment.ts      header zone + typed sections; inline "Skills: …" one-liners; heading inference
    entries.ts      groups a section into entries (headers, prose, bullets, wrapped lines)
    interpret.ts    experience / projects / education / skills / certs / awards / languages
    contact.ts      emails, phones, locations, social profiles, availability
    dates.ts        ranges ("Jan 2020 – Present", "06/2018 – 12/2020", "Summer 2017"), durations
    taxonomy.ts     375 technologies (526 aliases), used to canonicalise and auto-group skills
    normalize.ts    cross-section fallbacks, inferred tech stack, completeness score
    export.ts       parsed résumé → standard JSON Resume
  storage/        persistence behind a DocumentRepository interface (no React)
    documents.ts    DocumentRecord / DocumentSummary, repository interface, record validation
    indexed-db.ts   IndexedDB repository with versioned schema migrations
    memory.ts       tab-lifetime fallback when IndexedDB is blocked or unavailable
    preferences.ts  theme / device / split ratio in localStorage
    recovery.ts     synchronous journal of unsaved edits, replayed after an unload
    legacy.ts       one-time import of the pre-IndexedDB localStorage workspace
  store/          Zustand store (plain state), workspace lifecycle, deferred parse hook, file import
    workspace.ts    boot, autosave, create / switch / rename / delete documents
  components/
    workspace/      app shell: top bar, theme switcher, export menu, resizable split view
    editor/         document menu, toolbar, textarea (drag & drop, jump-to-line), status bar + parser report
    preview/        device-width frame, live/updating indicator
    portfolio/      the generated site: hero, about, experience, projects, skills, credentials, contact
    ui/             shadcn-style primitives on Radix (button, dialogs, toggle group, dropdown, tooltip)
  lib/            themes, samples, utils, download
```

## Storage

Everything stays in the browser. Résumés are documents in IndexedDB (`folio` database); the raw source is the canonical record and the parsed résumé is always derived from it, so parser improvements apply to saved documents. Small UI preferences live in localStorage.

- **Repository boundary.** The store and components never touch IndexedDB directly; they go through `DocumentRepository` (`storage/documents.ts`). A server-backed implementation can replace or sync with it later without UI changes. Both current implementations run the same contract tests.
- **Autosave.** Edits are written at most every 500 ms and immediately when the tab is hidden. Because an IndexedDB write started during unload can be aborted, unsaved edits are also journalled synchronously to localStorage on `pagehide` and replayed on the next visit if they are newer than the saved copy.
- **Failure modes.** If IndexedDB is blocked (site data disabled, sandboxed iframe) or can't be read, the workspace falls back to in-memory documents and says so in the editor; it never hangs on the loading skeleton. Failed saves are reported and retried.
- **Migrations.** IndexedDB schema changes are steps in `MIGRATIONS` (`storage/indexed-db.ts`); append a step to upgrade existing installs. Reads are lenient, so records from older builds load with defaults. Workspaces from the earlier localStorage-only build are imported once and the old key is removed only after the import succeeds.
- **Durability.** After the first edit the app calls `navigator.storage.persist()` so the browser doesn't evict data under storage pressure. Browsers can still clear site data, so Export → Download source keeps a portable copy of the raw text.

## Themes

Colours, type, radii, borders, shadows and blur are CSS variables keyed by `[data-theme]` in `globals.css`. They are exposed to Tailwind through `@theme inline` (`bg-pf-bg`, `shadow-pf`, `font-pf-display`, …), and there are `minimal:`, `brutalist:` and `glass:` custom variants. Structural differences (editorial rows vs. bordered cards vs. glass timeline) come from `lib/themes.ts` and are read through React 19 `use(PortfolioThemeContext)`. The portfolio is an `@container`, so its responsive rules follow the preview pane's width rather than the window's.
