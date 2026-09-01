# TarkovTracker — Code Review Policy

## Validation

Run the relevant checks before a ready verdict:

```bash
pnpm run format:check
pnpm run lint
pnpm run typecheck
pnpm run test
pnpm run i18n:check
```

## Review focus

- Preserve SPA-only rendering and the static exporter data path.
- Ensure all three static documents have matching schema version and mode before any state applies.
- Ensure `state.<file-mode>.json` remains the only source for confirmed/active task progress and map markers.
- Preserve mode-load race protection and browser-storage compatibility.
- Keep Tailwind-only styling, `@/` imports, English-only locale edits, and zero new lint warnings.
- Do not add server, authentication, database, worker, or remote game-data runtime plumbing.

## Severity

- P0: the app cannot load, or local progress is lost or corrupted.
- P1: tasks, objectives, modes, or map markers display incorrect static data.
- P2: a regression lacks meaningful automated coverage or violates a project rule.
- P3: non-blocking maintainability or documentation issue.
