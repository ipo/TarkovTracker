# Static data interface

TarkovTracker exposes no application API. The viewer reads three public schema-v1 JSON documents
from `NUXT_PUBLIC_STATIC_QUEST_DATA_BASE_URL`:

- `tasks.pvp.json` or `tasks.pve.json`
- `state.pvp.json` or `state.pve.json`
- `scores.pvp.json` or `scores.pve.json`

The default base is `/quest-data`. The selected internal `seasonal` mode uses the `pvp` documents.
All files in a selected bundle must identify the same file mode and schema version 1.
