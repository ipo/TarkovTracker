# Production Runbook

## Configuration

- `APP_URL` sets the canonical public application URL.
- `NUXT_PUBLIC_STATIC_QUEST_DATA_BASE_URL` optionally points the static viewer at an exporter
  directory. It defaults to `/quest-data`.

## Pre-deploy validation

1. `pnpm run format:check`
2. `pnpm run lint`
3. `pnpm run typecheck`
4. `pnpm run test`
5. `pnpm run build`
6. `pnpm audit --prod`

## Deployment

Merging to `main` runs the repository CI and publishes the generated static SPA through the
configured static-hosting integration. Verify the build, then open `/` and `/tasks?view=maps`.

## Incident triage

1. Check the static-hosting build and deployment logs.
2. Verify the deployed `quest-data` documents are present and match the selected game mode.
3. Confirm `NUXT_PUBLIC_STATIC_QUEST_DATA_BASE_URL` points at the intended exporter directory when
   it is configured.
