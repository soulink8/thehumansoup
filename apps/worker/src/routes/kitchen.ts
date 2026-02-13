/**
 * Kitchen routes
 *
 * Authenticated write APIs for creator onboarding.
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { requireUser } from "../lib/session";
import { hashEmail } from "../lib/me3";
import { getCreatorByHandle, getFeed } from "../services/graph";
import {
  getSoupProfileByHandle,
  listSoupProfilesByOwner,
  listSoupSourcesByHandle,
  resolveSoupProfileInput,
  upsertSoupProfile,
  upsertSoupSources,
} from "../services/soupStore";
import { ensureSubscriptions, indexUserSources } from "../services/sourceIndexer";
import { indexSite } from "../services/indexer";
import { buildServeResult, type TurnContext } from "../services/kitchenServe";

const kitchen = new Hono<{ Bindings: Env }>();

kitchen.get("/kitchen/soups", async (c) => {
  const auth = await requireUser(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);

  const profiles = await listSoupProfilesByOwner(c.env.DB, auth.userId);
  return c.json({
    soups: profiles.map((profile) => ({
      id: profile.id,
      name: profile.handle,
      displayName: profile.display_name,
      visibility: profile.visibility,
      me3SiteUrl: profile.me3_site_url,
      createdAt: profile.created_at,
    })),
  });
});

/**
 * POST /kitchen/submit
 * Body: { name?, displayName?, me3SiteUrl?, sources?[] }
 */
kitchen.post("/kitchen/submit", async (c) => {
  const auth = await requireUser(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);

  let body: {
    name?: string;
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
      handle: body.name,
      displayName: body.displayName,
      me3SiteUrl: body.me3SiteUrl ?? auth.me3SiteUrl ?? undefined,
      visibility: body.visibility,
    });

    const existing = await getSoupProfileByHandle(c.env.DB, profileInput.handle);
    if (existing?.owner_id && existing.owner_id !== auth.userId) {
      return c.json({ error: "Name is already claimed" }, 409);
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
      name: profile.handle,
      soupPath: `/soups/${profile.handle}`,
      profile,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save soup";
    return c.json({ error: message }, 400);
  }
});

/**
 * POST /kitchen/serve
 * Body: { prompt, days?, limit?, soupName?, refresh?, thread?[] }
 */
