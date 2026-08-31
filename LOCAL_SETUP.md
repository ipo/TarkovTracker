# Local setup without accounts

This setup runs TarkovTracker in guest mode. Progress stays in the browser's local storage; the
placeholder Supabase values do not connect to a project and cannot provide login, sync, realtime,
or team features.

## Requirements

- Node.js 24.19.0 or newer
- Internet access on the first load for packages and game data from `json.tarkov.dev`

## Start the app

From a fresh clone:

```bash
corepack enable
cp .env.example.local .env
pnpm install
pnpm dev --host 0.0.0.0
```

Open <http://localhost:3000/tasks?view=maps> on the development host. From another device on the
same LAN, replace `localhost` with the host's LAN IP address.

The map view selects the first available map after game data loads. The map panel should contain
an SVG-backed Leaflet map and objective markers. No login is required.

## Verify local progress

Mark a task or task objective complete, refresh the page, and confirm that the change remains.
Guest progress is stored only in that browser. Clearing site data removes it.

The Supabase values in `.env.example.local` are deliberately non-working placeholders. Replace
them with real project values only when testing account, sync, realtime, or team features.
