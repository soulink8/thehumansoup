/**
 * Health & Stats Routes
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { getStats } from "../services/graph";

const health = new Hono<{ Bindings: Env }>();

/**
 * GET /health
 * Basic health check.
 */
health.get("/health", (c) => {
  return c.json({
    status: "ok",
    service: "thehumansoup",
    version: "0.1.0",
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /stats
 * Aggregate stats about the soup.
 */
health.get("/stats", async (c) => {
  const stats = await getStats(c.env.DB);
  return c.json(stats);
});

export default health;
