/**
 * My Soup Routes
 *
 * Personalised feed for a handle, plus source metadata.
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { getCreatorByHandle, getFeed } from "../services/graph";
import { ensureSubscriptions, getDemoSourceSet } from "../services/sourceIndexer";
import { hashEmail } from "../lib/me3";

const mySoup = new Hono<{ Bindings: Env }>();

/**
 * GET /my-soup/:handle
 * Returns a personalised feed for a handle.
 */
mySoup.get("/my-soup/:handle", async (c) => {
  const handle = c.req.param("handle");
  const since = c.req.query("since");
  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  const contentType = c.req.query("type");

  const sourceSet = getDemoSourceSet(handle);
  let sources = sourceSet?.sources ?? [];
  if (sourceSet) {
    const creatorIds: string[] = [];
    const enriched: typeof sources = [];

    for (const source of sourceSet.sources) {
      const creator = await c.env.DB.prepare(
        "SELECT id, name FROM creators WHERE site_url = ?",
      )
        .bind(source.feedUrl)
        .first<{ id: string; name: string }>();
      if (creator?.id) creatorIds.push(creator.id);

      enriched.push({
        ...source,
        name: source.name ?? creator?.name,
      });
    }

    sources = enriched;

    if (creatorIds.length) {
      await ensureSubscriptions(c.env.DB, handle, creatorIds);
    }
  }

  const subscriberHash = await hashEmail(`handle:${handle}`);
  const feed = await getFeed(c.env.DB, handle, {
    since: since || undefined,
    limit: Math.min(limit, 200),
    contentType: contentType || undefined,
    subscriberEmailHash: subscriberHash,
  });

  const creator = await getCreatorByHandle(c.env.DB, handle);
  const displayName =
    creator?.name ?? sourceSet?.displayName ?? handle;

  return c.json({
    handle,
    displayName,
    items: feed.items,
    total: feed.total,
    since: feed.since,
    sources,
  });
});

export default mySoup;
