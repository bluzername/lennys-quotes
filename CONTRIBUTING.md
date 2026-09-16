# Contributing

## Setup

```bash
git clone https://github.com/bluzername/lennys-quotes.git
cd lennys-quotes
npm install
npm test
npm run build:db
npm run smoke
```

## Layout

- `src/index.ts` - entry point: resolves the database, starts the stdio server
- `src/server.ts` - registers the MCP tools
- `src/tools/` - one file per tool
- `src/db/` - SQLite schema, builder, FTS query builder, queries
- `src/data/` - cache location, download with ETag, refresh policy
- `src/ingest/` - transcript parsing, Dropbox and YouTube fetching, name matching
- `src/cli/sync.ts` - weekly ingestion; `src/cli/build-db.ts` - database build
- `episodes/` - one folder per episode with `transcript.md` (YAML frontmatter + body)
- `tests/` - `node:test` unit tests and the stdio smoke test

## Adding or fixing an episode

Episodes are synced automatically every Monday. If an episode is missing or mismatched:

1. Run `npm run sync -- --dry-run` to see what the matcher would do.
2. If the YouTube title omits the guest name, add the video id to `VIDEO_OVERRIDES` in `src/ingest/match.ts`.
3. Run `npm run sync` and `npm run build:db`, then `npm test`.

## Releasing

- Data: automatic, weekly, via the `sync` workflow. Trigger it manually from the Actions tab if needed.
- Code: bump `version` in `package.json`, tag `vX.Y.Z`, push the tag. The `publish` workflow publishes to npm.