kitchen.post("/kitchen/serve", async (c) => {
  const auth = await requireUser(c);
  if (!auth.ok) return c.json({ error: auth.error }, auth.status);

  let body: {
    prompt?: string;
    days?: number;
    limit?: number;
    soupName?: string;
    refresh?: boolean;
    thread?: TurnContext[];
  };

  try {
    body = await c.req.json<typeof body>();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const prompt = String(body.prompt ?? "").trim();
  if (prompt.length < 3) {
    return c.json({ error: "prompt must be at least 3 characters" }, 400);
  }

  const days = clampNumber(body.days, 1, 30, 7);
  const limit = clampNumber(body.limit, 3, 30, 12);
  const refresh = Boolean(body.refresh);
  const thread = sanitizeThread(body.thread);

  const handleResult = await resolveSoupHandle(c.env.DB, {
    userId: auth.userId,
    userHandle: auth.handle ?? undefined,
    requestedHandle: body.soupName,
  });
  if (!handleResult.ok) {
    return c.json({ error: handleResult.error }, handleResult.status);
  }

  const initialFeed = await loadSoupFeed(c.env.DB, handleResult.handle, days, limit);
  if (!initialFeed.ok) {
    return c.json({ error: initialFeed.error }, initialFeed.status);
  }

  let response = buildServeResult({
    prompt,
    items: initialFeed.items,
    days,
    limit,
    threadContext: thread,
    refreshed: refresh,
  });

  let ingestion:
    | { triggered: false }
    | {
        triggered: true;
        feedsIndexed: number;
        itemsIndexed: number;
      } = { triggered: false };

  if (refresh) {
    const ingestResult = await indexUserSources(c.env.DB, handleResult.handle, {
      limitPerFeed: 20,
    });
    ingestion = {
      triggered: true,
      feedsIndexed: ingestResult.feedsIndexed,
      itemsIndexed: ingestResult.itemsIndexed,
    };

    const refreshedFeed = await loadSoupFeed(c.env.DB, handleResult.handle, days, limit);
    if (!refreshedFeed.ok) {
      return c.json({ error: refreshedFeed.error }, refreshedFeed.status);
    }

    response = buildServeResult({
      prompt,
      items: refreshedFeed.items,
      days,
      limit,
      threadContext: thread,
      refreshed: true,
    });
  }

  return c.json({
    soupName: handleResult.handle,
    prompt,
    days,
    refreshRequested: refresh,
    mode: response.mode,
    summary: response.summary,
    recommendations: response.recommendations,
    coverage: response.coverage,
    needsRefresh: response.needsRefresh,
    ingestion,
  });
});

type SoupHandleResult =
  | { ok: true; handle: string }
  | { ok: false; error: string; status: 403 | 404 };

type FeedResult =
  | { ok: true; items: Awaited<ReturnType<typeof getFeed>>["items"] }
  | { ok: false; error: string; status: 404 };

async function resolveSoupHandle(
  db: D1Database,
  options: {
    userId: string;
    userHandle?: string;
    requestedHandle?: string;
  },
): Promise<SoupHandleResult> {
  const profiles = await listSoupProfilesByOwner(db, options.userId);
  const requestedHandle = sanitizeHandle(options.requestedHandle);

  if (requestedHandle) {
    const requested = profiles.find((profile) => profile.handle === requestedHandle);
    if (!requested) {
      return { ok: false, error: "Soup not found for this user", status: 404 };
    }
    return { ok: true, handle: requested.handle };
  }

  const userHandle = sanitizeHandle(options.userHandle);
  if (userHandle) {
    const matched = profiles.find((profile) => profile.handle === userHandle);
    if (matched) {
      return { ok: true, handle: matched.handle };
    }
  }

  if (profiles.length > 0) {
    return { ok: true, handle: profiles[0].handle };
  }

  if (userHandle) {
    return { ok: true, handle: userHandle };
  }

  return { ok: false, error: "No soup profile found", status: 404 };
}

async function loadSoupFeed(
  db: D1Database,
  handle: string,
  days: number,
  limit: number,
): Promise<FeedResult> {
  const soup = await listSoupSourcesByHandle(db, handle);
  if (!soup) {
    return { ok: false, error: "Soup not found", status: 404 };
  }

  const sources = soup.sources ?? [];
  const creatorLookups = await Promise.all(
    sources.map((source) =>
      db
        .prepare("SELECT id, name FROM creators WHERE site_url = ?")
        .bind(source.feedUrl)
        .first<{ id: string; name: string }>(),
    ),
  );

  const creatorIds = creatorLookups
    .map((creator) => creator?.id)
    .filter((value): value is string => Boolean(value));

  if (creatorIds.length > 0) {
    await ensureSubscriptions(db, handle, creatorIds);
  }

  const creator = await getCreatorByHandle(db, handle);
  const subscriberId = creator?.id ?? handle;
  const subscriberHash = await hashEmail(`handle:${handle}`);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const expandedLimit = Math.min(200, Math.max(limit * 4, 50));

  const recent = await getFeed(db, subscriberId, {
    since,
    limit: expandedLimit,
    subscriberEmailHash: subscriberHash,
  });

  if (recent.items.length >= 6) {
    return { ok: true, items: recent.items };
  }

  const full = await getFeed(db, subscriberId, {
    limit: 200,
    subscriberEmailHash: subscriberHash,
  });

  return {
    ok: true,
    items: mergeById(recent.items, full.items),
  };
}

function mergeById<T extends { id: string }>(primary: T[], secondary: T[]): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const item of [...primary, ...secondary]) {
    if (seen.has(item.id)) continue;
    seen.add(item.id);
    merged.push(item);
  }
  return merged;
}

function sanitizeThread(input: unknown): TurnContext[] {
  if (!Array.isArray(input)) return [];
  return input
    .flatMap((entry): TurnContext[] => {
      const role: TurnContext["role"] =
        entry &&
        typeof entry === "object" &&
        (entry as { role?: unknown }).role === "assistant"
          ? "assistant"
          : "user";
      const content =
        entry && typeof entry === "object"
          ? String((entry as { content?: unknown }).content ?? "").trim()
          : "";
      if (!content) return [];
      return [{ role, content }];
    })
    .slice(-8);
}

function sanitizeHandle(value?: string | null): string {
  if (!value) return "";
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/[^a-z0-9_-]/g, "");
}

function clampNumber(
  value: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  if (typeof value !== "number" || Number.isNaN(value)) return fallback;
  return Math.max(min, Math.min(max, Math.round(value)));
}

export default kitchen;
