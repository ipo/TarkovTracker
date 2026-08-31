# Local setup without accounts

This setup runs TarkovTracker in guest mode. Progress stays in the browser's local storage; the
empty Supabase values enable offline mode, so login, sync, realtime, and team features are
unavailable.

## Requirements

- Node.js 24.19.0 or newer
- Corepack
- Network access for game data from `json.tarkov.dev` and map assets from `assets.tarkov.dev`

Map assets are not mirrored locally.

## Start the app

From a fresh clone:

```bash
corepack enable
cp .env.example.local .env
pnpm install
pnpm run dev
```

Open <http://localhost:3000/tasks?view=maps>. To make the server available to another device on the
same LAN, start it with the extra host argument:

```bash
pnpm run dev -- --host 0.0.0.0
```

Then replace `localhost` with the development host's LAN IP address.

After game data loads, select a specific map such as **Ground Zero**. The map panel should contain
an SVG-backed Leaflet map and objective markers. The default **All** filter does not display a map.
No login is required.

## Verify local progress

Mark a task or task objective complete, refresh the page, and confirm that the change remains.
Guest progress is stored only in that browser. Clearing site data removes it.

Keep both Supabase values empty for guest mode. A partial credential pair is invalid; set both to
real project values only when testing account, sync, realtime, or team features.
