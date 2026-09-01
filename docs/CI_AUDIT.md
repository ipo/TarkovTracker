# CI and integration audit

CI validates the static viewer with Fallow, formatting, linting, type checks, four Vitest coverage
shards, and a production build. Security, PR metadata, releases, dependency updates, and stale-item
automation run in separate workflows.

Keep the checks focused on the SPA and static exporter contract. Periodically review external review
and scanning integrations for distinct findings and remove overlapping services that add no signal.
