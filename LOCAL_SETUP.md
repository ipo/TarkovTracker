# Local setup

## Prerequisites

- Node.js >= 24.19.0
- Corepack

## Run locally

```bash
corepack enable
pnpm install
pnpm run dev
```

Open [http://localhost:8046](http://localhost:8046). The bundled fixtures load from
`/quest-data`; task and objective progress persists in that browser's `localStorage`.

To use an exporter directory hosted elsewhere, optionally copy `.env.example` to `.env` and set
`NUXT_PUBLIC_STATIC_QUEST_DATA_BASE_URL` to its relative path or HTTP(S) URL. Do not commit `.env`.

For LAN access, run `pnpm run dev -- --host 0.0.0.0` and open the host's LAN address.

## Maps check

Open [http://localhost:8046/tasks?view=maps](http://localhost:8046/tasks?view=maps), choose a
specific map, and verify its SVG and objective markers render. The **All** map filter intentionally
does not select a map.
