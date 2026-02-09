/**
 * Ingest Routes
 *
 * Webhooks for me3 sites to push events to the soup.
 * - POST /ingest/ping: notify the soup of new content
 * - POST /ingest/subscribe: register a subscription relationship
 */

import { Hono } from "hono";
import type { Env, PingPayload, SubscribePayload } from "../lib/types";
import { normalizeUrl, uuid, hashEmail } from "../lib/me3";
import { indexSite } from "../services/indexer";

const ingest = new Hono<{ Bindings: Env }>();

/**
 * POST /ingest/ping
 * Called by me3 sites when they publish new content.
 * Triggers a re-index of the site.
 */
ingest.post("/ingest/ping", async (c) => {
  let body: PingPayload;
  try {
    body = await c.req.json<PingPayload>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.site_url) {
    return c.json({ error: "site_url is required" }, 400);
  }

  const siteUrl = normalizeUrl(body.site_url);

  // Index the site (will skip if unchanged via hash comparison)
  const result = await indexSite(c.env.DB, siteUrl);

  return c.json({
    status: result.status,
    postsFound: result.postsFound,
    postsNew: result.postsNew,
    postsUpdated: result.postsUpdated,
    durationMs: result.durationMs,
  });
});

/**
 * POST /ingest/subscribe
 * Register a subscription relationship from a me3 site.
 * Called when a human subscribes to a creator's newsletter.
 */
ingest.post("/ingest/subscribe", async (c) => {
  let body: SubscribePayload;
  try {
    body = await c.req.json<SubscribePayload>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.creator_site_url) {
    return c.json({ error: "creator_site_url is required" }, 400);
  }

  const creatorSiteUrl = normalizeUrl(body.creator_site_url);

  // Find the creator
  const creator = await c.env.DB.prepare(
    "SELECT id FROM creators WHERE site_url = ?",
  )
    .bind(creatorSiteUrl)
    .first<{ id: string }>();

  if (!creator) {
    return c.json({ error: "Creator not found in the soup" }, 404);
  }

  // Resolve subscriber identity
  let subscriberId: string | null = null;
  let subscriberEmailHash: string | null = null;

  if (body.subscriber_site_url) {
    // Subscriber is a known me3 creator
    const subscriber = await c.env.DB.prepare(
      "SELECT id FROM creators WHERE site_url = ?",
    )
      .bind(normalizeUrl(body.subscriber_site_url))
      .first<{ id: string }>();
    subscriberId = subscriber?.id ?? null;
  }

  if (body.subscriber_email_hash) {
    subscriberEmailHash = body.subscriber_email_hash;
  }

  if (!subscriberId && !subscriberEmailHash) {
    return c.json(
      {
        error:
          "Either subscriber_email_hash or subscriber_site_url is required",
      },
      400,
    );
  }

  // Upsert subscription
  await c.env.DB.prepare(
    `INSERT INTO subscriptions (id, subscriber_id, subscriber_email_hash, creator_id, source)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(subscriber_email_hash, creator_id) DO UPDATE SET
       subscriber_id = COALESCE(excluded.subscriber_id, subscriptions.subscriber_id),
       unsubscribed_at = NULL`,
  )
    .bind(
      uuid(),
      subscriberId,
      subscriberEmailHash,
      creator.id,
      body.source ?? "newsletter_block",
    )
    .run();

  return c.json({ status: "ok", creatorId: creator.id });
});

/**
 * POST /ingest/register
 * Register a new me3 site with the soup.
 * This is how a site opts in to being indexed.
 */
ingest.post("/ingest/register", async (c) => {
  let body: { site_url: string };
  try {
    body = await c.req.json<{ site_url: string }>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.site_url) {
    return c.json({ error: "site_url is required" }, 400);
  }

  const siteUrl = normalizeUrl(body.site_url);

  // Immediately index the site
  const result = await indexSite(c.env.DB, siteUrl);

  if (result.status === "failed") {
    return c.json(
      {
        error: "Failed to index site",
        detail: result.error,
      },
      422,
    );
  }

  return c.json({
    status: "registered",
    siteUrl,
    postsFound: result.postsFound,
  });
});

export default ingest;
