/**
 * Discovery Routes
 *
 * Find creators and content in the soup.
 * This is the primary browsing/search interface.
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import {
  getCreators,
  getContent,
  getTrending,
} from "../services/graph";
import { discoverSources } from "../services/discovery";

const discover = new Hono<{ Bindings: Env }>();

/**
 * GET /discover/creators
 * Find creators by topic, ordered by trust score.
 *
 * Query params:
 *   - topic: filter by topic
 *   - order: "trust" | "recent" | "posts"
 *   - limit: max results (default 20)
 *   - offset: pagination offset
 */
discover.get("/discover/creators", async (c) => {
  const topic = c.req.query("topic");
  const orderBy = (c.req.query("order") ?? "trust") as
    | "trust"
    | "recent"
    | "posts";
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const creators = await getCreators(c.env.DB, {
    topic: topic || undefined,
    orderBy,
    limit: Math.min(limit, 100),
    offset,
  });

  return c.json({ creators, count: creators.length });
});

/**
 * GET /discover/content
 * Find content by topic, type, or recency.
 *
 * Query params:
 *   - topic: filter by topic
 *   - type: content type filter (article, note, video, etc.)
 *   - since: ISO date - only content after this date
 *   - limit: max results (default 20)
 *   - offset: pagination offset
 */
discover.get("/discover/content", async (c) => {
  const topic = c.req.query("topic");
  const contentType = c.req.query("type");
  const since = c.req.query("since");
  const limit = parseInt(c.req.query("limit") ?? "20", 10);
  const offset = parseInt(c.req.query("offset") ?? "0", 10);

  const content = await getContent(c.env.DB, {
    topic: topic || undefined,
    contentType: contentType || undefined,
    since: since || undefined,
    limit: Math.min(limit, 100),
    offset,
  });

  return c.json({ content, count: content.length });
});

/**
 * GET /discover/trending
 * Trending content from high-trust creators.
 *
 * Query params:
 *   - days: lookback period (default 7)
 *   - limit: max results (default 20)
 */
discover.get("/discover/trending", async (c) => {
  const days = parseInt(c.req.query("days") ?? "7", 10);
  const limit = parseInt(c.req.query("limit") ?? "20", 10);

  const content = await getTrending(c.env.DB, {
    days: Math.min(days, 30),
    limit: Math.min(limit, 100),
  });

  return c.json({ content, count: content.length });
});

/**
 * GET /discover/sources
 * Discover potential RSS sources by name.
 *
 * Query params:
 *   - q: search query
 */
discover.get("/discover/sources", async (c) => {
  const query = c.req.query("q");
  if (!query) {
    return c.json({ error: "q query parameter is required" }, 400);
  }

  try {
    const candidates = await discoverSources(query, c.env.BRAVE_SEARCH_API_KEY);
    return c.json({ query, candidates });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Discovery failed";
    return c.json({ error: message }, 500);
  }
});

export default discover;
