# Workflow automation

CI runs formatting, linting, type checks, four Vitest coverage shards, a production build, Fallow,
PR metadata checks, and security scanning. Release automation runs tests, builds the static SPA, and
publishes conventional-commit releases from `main`.

Before submitting executable changes, run `pnpm run format:check`, `pnpm run lint`,
`pnpm run typecheck`, and `pnpm run test`. See `.github/workflows/` for the executable workflow
definitions.
