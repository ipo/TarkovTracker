# GitHub Actions Workflows

Automated CI/CD and maintenance workflows for TarkovTracker.

## Workflows

### CI (`ci.yml`)

**Trigger:** Push to main/develop/wip branches, PRs
**Concurrency:** Outdated runs are automatically cancelled for the same PR or branch.
**Jobs:**

- `Lint & Format` — ESLint + Prettier checks
- `Fallow audit` — changed-file dead code, duplication, and complexity gate
- `Type Check` — `vue-tsc` / Nuxt type checking
- `Test (shard 1/4)` … `Test (shard 4/4)` — Vitest with coverage, sharded across 4 parallel jobs. The `github-actions` reporter annotates failed tests directly on the PR diff so the failing test name and assertion are visible without digging into logs. Shards report imported files only to avoid duplicate zero-filled entries, and Codecov merges the per-shard coverage. Unsharded local coverage retains the full `app/**/*.{ts,vue}` denominator.
- `Validate` — Production Nuxt build + artifact upload (main branch only)
  All jobs run in parallel.

### Crowdin locale PRs

PRs whose changes are limited to the non-English locale exports in `app/locales/` do not trigger
`CI`, `PR Checks`, `Security`, or `Dependabot Auto Merge`. This prevents each burst of Crowdin
synchronization commits from starting redundant repository-owned jobs. Changes to source code,
workflow files, or `app/locales/en.json` still run the normal checks.

### Security (`security.yml`)

**Trigger:** Push to main/develop, PRs, weekly schedule
**Jobs:** `Security Scan` (audit + checksum-verified Gitleaks CLI), `CodeQL` (static analysis)

### Release (`release.yml`)

**Trigger:** Push to main (excluding `**.md`, `docs/**`)
**Jobs:** `Release` (build + semantic-release)

### PR Checks (`pr-checks.yml`)

**Trigger:** PR opened/updated/reopened
**Jobs:** `PR Meta` (labels, size, commit validation)

### Dependabot Auto Merge (`dependabot-auto-merge.yml`)

**Trigger:** Dependabot PR opened/updated/reopened/ready for review
**Jobs:** `Auto-merge safe Dependabot PR` (npm tooling allowlist gate, wait for check runs and
legacy status contexts, verify and match the validated head SHA, squash merge). Every GitHub Actions
workflow-file change requires manual review, including changes to permissions, triggers, or commands.
Action updates additionally require repository or organization allowlist verification when they
introduce a new pinned SHA.

### Stale (`stale.yml`)

**Trigger:** Daily schedule
**Jobs:** Mark inactive issues/PRs stale, then close stale items unless labeled `never-stale`

## Check Count

| Context       | Checks                                                                                                  |
| ------------- | ------------------------------------------------------------------------------------------------------- |
| PR            | ~11 (Fallow audit, Lint & Format, Type Check, Test ×4 shards, Validate, PR Meta, Security Scan, CodeQL) |
| Dependabot PR | ~12 (standard PR checks plus Dependabot Auto Merge when allowlisted)                                    |
| Main push     | ~11 (Fallow audit, Lint & Format, Type Check, Test ×4 shards, Validate, Security Scan, CodeQL, Release) |

## Secrets

Workflow-specific secrets are not required for the Gitleaks step anymore. The workflow downloads a pinned Gitleaks release and verifies its published checksum before scanning. App build jobs use static viewer deployment configuration.

## AI Review Bots

Cubic is the primary automatic reviewer, with Greptile retained as a useful secondary reviewer.
CodeRabbit remains enabled and skips PRs whose titles contain `Crowdin` via `.coderabbit.yaml`, but
its frequent rate limits make it best-effort rather than a required review dependency. Kilo Code is
disabled because its signal was low. CodeAnt is a removal candidate because its AI, quality,
security, and coverage checks overlap with retained integrations; its locale exclusions live in
`.codeant/configuration.json` while its activation remains dashboard-controlled. GitHub-managed
Copilot review and the duplicate CodeQL workflow (`dynamic/github-code-scanning/codeql`) are also
controlled outside this repository; the checked-in `Security` workflow already runs CodeQL for
normal code PRs. Socket PR alerts are limited to dependency manifest changes by the root
`socket.yml`; Snyk behavior is controlled by its integration settings.

## Commands

```bash
gh run list              # List recent runs
gh run view <run-id>     # View run details
gh run watch             # Watch running workflow
```

## Local Testing

Test workflows locally with [act](https://github.com/nektos/act):

```bash
act -j lint-format
act -j typecheck
act -j test
act -j validate
act -j pr-meta
```
