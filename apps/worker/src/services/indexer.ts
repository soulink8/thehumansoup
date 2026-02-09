/**
 * Indexer Service
 *
 * Crawls me3 sites, fetches me.json, and upserts creators + content into D1.
 * The indexer is the heart of the soup -- it turns isolated me3 sites into
 * a connected content graph.
 */

import type { Me3Profile, Me3Post } from "me3-protocol";
import { fetchMe3Profile, buildContentUrl, uuid } from "../lib/me3";
import { calculateTrust, type TrustSignals } from "./trust";
import type { Env, DbCreator } from "../lib/types";

export interface IndexResult {
  siteUrl: string;
  status: "success" | "failed" | "unchanged";
  postsFound: number;
  postsNew: number;
  postsUpdated: number;
  error?: string;
  durationMs: number;
}

/**
 * Index a single me3 site: fetch me.json, upsert creator, diff posts.
 */
export async function indexSite(
  db: D1Database,
  siteUrl: string
): Promise<IndexResult> {
  const start = Date.now();

  // 1. Fetch me.json
  const fetchResult = await fetchMe3Profile(siteUrl);
  if (!fetchResult.success || !fetchResult.profile) {
    const result: IndexResult = {
      siteUrl,
      status: "failed",
      postsFound: 0,
      postsNew: 0,
      postsUpdated: 0,
      error: fetchResult.error,
      durationMs: Date.now() - start,
    };
    await logCrawl(db, null, result);
    return result;
  }

  const profile = fetchResult.profile;
  const hash = fetchResult.hash!;

  // 2. Check if creator exists
  const existing = await db
    .prepare("SELECT id, me_json_hash FROM creators WHERE site_url = ?")
    .bind(siteUrl)
    .first<Pick<DbCreator, "id" | "me_json_hash">>();

  // 3. Skip if unchanged
  if (existing && existing.me_json_hash === hash) {
    const result: IndexResult = {
      siteUrl,
      status: "unchanged",
      postsFound: profile.posts?.length ?? 0,
      postsNew: 0,
      postsUpdated: 0,
      durationMs: Date.now() - start,
    };
    await logCrawl(db, existing.id, result);
    return result;
  }

  // 4. Upsert creator
  const creatorId = existing?.id ?? uuid();
  await upsertCreator(db, creatorId, siteUrl, profile, hash);

  // 5. Diff and upsert posts
  const posts = profile.posts ?? [];
  const { postsNew, postsUpdated } = await syncPosts(
    db,
    creatorId,
    siteUrl,
    posts
  );

  // 6. Update post count + last published
  const lastPublished = posts
    .filter((p) => p.publishedAt)
    .sort(
      (a, b) =>
        new Date(b.publishedAt!).getTime() - new Date(a.publishedAt!).getTime()
    )[0]?.publishedAt;

  await db
    .prepare(
      `UPDATE creators SET post_count = ?, last_published_at = ?, updated_at = datetime('now') WHERE id = ?`
    )
    .bind(posts.length, lastPublished ?? null, creatorId)
    .run();

  // 7. Calculate trust score
  const subscriberCount = await db
    .prepare(
      "SELECT COUNT(*) as count FROM subscriptions WHERE creator_id = ? AND unsubscribed_at IS NULL"
    )
    .bind(creatorId)
    .first<{ count: number }>();

  const firstSeen = await db
    .prepare("SELECT first_seen_at FROM creators WHERE id = ?")
    .bind(creatorId)
    .first<{ first_seen_at: string }>();

  const historyMonths = firstSeen
    ? Math.floor(
        (Date.now() - new Date(firstSeen.first_seen_at).getTime()) /
          (1000 * 60 * 60 * 24 * 30)
      )
    : 0;

  const hasCustomDomain =
    !siteUrl.includes(".me3.app") && !siteUrl.includes("localhost");

  const trustSignals: TrustSignals = {
    hasCustomDomain,
    historyMonths,
    postCount: posts.length,
    subscriberCount: subscriberCount?.count ?? 0,
    verified: !!profile.verification?.verified,
    vouchCount: 0, // Future: Soulink integration
  };

  const trustScore = calculateTrust(trustSignals);

  await db
    .prepare(
      `UPDATE creators SET trust_score = ?, trust_signals = ?, verified = ?, verified_at = ? WHERE id = ?`
    )
    .bind(
      trustScore,
      JSON.stringify(trustSignals),
      profile.verification?.verified ? 1 : 0,
      profile.verification?.verifiedAt ?? null,
      creatorId
    )
    .run();

  const result: IndexResult = {
    siteUrl,
    status: "success",
    postsFound: posts.length,
    postsNew,
    postsUpdated,
    durationMs: Date.now() - start,
  };
  await logCrawl(db, creatorId, result);
  return result;
}

