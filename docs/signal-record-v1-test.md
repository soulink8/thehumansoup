# Signal Record v1 Test

Use this small test to validate retrieval quality before adding more indexing complexity.

## Goal

Test whether agents can answer real questions from structured records with citations and trust awareness.

## Automated Run

Run the evaluation pipeline:

```bash
pnpm eval:signal-record-v1
```

Optional transcript input (JSONL with `source_url` + `transcript`):

```bash
pnpm eval:signal-record-v1 -- --transcripts docs/test-data/youtube-transcripts.jsonl
```

Example format:

- `docs/test-data/youtube-transcripts.example.jsonl`

Outputs are written to:

- `docs/test-data/results/signal-record-v1-eval-report-latest.json`
- `docs/test-data/results/signal-record-v1-scorecard-auto-latest.csv`

## Dataset

- Sample size: 20 indexed items
- Suggested mix:
  - 10 me3-native items
  - 10 external adapter items (RSS/YouTube/Substack/Podcast)

Candidate pull query (from current schema):

```sql
SELECT
  id,
  creator_id,
  COALESCE(content_url, file_path) AS source_url,
  content_type,
  published_at,
  title,
  excerpt
FROM content
ORDER BY COALESCE(published_at, indexed_at) DESC
LIMIT 20;
```

Starter batch in this repo:

- `docs/test-data/signal-record-v1-batch-001.jsonl`

## Signal Record v1 Template

```json
{
  "id": "signal-001",
  "creator_id": "creator-123",
  "source_url": "https://example.com/post",
  "content_type": "article",
  "published_at": "2026-02-10T09:00:00Z",
  "claim": "One-sentence core claim.",
  "why_it_matters": "One-sentence practical implication.",
  "trust_level": "med"
}
```

## Question Set

Create 10 real questions you care about. Keep them practical and decision-oriented.

Starter question bank:

- `docs/signal-record-v1-questions.md`

Example prompts:

1. What are the strongest arguments for and against X this month?
2. Which creators are most consistent on topic Y?
3. What changed recently in area Z that should affect my plan?

## Scoring

Score each answer with `yes` or `no`:

- `useful`: Helped with a real decision.
- `cited`: Included source links.
- `trustworthy`: Used trustworthy signals or clearly handled uncertainty.

Use this score sheet:

- `docs/signal-record-v1-scorecard.csv`

You can still use the manual score sheet for human override, but `eval:signal-record-v1` now generates an automated scorecard for repeatable baseline checks.

## Pass Threshold (v1)

- `useful` >= 7/10
- `cited` >= 9/10
- `trustworthy` >= 8/10

If the run fails thresholds, improve only record structure first, then rerun with the same questions.
