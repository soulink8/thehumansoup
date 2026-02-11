/**
 * Kitchen routes
 *
 * Authenticated write APIs for creator onboarding.
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { verifyJwt } from "../lib/crypto";
import {
  getSoupProfileByHandle,
  resolveSoupProfileInput,
  upsertSoupProfile,
  upsertSoupSources,
} from "../services/soupStore";
import { indexUserSources } from "../services/sourceIndexer";
import { indexSite } from "../services/indexer";

const kitchen = new Hono<{ Bindings: Env }>();

async function requireUser(c: { env: Env; req: { header: (name: string) => string | undefined } }) {
  const authHeader = c.req.header("authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return { ok: false, error: "Missing auth token" };
  }

  if (!c.env.JWT_SECRET) {
    return { ok: false, error: "JWT_SECRET is not configured" };
  }

  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload || typeof payload.sub !== "string") {
    return { ok: false, error: "Invalid token" };
  }

  return {
    ok: true,
    userId: payload.sub as string,
    email: typeof payload.email === "string" ? payload.email : null,
    me3SiteUrl: typeof payload.me3SiteUrl === "string" ? payload.me3SiteUrl : null,
  };
}

/**
 * POST /kitchen/submit
 * Body: { handle?, displayName?, me3SiteUrl?, sources?[] }
 */
kitchen.post("/kitchen/submit", async (c) => {
  const auth = await requireUser(c);
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
  };

  try {
    body = await c.req.json<typeof body>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  try {
    if (auth.me3SiteUrl && body.me3SiteUrl && auth.me3SiteUrl !== body.me3SiteUrl) {
      return c.json({ error: "ME3 site does not match authenticated user" }, 403);
    }

    const profileInput = await resolveSoupProfileInput({
      handle: body.handle,
      displayName: body.displayName,
      me3SiteUrl: body.me3SiteUrl ?? auth.me3SiteUrl ?? undefined,
      visibility: body.visibility,
    });

    const existing = await getSoupProfileByHandle(c.env.DB, profileInput.handle);
    if (existing?.owner_id && existing.owner_id !== auth.userId) {
      return c.json({ error: "Handle is already claimed" }, 409);
    }

    const profile = await upsertSoupProfile(c.env.DB, {
      ...profileInput,
      ownerId: auth.userId,
    });

    const sources = (body.sources ?? []).filter((source) => source.feedUrl);
    if (sources.length) {
      await upsertSoupSources(
        c.env.DB,
        profile.id,
        sources.map((source) => ({
          feedUrl: source.feedUrl,
          sourceType: source.sourceType,
          name: source.name ?? null,
          siteUrl: source.siteUrl ?? null,
          confidence: source.confidence ?? null,
        })),
        { addedBy: "user", addedVia: "web" },
      );
    }

    if (profile.me3_site_url) {
      await indexSite(c.env.DB, profile.me3_site_url);
    }

    await indexUserSources(c.env.DB, profile.handle, { limitPerFeed: 20 });

    return c.json({
      status: "ok",
      handle: profile.handle,
      profile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save soup";
    return c.json({ error: message }, 400);
  }
});

export default kitchen;
