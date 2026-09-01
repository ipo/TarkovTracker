# TarkovTracker

TarkovTracker is a static Escape from Tarkov task planner with local progress and interactive maps.
It loads exporter JSON directly and keeps progress in the browser.

## Local development

```bash
corepack enable
pnpm install
pnpm run dev
```

The development server listens on [http://localhost:8046](http://localhost:8046) by default.

The bundled `/quest-data` fixtures are the default. To load an external exporter directory, copy
`.env.example` to `.env` and set `NUXT_PUBLIC_STATIC_QUEST_DATA_BASE_URL`.

## Commands

| Task      | Command              |
| --------- | -------------------- |
| Build     | `pnpm run build`     |
| Lint      | `pnpm run lint`      |
| Typecheck | `pnpm run typecheck` |
| Tests     | `pnpm run test`      |

See [`LOCAL_SETUP.md`](LOCAL_SETUP.md) for local use, [`docs/SYSTEMS.md`](docs/SYSTEMS.md) for
hydration invariants, and [`AGENTS.md`](AGENTS.md) for contribution conventions.

## License

GNU General Public License v3.0 — see [`LICENSE.md`](LICENSE.md).
