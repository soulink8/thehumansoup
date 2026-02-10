# The Human Soup

An AI-traversable content index for the [me3](https://me3.app) ecosystem.

The Human Soup aggregates `me.json` profiles and content from me3 sites into a structured content graph that AI agents can swim through to discover creators, content, and subscription relationships on behalf of their humans.

## Architecture

```
me3 Sites (me.json) ──→ Indexer ──→ Content Graph (D1) ──→ REST API + MCP Server ──→ AI Agents (PAIs)
```

**Sites are sovereign.** The soup indexes references, never stores full content. The `me.json` on each site is the source of truth.

## Quick Start

```bash
# Install dependencies
pnpm install

# Create local D1 database and apply schema
pnpm --filter @soup/worker db:migrate:local

# Start dev server
pnpm dev

# Register a me3 site
curl -X POST http://localhost:8787/ingest/register \
  -H "Content-Type: application/json" \
  -d '{"site_url": "https://kieran.me3.app"}'
```

## Web UI (Cloudflare Pages)

The UI lives in `apps/web` (Vue + Vite). Recommended Cloudflare Pages settings:

- **Build command**: `pnpm --filter @soup/web build`
- **Build output directory**: `apps/web/dist`

Environment variables (Preview + Production):

- `VITE_SOUP_API_URL=https://thehumansoup-worker.kieranbutler.workers.dev`
- `PNPM_VERSION=9.0.0` (optional)
- `NODE_VERSION=20` (optional)

Local dev:

```bash
pnpm --filter @soup/web dev
```

## API

| Endpoint | Description |
|----------|-------------|
| `GET /health` | Health check |
| `GET /stats` | Aggregate soup stats |
| `GET /discover/creators?topic=ai` | Find creators by topic |
| `GET /discover/content?type=article&since=2026-01-01` | Find content |
| `GET /discover/trending?days=7` | Trending content |
| `GET /profile/:id` | Creator profile + content |
| `GET /feed/:subscriberId` | Personalised feed |
| `POST /ingest/register` | Register a me3 site |
| `POST /ingest/ping` | Notify of new content |
| `POST /ingest/subscribe` | Register a subscription |
| `POST /mcp` | MCP JSON-RPC endpoint |

## MCP Tools

AI agents connect via the Model Context Protocol:

- **soup_discover** - Find creators and content by topic, format, or recency
- **soup_feed** - Get personalised feed based on subscription graph
- **soup_profile** - Get a creator's profile and recent content
- **soup_trending** - Trending content from trusted creators
- **soup_stats** - Aggregate soup statistics

## Tech Stack

- **Runtime**: Cloudflare Workers
- **Database**: Cloudflare D1 (SQLite)
- **Framework**: Hono
- **Protocol**: me3-protocol
- **Scheduler**: Cloudflare Cron Triggers

## Project Structure

```
thehumansoup/
  apps/worker/
    src/
      index.ts          # Hono app + cron handler
      db/schema.sql     # D1 schema
      routes/            # REST API endpoints
      services/          # Indexer, graph queries, trust, classifier
      mcp/               # MCP server + tool definitions
      lib/               # Types, me3 helpers
```

## License

Open source. Public good.
