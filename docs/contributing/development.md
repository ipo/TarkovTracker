# Development setup

Use Node.js >=24.19.0 and Corepack-managed pnpm 11.14.0.

```bash
corepack enable
pnpm install
pnpm run dev
```

The viewer uses bundled `/quest-data` fixtures by default. To use an external exporter directory,
copy `.env.example` to `.env` and set `NUXT_PUBLIC_STATIC_QUEST_DATA_BASE_URL`.

Follow [`../../AGENTS.md`](../../AGENTS.md) for coding conventions and validation. Add translation
keys only to `app/locales/en.json`, then run `pnpm run i18n:check`.
