/**
 * Subscription Registry Routes
 *
 * Manage and query subscription relationships.
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { getCreatorById } from "../services/graph";

const registry = new Hono<{ Bindings: Env }>();

/**
 * GET /subscriptions/:subscriberId
 * Get all creators a subscriber follows.
 */
registry.get("/subscriptions/:subscriberId", async (c) => {
  const subscriberId = c.req.param("subscriberId");

  const result = await c.env.DB.prepare(
    `SELECT cr.* FROM creators cr
     JOIN subscriptions s ON s.creator_id = cr.id
     WHERE (s.subscriber_id = ? OR s.subscriber_email_hash = ?)
       AND s.unsubscribed_at IS NULL
     ORDER BY s.subscribed_at DESC`
  )
    .bind(subscriberId, subscriberId)
    .all();

  return c.json({
    subscriptions: result.results ?? [],
    count: result.results?.length ?? 0,
  });
});

/**
 * GET /subscribers/:creatorId
 * Get subscriber count for a creator.
 * Only returns count (not identities) unless creator has subscriberListVisible enabled.
 */
registry.get("/subscribers/:creatorId", async (c) => {
  const creatorId = c.req.param("creatorId");

  const creator = await getCreatorById(c.env.DB, creatorId);
  if (!creator) {
    return c.json({ error: "Creator not found" }, 404);
  }

  const count = await c.env.DB.prepare(
    "SELECT COUNT(*) as count FROM subscriptions WHERE creator_id = ? AND unsubscribed_at IS NULL"
  )
    .bind(creatorId)
    .first<{ count: number }>();

  return c.json({
    creatorId,
    subscriberCount: count?.count ?? 0,
  });
});

export default registry;
