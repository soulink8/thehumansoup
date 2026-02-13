# The Human Soup

An AI-traversable content index for any site with a [me.json](https://me3.app/protocol).

The Human Soup aggregates `me.json` profiles and content from me3 sites into a structured content graph that AI agents can swim through to discover creators, content, and subscription relationships on behalf of their humans.

## Direction (Agent-First Index)

The Human Soup is evolving toward an agent-first index, where retrieval quality is measured by whether an agent can answer real questions with trustworthy citations.

- `me3` remains the long-term source of truth for direct, sovereign publishing.
- External platforms (YouTube, Substack, podcasts, RSS) are useful adapters for early corpus density.
- The index should prioritize structured signals over raw content blobs.

### Important Boundary

This repo uses `bd`/Beads for software issue tracking. That is separate from index architecture.

- `bd` = coding task and workflow management.
- Human Soup indexing model = content ingestion, normalization, trust, and retrieval.

## Architecture

```
me3 Sites (me.json) ──→ Indexer ──→ Content Graph (D1) ──→ REST API + MCP Server ──→ AI Agents (PAIs)
```

**Sites are sovereign.** The soup indexes references, never stores full content. The `me.json` on each site is the source of truth.

## Signal Record v1 (Index Unit)

To keep the first validation loop simple, each indexed item should produce a compact `Signal Record` for agents:

- `claim`: Main idea in one sentence.
- `why_it_matters`: Why this is useful in one sentence.
- `source_url`: Canonical source URL.
- `published_at`: ISO date/time when available.
- `content_type`: `article|note|video|audio|image|link`.
- `trust_level`: `high|med|low`.

This aligns with current `me3` protocol fields such as `posts.type`, `publishedAt`, and `excerpt`, while staying compatible with external source adapters.

## First Validation Loop (20/10 Test)

Before adding architectural complexity, run a lightweight quality test:

1. Select 20 indexed items.
2. Create one `Signal Record v1` per item.
3. Ask 10 real user questions the index should answer.
4. Score each answer for `useful` (`yes|no`).
5. Score each answer for `cited` (`yes|no`).
6. Score each answer for `trustworthy` (`yes|no`).
7. Improve the record format once, then retest.

Success criteria for v1:

- >= 70% useful answers.
- >= 90% cited answers.
- Low-trust sources do not dominate outputs.
- Responses support decisions, not just summaries.

Detailed runbook: `docs/signal-record-v1-test.md`.
Question bank: `docs/signal-record-v1-questions.md`.
Scorecard template: `docs/signal-record-v1-scorecard.csv`.

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

| Endpoint                                              | Description               |
| ----------------------------------------------------- | ------------------------- |
| `GET /health`                                         | Health check              |
| `GET /stats`                                          | Aggregate soup stats      |
| `GET /discover/creators?topic=ai`                     | Find creators by topic    |
| `GET /discover/content?type=article&since=2026-01-01` | Find content              |
| `GET /discover/trending?days=7`                       | Trending content          |
| `GET /profile/:id`                                    | Creator profile + content |
| `GET /feed/:subscriberId`                             | Personalised feed         |
| `POST /ingest/register`                               | Register a me3 site       |
| `POST /ingest/ping`                                   | Notify of new content     |
| `POST /ingest/subscribe`                              | Register a subscription   |
| `POST /mcp`                                           | MCP JSON-RPC endpoint     |

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
