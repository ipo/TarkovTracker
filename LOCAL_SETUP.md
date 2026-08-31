# Local setup (no account)

This fork can be run on the LAN host in local-storage mode. You do not need a
Supabase project, account, or login to open tasks and maps.

## Prerequisites

- Node.js >= 24.19.0
- Corepack (ships with Node; used to pin `pnpm@11.14.0`)
- Network access to `json.tarkov.dev` and `assets.tarkov.dev` for game data
  and map SVGs (this setup does not mirror those assets)

## Steps

From a fresh clone of this repository:

```bash
corepack enable
cp .env.example.local .env
pnpm install
pnpm run dev
```

Then open [http://localhost:3000](http://localhost:3000). Task and hideout
progress persist in the browser `localStorage`. Auth, sync, realtime, and
team features stay disabled until you replace the dummy public Supabase
values in `.env` with a real project.

To bind the dev server on the LAN instead of localhost only:

```bash
pnpm run dev -- --host 0.0.0.0
```

From another device on the same LAN, replace `localhost` with the host's LAN
IP address.

## Maps check

With the dev server running, open
[http://localhost:3000/tasks?view=maps](http://localhost:3000/tasks?view=maps)
without signing in. The Maps tab can be selected while the map filter is still
**All**. **All does not display a map.** Click a specific map chip such as
**Ground Zero** before the SVG map and objective markers appear. Map artwork
is fetched from `https://assets.tarkov.dev/maps/svg/`.

## Local progress check

Still without an account, mark a task or objective complete, refresh the page,
and confirm the change remains. Guest progress is stored only in that
browser's `localStorage`. Clearing site data removes it.

## What `.env.example.local` is

`.env.example` documents the full production environment, including Stripe
and other services that are unused for local tracking.

`.env.example.local` is the committed dummy pair for the public Supabase
variables referenced by `nuxt.config.ts` and `app/utils/runtimeConfig.ts`:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Copy it to `.env` (gitignored). Leave both values empty. `resolveSupabaseRuntimeConfig()`
throws only when one of the two is set; an empty pair boots Nuxt and the
client plugin runs in offline mode.

Do not commit `.env`.
