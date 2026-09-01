# Static quest-data architecture

The viewer consumes exporter-generated schema-v1 task, state, and score documents directly. The
client validates a complete matching bundle before applying it and persists only local user progress.
This keeps deployments static and makes the exported state document the authority for visible tasks
and map markers.
