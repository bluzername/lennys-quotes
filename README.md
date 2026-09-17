<div align="center">

# Lenny's Podcast Wisdom

**MCP server for AI-powered product management insights**

[![npm version](https://img.shields.io/npm/v/lennys-podcast-wisdom.svg)](https://www.npmjs.com/package/lennys-podcast-wisdom)
[![episodes](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fbluzername%2Flennys-quotes%2Fmain%2Fdata%2Fstatus.json&query=%24.episodes&label=episodes&color=blue)](data/status.json)
[![newest episode](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fbluzername%2Flennys-quotes%2Fmain%2Fdata%2Fstatus.json&query=%24.newestPublishDate&label=newest&color=blue)](data/status.json)
[![sync](https://github.com/bluzername/lennys-quotes/actions/workflows/sync.yml/badge.svg)](https://github.com/bluzername/lennys-quotes/actions/workflows/sync.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

*Query every episode of [Lenny's Podcast](https://www.lennysnewsletter.com/podcast) from Claude Code, Cursor, or any MCP client.*

> **Credit:** built on the content of [Lenny Rachitsky's Podcast](https://www.lennysnewsletter.com/podcast), the #1 podcast for product people. Transcripts are the official ones Lenny publishes. Subscribe to support his work.

![Demo](demo.gif)

</div>

---

## Why

Lenny's Podcast is a goldmine of product wisdom from leaders at Airbnb, Stripe, Netflix, OpenAI, Anthropic and more. This server makes all of it searchable by your AI assistant while you write PRDs, plan roadmaps, or make product calls.

**No API keys. No LLM costs. Runs locally. Updates itself every week.**

## Installation

Requires Node 22.13 or newer.

```bash
claude mcp add lennys-wisdom -- npx -y lennys-podcast-wisdom@latest
```

Or install globally:

```bash
npm install -g lennys-podcast-wisdom
claude mcp add lennys-wisdom -- lennys-wisdom
```

For Cursor or other clients, add a stdio server with command `npx` and args `-y lennys-podcast-wisdom@latest`.

The first start downloads the transcript database (about 22 MB) into `~/.cache/lennys-wisdom/`. Later starts are instant.

## Usage

Ask naturally:

```
"Search Lenny's podcast for advice on product-market fit"
"What does Brian Chesky say about design?"
"What are the newest episodes?"
"Give me random wisdom about leadership"
```

## Tools

| Tool | What it does |
|------|--------------|
| `search_quotes` | BM25 full-text search over every transcript segment. Supports `"exact phrases"` and a guest filter. Returns speaker, episode, date and a YouTube link to the exact second. |
| `search_quotes_smart` | Three-step search for nuanced topics: the model expands the query, reviews candidates, and gets the final picks. |
| `list_guests` | Browse episodes by name, views, or date (newest first). |
| `get_episode` | Episode details by guest, title, slug or video id, optionally with the full transcript. |
| `random_wisdom` | A random substantive guest quote, optionally on a topic. |
| `data_status` | Episode count, newest episode, and when the data was built. |

## How it stays current

```
Lenny's Dropbox (official transcripts)  +  YouTube RSS / yt-dlp (metadata)
                    |
        weekly GitHub Action: npm run sync
                    |
        episodes/{slug}/transcript.md  (committed, diffable)
                    |
        npm run build:db  ->  SQLite + FTS5  ->  GitHub release "data"
                    |
        your server checks for a newer database once a day and swaps it in
```

- New episodes land in the repo every Monday without a code release.
- Installed servers refresh their local database in the background; no reinstall needed.
- Code releases (npm) and data releases are independent, so `npx ...@latest` is never blocked on transcripts.

Environment variables:

| Variable | Effect |
|----------|--------|
| `LENNYS_DB` | Use this database file and never download. |
| `LENNYS_OFFLINE=1` | Never touch the network; fails if nothing is cached. |
| `LENNYS_REFRESH_HOURS` | How often to check for new data (default 24). |
| `LENNYS_DATA_URL` | Alternative download URL for the gzipped database. |

## Development

```bash
npm install
npm test                 # unit tests (node:test)
npm run build:db         # episodes/ -> data/lennys.db
npm run smoke            # spawn the server over stdio and exercise every tool
npm run sync -- --dry-run
```

To run the server from source against a local database: `LENNYS_DB=data/lennys.db npm run dev`.

## Data source

Transcript text is Lenny's own public Dropbox folder of episode transcripts. Metadata comes from the YouTube channel. The initial archive was seeded from [ChatPRD/lennys-podcast-transcripts](https://github.com/ChatPRD/lennys-podcast-transcripts) and the matching logic was adapted from [sdmurff's sync script](https://github.com/sdmurff/lennys-podcast-transcripts). Thanks to both.

## License

MIT for the code. Transcript content belongs to Lenny Rachitsky and is redistributed for personal and research use; please credit the podcast.