/**
 * Run the indexer across all registered creators.
 */
export async function indexAll(db: D1Database): Promise<IndexResult[]> {
  const creators = await db
    .prepare(
      "SELECT site_url FROM creators WHERE soup_enabled = 1 ORDER BY last_indexed_at ASC LIMIT 50"
    )
    .all<{ site_url: string }>();

  if (!creators.results?.length) {
    return [];
  }

  // Index sequentially to be respectful of rate limits
  const results: IndexResult[] = [];
  for (const creator of creators.results) {
    const result = await indexSite(db, creator.site_url);
    results.push(result);
  }

  return results;
}

// ── Internal Helpers ───────────────────────────────────────

async function upsertCreator(
  db: D1Database,
  id: string,
  siteUrl: string,
  profile: Me3Profile,
  hash: string
): Promise<void> {
  // Extract content types from posts
  const contentTypes = [...new Set((profile.posts ?? []).map(() => "article"))];

  // Extract links as JSON
  const links = profile.links ? JSON.stringify(profile.links) : "{}";

  await db
    .prepare(
      `INSERT INTO creators (
        id, handle, name, bio, location, avatar, banner, site_url,
        me_json_hash, content_types, links,
        subscribe_enabled, subscribe_title, subscribe_description, subscribe_frequency,
        last_indexed_at, first_seen_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))
      ON CONFLICT(site_url) DO UPDATE SET
        handle = excluded.handle,
        name = excluded.name,
        bio = excluded.bio,
        location = excluded.location,
        avatar = excluded.avatar,
        banner = excluded.banner,
        me_json_hash = excluded.me_json_hash,
        content_types = excluded.content_types,
        links = excluded.links,
        subscribe_enabled = excluded.subscribe_enabled,
        subscribe_title = excluded.subscribe_title,
        subscribe_description = excluded.subscribe_description,
        subscribe_frequency = excluded.subscribe_frequency,
        last_indexed_at = datetime('now'),
        updated_at = datetime('now')`
    )
    .bind(
      id,
      profile.handle ?? profile.name.toLowerCase().replace(/\s+/g, "-"),
      profile.name,
      profile.bio ?? null,
      profile.location ?? null,
      profile.avatar ?? null,
      profile.banner ?? null,
      siteUrl,
      hash,
      JSON.stringify(contentTypes),
      links,
      profile.intents?.subscribe?.enabled ? 1 : 0,
      profile.intents?.subscribe?.title ?? null,
      profile.intents?.subscribe?.description ?? null,
      profile.intents?.subscribe?.frequency ?? null
    )
    .run();
}

async function syncPosts(
  db: D1Database,
  creatorId: string,
  siteUrl: string,
  posts: Me3Post[]
): Promise<{ postsNew: number; postsUpdated: number }> {
  let postsNew = 0;
  let postsUpdated = 0;

  for (const post of posts) {
    const contentUrl = buildContentUrl(siteUrl, post.slug);

    const existing = await db
      .prepare(
        "SELECT id, title, excerpt FROM content WHERE creator_id = ? AND slug = ?"
      )
      .bind(creatorId, post.slug)
      .first<{ id: string; title: string; excerpt: string | null }>();

    if (existing) {
      // Check if anything changed
      if (existing.title !== post.title || existing.excerpt !== (post.excerpt ?? null)) {
        await db
          .prepare(
            `UPDATE content SET title = ?, excerpt = ?, published_at = ?, content_url = ?, updated_at = datetime('now')
             WHERE id = ?`
          )
          .bind(
            post.title,
            post.excerpt ?? null,
            post.publishedAt ?? null,
            contentUrl,
            existing.id
          )
          .run();
        postsUpdated++;
      }
    } else {
      // New post
      const contentId = uuid();
      await db
        .prepare(
          `INSERT INTO content (id, creator_id, slug, title, excerpt, content_type, file_path, content_url, published_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
        )
        .bind(
          contentId,
          creatorId,
          post.slug,
          post.title,
          post.excerpt ?? null,
          "article", // Default for now, protocol will add type field later
          post.file,
          contentUrl,
          post.publishedAt ?? null
        )
        .run();
      postsNew++;
    }
  }

  return { postsNew, postsUpdated };
}

async function logCrawl(
  db: D1Database,
  creatorId: string | null,
  result: IndexResult
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO crawl_log (id, creator_id, site_url, status, posts_found, posts_new, posts_updated, error, duration_ms)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .bind(
      uuid(),
      creatorId,
      result.siteUrl,
      result.status,
      result.postsFound,
      result.postsNew,
      result.postsUpdated,
      result.error ?? null,
      result.durationMs
    )
    .run();
}
