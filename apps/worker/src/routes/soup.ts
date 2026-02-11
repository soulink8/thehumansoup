/**
 * Soup Management Routes
 *
 * Unified write APIs for agents + wizard.
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { hashEmail } from "../lib/me3";
import {
  deleteSoupSource,
  listSoupSourcesByHandle,
  resolveSoupProfileInput,
  upsertSoupProfile,
  upsertSoupSources,
} from "../services/soupStore";
import { indexUserSources } from "../services/sourceIndexer";

const soup = new Hono<{ Bindings: Env }>();

function requireWriteKey(c: { env: Env; req: { header: (name: string) => string | undefined } }) {
  const required = c.env.SOUP_WRITE_KEY;
  if (!required) {
    return { ok: false, error: "SOUP_WRITE_KEY is not configured" };
  }
  const provided =
    c.req.header("x-soup-write-key") ??
    c.req.header("authorization")?.replace(/^Bearer\s+/i, "");
  if (!provided || provided !== required) {
    return { ok: false, error: "Invalid write key" };
  }
  return { ok: true };
}

/**
 * POST /soup/sources
 * Upsert soup profile + sources.
 */
soup.post("/soup/sources", async (c) => {
  const auth = requireWriteKey(c);
  if (!auth.ok) return c.json({ error: auth.error }, 401);

  let body: {
    handle?: string;
    displayName?: string;
    me3SiteUrl?: string;
    visibility?: "public" | "unlisted" | "private";
    sources?: Array<{
      feedUrl: string;
      sourceType: "video" | "audio" | "article";
      name?: string;
      siteUrl?: string;
      confidence?: number;
    }>;
    addedBy?: "agent" | "wizard" | "user";
    addedVia?: "mcp" | "web" | "api";
  };

  try {
    body = await c.req.json<typeof body>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    const profileInput = await resolveSoupProfileInput({
      handle: body.handle,
      displayName: body.displayName,
      me3SiteUrl: body.me3SiteUrl,
      visibility: body.visibility,
    });

    const profile = await upsertSoupProfile(c.env.DB, profileInput);
    const sources = (body.sources ?? []).filter((source) => source.feedUrl);
    const addedBy = body.addedBy ?? "user";
    const addedVia = body.addedVia ?? "api";

    const count = await upsertSoupSources(
      c.env.DB,
      profile.id,
      sources.map((source) => ({
        feedUrl: source.feedUrl,
        sourceType: source.sourceType,
        name: source.name ?? null,
        siteUrl: source.siteUrl ?? null,
        confidence: source.confidence ?? null,
      })),
      { addedBy, addedVia },
    );

    return c.json({
      status: "ok",
      handle: profile.handle,
      profile,
      sourcesAdded: count,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save soup";
    return c.json({ error: message }, 400);
  }
});

/**
 * DELETE /soup/sources
 * Remove a source from a soup.
 */
soup.delete("/soup/sources", async (c) => {
  const auth = requireWriteKey(c);
  if (!auth.ok) return c.json({ error: auth.error }, 401);

  let body: { handle?: string; feedUrl?: string };
  try {
    body = await c.req.json<typeof body>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.handle || !body.feedUrl) {
    return c.json({ error: "handle and feedUrl are required" }, 400);
  }

  const soupProfile = await listSoupSourcesByHandle(c.env.DB, body.handle);
  if (!soupProfile) {
    return c.json({ error: "Soup profile not found" }, 404);
  }

  await deleteSoupSource(c.env.DB, soupProfile.profile.id, body.feedUrl);

  const creator = await c.env.DB.prepare(
    "SELECT id FROM creators WHERE site_url = ?",
  )
    .bind(body.feedUrl)
    .first<{ id: string }>();

  if (creator?.id) {
    const subscriber = await c.env.DB
      .prepare("SELECT id FROM creators WHERE handle = ?")
      .bind(body.handle)
      .first<{ id: string }>();
    const subscriberId = subscriber?.id ?? null;
    const subscriberHash = await hashEmail(`handle:${body.handle}`);

    await c.env.DB
      .prepare(
        `UPDATE subscriptions
         SET unsubscribed_at = datetime('now')
         WHERE creator_id = ?
           AND (subscriber_id = ? OR subscriber_email_hash = ?)`,
      )
      .bind(creator.id, subscriberId, subscriberHash)
      .run();
  }

  return c.json({ status: "ok" });
});

/**
 * POST /soup/ingest
 * Index sources for a handle.
 */
soup.post("/soup/ingest", async (c) => {
  const auth = requireWriteKey(c);
  if (!auth.ok) return c.json({ error: auth.error }, 401);

  let body: { handle?: string };
  try {
    body = await c.req.json<typeof body>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  if (!body.handle) {
    return c.json({ error: "handle is required" }, 400);
  }

  const result = await indexUserSources(c.env.DB, body.handle, {
    limitPerFeed: 20,
  });

  return c.json({
    status: "ok",
    handle: result.handle,
    feedsIndexed: result.feedsIndexed,
    itemsIndexed: result.itemsIndexed,
  });
});

export default soup;
