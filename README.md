# Folio: résumé → portfolio, live

Paste a résumé as Markdown, JSON (JSON Resume or any custom layout) or a messy plain-text export. A client-side parser turns it into a strongly typed schema and renders a portfolio that updates as you type, in three design systems.

Built with Next.js 16 (App Router), React 19, Tailwind CSS v4, Zustand 5, Radix UI and strict TypeScript.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # parser test suite (Vitest)
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
  store/          Zustand store (persisted), deferred parse hook, useActionState file import
  components/
    workspace/      app shell: top bar, theme switcher, export menu, resizable split view
    editor/         toolbar, textarea (drag & drop, jump-to-line), status bar + parser report
    preview/        device-width frame, live/updating indicator
    portfolio/      the generated site: hero, about, experience, projects, skills, credentials, contact
    ui/             shadcn-style primitives on Radix (button, toggle group, dropdown, tooltip)
  lib/            themes, samples, utils
```

## Themes

Colours, type, radii, borders, shadows and blur are CSS variables keyed by `[data-theme]` in `globals.css`. They are exposed to Tailwind through `@theme inline` (`bg-pf-bg`, `shadow-pf`, `font-pf-display`, …), and there are `minimal:`, `brutalist:` and `glass:` custom variants. Structural differences (editorial rows vs. bordered cards vs. glass timeline) come from `lib/themes.ts` and are read through React 19 `use(PortfolioThemeContext)`. The portfolio is an `@container`, so its responsive rules follow the preview pane's width rather than the window's.
