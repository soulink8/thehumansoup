/**
 * Profile Routes
 *
 * Get a creator's profile and content.
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { getCreatorById, getCreatorBySiteUrl, getContentByCreator } from "../services/graph";

const profile = new Hono<{ Bindings: Env }>();

/**
 * GET /profile/:id
 * Get a creator's full profile and recent content.
 */
profile.get("/profile/:id", async (c) => {
  const id = c.req.param("id");

  const creator = await getCreatorById(c.env.DB, id);
  if (!creator) {
    return c.json({ error: "Creator not found" }, 404);
  }

  const content = await getContentByCreator(c.env.DB, id, 20);

  return c.json({ creator, content });
});

/**
 * GET /profile/by-url
 * Look up a creator by their site URL.
 *
 * Query params:
 *   - url: the me3 site URL
 */
profile.get("/profile/by-url", async (c) => {
  const url = c.req.query("url");
  if (!url) {
    return c.json({ error: "url query parameter is required" }, 400);
  }

  const creator = await getCreatorBySiteUrl(c.env.DB, url);
  if (!creator) {
    return c.json({ error: "Creator not found" }, 404);
  }

  const content = await getContentByCreator(c.env.DB, creator.id, 20);

  return c.json({ creator, content });
});

export default profile;
