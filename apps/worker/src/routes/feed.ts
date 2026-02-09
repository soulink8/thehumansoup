/**
 * Feed Routes
 *
 * Personalised feed for a subscriber based on their subscription graph.
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { getFeed } from "../services/graph";

const feed = new Hono<{ Bindings: Env }>();

/**
 * GET /feed/:subscriberId
 * Get content from creators the subscriber follows.
 *
 * The subscriberId can be either:
 *   - A creator ID (if the subscriber is also a me3 creator)
 *   - A hashed email (for anonymous subscribers)
 *
 * Query params:
 *   - since: ISO date - content since last check
 *   - limit: max results (default 50)
 */
feed.get("/feed/:subscriberId", async (c) => {
  const subscriberId = c.req.param("subscriberId");
  const since = c.req.query("since");
  const limit = parseInt(c.req.query("limit") ?? "50", 10);

  const result = await getFeed(c.env.DB, subscriberId, {
    since: since || undefined,
    limit: Math.min(limit, 200),
  });

  return c.json(result);
});

export default feed;
