/**
 * My Soup Routes
 *
 * Personalised feed for a soup (by name), plus source metadata.
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { getCreatorByHandle, getFeed } from "../services/graph";
import { ensureSubscriptions, getDemoSourceSet } from "../services/sourceIndexer";
import { hashEmail } from "../lib/me3";
import { listSoupSourcesByHandle } from "../services/soupStore";

const mySoup = new Hono<{ Bindings: Env }>();

/**
 * GET /my-soup/:name
 * Returns a personalised feed for a soup.
 */
mySoup.get("/my-soup/:name", async (c) => {
  const name = c.req.param("name").trim().replace(/^@+/, "").toLowerCase();
  const since = c.req.query("since");
  const limit = parseInt(c.req.query("limit") ?? "50", 10);
  const contentType = c.req.query("type");

  let sources: Array<{
    feedUrl: string;
    type: string;
    name?: string;
    siteUrl?: string;
    addedBy?: string;
    addedVia?: string;
  }> = [];

  const soup = await listSoupSourcesByHandle(c.env.DB, name);
  const demoSourceSet = name === "demo" ? getDemoSourceSet("demo") : null;

  if (!soup && !demoSourceSet) {
    return c.json({ error: "Soup not found" }, 404);
  }

  if (soup?.profile?.visibility === "private") {
    return c.json({ error: "Soup is private" }, 403);
  }

  if (soup?.sources?.length) {
    sources = soup.sources.map((source) => ({
      feedUrl: source.feedUrl,
      type: source.sourceType,
      name: source.name ?? undefined,
      siteUrl: source.siteUrl ?? undefined,
      addedBy: source.addedBy,
      addedVia: source.addedVia,
    }));
  } else {
    sources = demoSourceSet?.sources ?? [];
  }

  if (sources.length) {
    const creatorIds: string[] = [];

    for (const source of sources) {
      const creator = await c.env.DB.prepare(
        "SELECT id, name FROM creators WHERE site_url = ?",
      )
        .bind(source.feedUrl)
        .first<{ id: string; name: string }>();
      if (creator?.id) creatorIds.push(creator.id);
      if (!source.name && creator?.name) {
        source.name = creator.name;
      }
    }

    if (creatorIds.length) {
      await ensureSubscriptions(c.env.DB, name, creatorIds);
    }
  }

  const creator = await getCreatorByHandle(c.env.DB, name);
  const subscriberId = creator?.id ?? name;
  const subscriberHash = await hashEmail(`handle:${name}`);
  const feed = await getFeed(c.env.DB, subscriberId, {
    since: since || undefined,
    limit: Math.min(limit, 200),
    contentType: contentType || undefined,
    subscriberEmailHash: subscriberHash,
  });
  const displayName =
    creator?.name ?? soup?.profile?.display_name ?? demoSourceSet?.displayName ?? name;

  return c.json({
    name,
    displayName,
    items: feed.items,
    total: feed.total,
    since: feed.since,
    sources,
  });
});

export default mySoup;
