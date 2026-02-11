/**
 * Owner Routes
 *
 * Resolve the soup owner from their me.json site URL.
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { getCreatorBySiteUrl } from "../services/graph";
import { indexSite } from "../services/indexer";
import { normalizeUrl } from "../lib/me3";

const owner = new Hono<{ Bindings: Env }>();

/**
 * GET /owner
 * Resolve the owner handle from SOUP_OWNER_SITE_URL.
 */
owner.get("/owner", async (c) => {
  const ownerSiteUrl = c.env.SOUP_OWNER_SITE_URL;
  if (!ownerSiteUrl) {
    return c.json({ error: "SOUP_OWNER_SITE_URL is not configured" }, 500);
  }

  const normalized = normalizeUrl(ownerSiteUrl);
  let creator = await getCreatorBySiteUrl(c.env.DB, normalized);

  if (!creator) {
    await indexSite(c.env.DB, normalized);
    creator = await getCreatorBySiteUrl(c.env.DB, normalized);
  }

  if (!creator) {
    return c.json({ error: "Owner not found" }, 404);
  }

  return c.json({
    handle: creator.handle,
    name: creator.name,
    siteUrl: creator.siteUrl,
  });
});

export default owner;
