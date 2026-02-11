/**
 * The Human Soup - Main Entry Point
 *
 * An AI-traversable content index for the me3 ecosystem.
 * Aggregates me.json profiles into a queryable content graph,
 * exposed via REST API and MCP server for AI agents.
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env } from "./lib/types";
import { indexAll } from "./services/indexer";

// Routes
import health from "./routes/health";
import discover from "./routes/discover";
import profile from "./routes/profile";
import feed from "./routes/feed";
import ingest from "./routes/ingest";
import registry from "./routes/registry";
import owner from "./routes/owner";
import mySoup from "./routes/mySoup";
import soup from "./routes/soup";
import mcp from "./mcp/server";

const app = new Hono<{ Bindings: Env }>();

// ── Middleware ──────────────────────────────────────────────

app.use("*", cors());
app.use("*", logger());

// ── Root ───────────────────────────────────────────────────

app.get("/", (c) => {
  return c.json({
    name: "thehumansoup",
    version: "0.1.0",
    description:
      "The Human Soup - An AI-traversable content index for the me3 ecosystem",
    docs: {
      health: "GET /health",
      stats: "GET /stats",
      discover_creators: "GET /discover/creators?topic=ai&order=trust",
      discover_content:
        "GET /discover/content?topic=ai&type=article&since=2026-01-01",
      trending: "GET /discover/trending?days=7",
      profile: "GET /profile/:id",
      feed: "GET /feed/:subscriberId?since=2026-01-01",
      owner: "GET /owner",
      my_soup: "GET /my-soup/:handle",
      soup_sources: "POST /soup/sources",
      soup_remove_source: "DELETE /soup/sources",
      soup_ingest: "POST /soup/ingest",
      ingest_sources: "POST /ingest/sources",
      ingest_ping: "POST /ingest/ping",
      ingest_register: "POST /ingest/register",
      ingest_subscribe: "POST /ingest/subscribe",
      subscriptions: "GET /subscriptions/:subscriberId",
      subscribers: "GET /subscribers/:creatorId",
      mcp: "POST /mcp (MCP JSON-RPC)",
    },
  });
});

// ── Mount Routes ───────────────────────────────────────────

app.route("/", health);
app.route("/", discover);
app.route("/", profile);
app.route("/", feed);
app.route("/", ingest);
app.route("/", registry);
app.route("/", owner);
app.route("/", mySoup);
app.route("/", soup);
app.route("/", mcp);

// ── Scheduled (Cron) Handler ───────────────────────────────

export default {
  fetch: app.fetch,

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext,
  ): Promise<void> {
    ctx.waitUntil(runIndexer(env));
  },
};

async function runIndexer(env: Env): Promise<void> {
  console.log("[soup] Starting scheduled index run...");
  const start = Date.now();

  try {
    const results = await indexAll(env.DB);
    const succeeded = results.filter((r) => r.status === "success").length;
    const unchanged = results.filter((r) => r.status === "unchanged").length;
    const failed = results.filter((r) => r.status === "failed").length;
    const totalNewPosts = results.reduce((sum, r) => sum + r.postsNew, 0);

    console.log(
      `[soup] Index complete in ${Date.now() - start}ms: ${succeeded} updated, ${unchanged} unchanged, ${failed} failed, ${totalNewPosts} new posts`,
    );
  } catch (error) {
    console.error("[soup] Index run failed:", error);
  }
}
