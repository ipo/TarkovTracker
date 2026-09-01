# TarkovTracker — Agent Instructions

## Project snapshot

- Nuxt 4 SPA (`ssr: false`), Vue 3 Composition API, TypeScript strict, Pinia, Tailwind CSS v4, and Vitest.
- Node >=24.19.0 and `pnpm@11.14.0`.
- The app is a static task and map viewer. It loads `tasks|state|scores.<file-mode>.json` from
  `NUXT_PUBLIC_STATIC_QUEST_DATA_BASE_URL` (default `/quest-data`) and persists local progress in
  browser storage. It has no server API, authentication, synchronization, database, worker, or
  precomputation runtime.

## Commands

Install: `pnpm install` | Dev: `pnpm run dev` (localhost:8046) | Build: `pnpm run build` |
Preview: `pnpm run preview`

Test: `pnpm run test` | Single file: `pnpm exec vitest run path/to/file.test.ts`

Lint: `pnpm run lint` | Format check: `pnpm run format:check` | Typecheck: `pnpm run typecheck` |
i18n: `pnpm run i18n:check` | Unused exports: `pnpm run lint:unused`

Run sustained commands with reduced priority:

```bash
systemd-run --user --scope --same-dir \
  -p CPUWeight=80 -p IOWeight=80 -p MemoryHigh=75% -- \
  nice -n 5 ionice -c 2 -n 5 choom -n 100 -- COMMAND
```

## Project map

- `app/` — pages, features, stores, composables, plugins, locales, and shell.
- `app/features/maps/` — Leaflet map and objective markers.
- `app/stores/` — Pinia metadata, preferences, and local progress state.
- `app/utils/staticQuestHydration.ts` — validates and applies static exporter documents.
- `public/quest-data/` — small schema-v1 fixtures for development and acceptance checks.
- `docs/` — current static-viewer documentation.

## Hard rules

- Keep the app SPA-only. Do not add SSR-only features.
- Tailwind v4 only: no component `<style>` blocks, SCSS, scoped CSS, or hex colors in templates.
- Use `@/` aliases, never parent-relative imports.
- Edit only `app/locales/en.json`; other locale files are Crowdin-owned.
- Do not add runtime dependencies unless existing dependencies are insufficient and the reason is documented.
- Keep secrets out of the repository. The only public data setting is
  `NUXT_PUBLIC_STATIC_QUEST_DATA_BASE_URL`.
- Static hydration must load the three matching schema-v1 files atomically. `state.<file-mode>.json`
  is the authority for confirmed and active task progress; catalog-only tasks must not create map
  markers. A slower old mode load must never overwrite the latest selection.
- Do not add dependencies on task `alternatives`; branch relationships come from failure conditions.
- Keep changes scoped. Avoid code comments unless a local decision is genuinely non-obvious.

## Conventions

- 2-space indent, 100-character lines, single quotes, semicolons, and trailing commas.
- Vue components use `<script setup lang="ts">`; Nuxt and Vue auto-imports must not be imported.
- Use `useSeoMeta` for SEO meta properties and reserve `useHead` for non-meta head elements.
- Components use PascalCase names; composables use `useCamelCase`; tests are `*.test.ts` in
  `__tests__/`.
- User-facing text belongs in `app/locales/en.json` and calls include an English fallback.

## Validation and git

- Run the smallest relevant checks; run tests when executable code or tests change.
- Do not run `pnpm run format` manually; the commit hook formats staged files. CI gates on
  `pnpm run format:check`.
- Before editing and before committing, inspect `git status --short --branch`.
- Do not use destructive git commands without explicit approval.
- Use conventional commits with the scopes in `commitlint.config.js`.

## Documentation sync

`docs/SYSTEMS.md` describes static hydration invariants. Update it when that system changes.
Update this file when commands, structure, runtime configuration, validation, or localization rules
change. Executable configuration takes priority over this file.
