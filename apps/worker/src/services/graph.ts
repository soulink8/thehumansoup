/**
 * Content Graph Query Service
 *
 * Provides structured queries over the D1 content graph.
 * This is what the REST API and MCP tools call to get data.
 */

import type {
  DbCreator,
  DbContent,
  CreatorResponse,
  ContentResponse,
  FeedResponse,
  StatsResponse,
} from "../lib/types";

// ── Creator Queries ────────────────────────────────────────

export async function getCreators(
  db: D1Database,
  options: {
    topic?: string;
    limit?: number;
    offset?: number;
    orderBy?: "trust" | "recent" | "posts";
  } = {},
): Promise<CreatorResponse[]> {
  const { topic, limit = 20, offset = 0, orderBy = "trust" } = options;

  let query = "SELECT * FROM creators WHERE soup_enabled = 1";
  const params: unknown[] = [];

  if (topic) {
    query += " AND topics LIKE ?";
    params.push(`%"${topic}"%`);
  }

  switch (orderBy) {
    case "trust":
      query += " ORDER BY trust_score DESC, post_count DESC";
      break;
    case "recent":
      query += " ORDER BY last_published_at DESC NULLS LAST";
      break;
    case "posts":
      query += " ORDER BY post_count DESC";
      break;
  }

  query += " LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<DbCreator>();

  return (result.results ?? []).map(toCreatorResponse);
}

export async function getCreatorById(
  db: D1Database,
  id: string,
): Promise<CreatorResponse | null> {
  const row = await db
    .prepare("SELECT * FROM creators WHERE id = ?")
    .bind(id)
    .first<DbCreator>();

  return row ? toCreatorResponse(row) : null;
}

export async function getCreatorBySiteUrl(
  db: D1Database,
  siteUrl: string,
): Promise<CreatorResponse | null> {
  const row = await db
    .prepare("SELECT * FROM creators WHERE site_url = ?")
    .bind(siteUrl)
    .first<DbCreator>();

  return row ? toCreatorResponse(row) : null;
}

export async function getCreatorByHandle(
  db: D1Database,
  handle: string,
): Promise<CreatorResponse | null> {
  const row = await db
    .prepare("SELECT * FROM creators WHERE handle = ?")
    .bind(handle)
    .first<DbCreator>();

  return row ? toCreatorResponse(row) : null;
}

export async function getCreatorByName(
  db: D1Database,
  name: string,
): Promise<CreatorResponse | null> {
  const row = await db
    .prepare("SELECT * FROM creators WHERE lower(name) = lower(?)")
    .bind(name)
    .first<DbCreator>();

  return row ? toCreatorResponse(row) : null;
}

// ── Content Queries ────────────────────────────────────────

export async function getContent(
  db: D1Database,
  options: {
    creatorId?: string;
    contentType?: string;
    topic?: string;
    since?: string;
    limit?: number;
    offset?: number;
  } = {},
): Promise<ContentResponse[]> {
  const {
    creatorId,
    contentType,
    topic,
    since,
    limit = 20,
    offset = 0,
  } = options;

  let query = `
    SELECT c.*, cr.handle as creator_handle, cr.name as creator_name
    FROM content c
    JOIN creators cr ON c.creator_id = cr.id
    WHERE 1=1
  `;
  const params: unknown[] = [];

  if (creatorId) {
    query += " AND c.creator_id = ?";
    params.push(creatorId);
  }

  if (contentType) {
    query += " AND c.content_type = ?";
    params.push(contentType);
  }

  if (topic) {
    query += " AND c.topics LIKE ?";
    params.push(`%"${topic}"%`);
  }

  if (since) {
    query += " AND c.published_at >= ?";
    params.push(since);
  }

  query += " ORDER BY c.published_at DESC NULLS LAST LIMIT ? OFFSET ?";
  params.push(limit, offset);

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<DbContent & { creator_handle: string; creator_name: string }>();

  return (result.results ?? []).map(toContentResponse);
}

export async function getContentByCreator(
  db: D1Database,
  creatorId: string,
  limit = 20,
): Promise<ContentResponse[]> {
  return getContent(db, { creatorId, limit });
}

// ── Feed Queries ───────────────────────────────────────────

export async function getFeed(
  db: D1Database,
  subscriberId: string,
  options: {
    since?: string;
    limit?: number;
    contentType?: string;
    subscriberEmailHash?: string;
  } = {},
): Promise<FeedResponse> {
  const { since, limit = 50, contentType, subscriberEmailHash } = options;
  const subscriberHash = subscriberEmailHash ?? subscriberId;

  // Get all creators this human subscribes to
  let query = `
    SELECT c.*, cr.handle as creator_handle, cr.name as creator_name
    FROM content c
    JOIN creators cr ON c.creator_id = cr.id
    JOIN subscriptions s ON s.creator_id = c.creator_id
    WHERE (s.subscriber_id = ? OR s.subscriber_email_hash = ?)
      AND s.unsubscribed_at IS NULL
  `;
  const params: unknown[] = [subscriberId, subscriberHash];

  if (contentType) {
    query += " AND c.content_type = ?";
    params.push(contentType);
  }

  if (since) {
    query += " AND c.published_at >= ?";
    params.push(since);
  }

  query += " ORDER BY c.published_at DESC NULLS LAST LIMIT ?";
  params.push(limit);

  const result = await db
    .prepare(query)
    .bind(...params)
    .all<DbContent & { creator_handle: string; creator_name: string }>();

  const items = (result.results ?? []).map(toContentResponse);

  // Get total count
  let countQuery = `
    SELECT COUNT(*) as total
    FROM content c
    JOIN subscriptions s ON s.creator_id = c.creator_id
    WHERE (s.subscriber_id = ? OR s.subscriber_email_hash = ?)
      AND s.unsubscribed_at IS NULL
  `;
  const countParams: unknown[] = [subscriberId, subscriberHash];

  if (contentType) {
    countQuery += " AND c.content_type = ?";
    countParams.push(contentType);
  }

  if (since) {
    countQuery += " AND c.published_at >= ?";
    countParams.push(since);
  }

  const count = await db
    .prepare(countQuery)
    .bind(...countParams)
    .first<{ total: number }>();

  return {
    items,
    total: count?.total ?? 0,
    since: since ?? null,
  };
}

// ── Trending ───────────────────────────────────────────────

export async function getTrending(
  db: D1Database,
  options: { limit?: number; days?: number } = {},
): Promise<ContentResponse[]> {
  const { limit = 20, days = 7 } = options;
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

  // For now, "trending" is just recent content from high-trust creators
  const query = `
    SELECT c.*, cr.handle as creator_handle, cr.name as creator_name
    FROM content c
    JOIN creators cr ON c.creator_id = cr.id
    WHERE c.published_at >= ?
      AND cr.trust_score > 0.2
    ORDER BY cr.trust_score DESC, c.published_at DESC
    LIMIT ?
  `;

  const result = await db
    .prepare(query)
    .bind(since, limit)
    .all<DbContent & { creator_handle: string; creator_name: string }>();

  return (result.results ?? []).map(toContentResponse);
}

// ── Stats ──────────────────────────────────────────────────

export async function getStats(db: D1Database): Promise<StatsResponse> {
  const [creators, content, subscriptions, topics, lastCrawl] =
    await Promise.all([
      db
        .prepare("SELECT COUNT(*) as count FROM creators")
        .first<{ count: number }>(),
      db
        .prepare("SELECT COUNT(*) as count FROM content")
        .first<{ count: number }>(),
      db
        .prepare(
          "SELECT COUNT(*) as count FROM subscriptions WHERE unsubscribed_at IS NULL",
        )
        .first<{ count: number }>(),
      db
        .prepare("SELECT COUNT(*) as count FROM topics")
        .first<{ count: number }>(),
      db
        .prepare(
          "SELECT crawled_at FROM crawl_log ORDER BY crawled_at DESC LIMIT 1",
        )
        .first<{ crawled_at: string }>(),
    ]);

  return {
    creators: creators?.count ?? 0,
    content: content?.count ?? 0,
    subscriptions: subscriptions?.count ?? 0,
    topics: topics?.count ?? 0,
    lastCrawl: lastCrawl?.crawled_at ?? null,
  };
}

// ── Response Mappers ───────────────────────────────────────

function toCreatorResponse(row: DbCreator): CreatorResponse {
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    bio: row.bio,
    location: row.location,
    avatar: row.avatar,
    siteUrl: row.site_url,
    topics: safeJsonParse(row.topics, []),
    contentTypes: safeJsonParse(row.content_types, []),
    postCount: row.post_count,
    trustScore: row.trust_score,
    verified: row.verified === 1,
    lastPublishedAt: row.last_published_at,
    subscribe: row.subscribe_enabled
      ? {
          enabled: true,
          title: row.subscribe_title,
          description: row.subscribe_description,
          frequency: row.subscribe_frequency,
        }
      : undefined,
  };
}

function toContentResponse(
  row: DbContent & { creator_handle: string; creator_name: string },
): ContentResponse {
  return {
    id: row.id,
    creatorId: row.creator_id,
    creatorHandle: row.creator_handle,
    creatorName: row.creator_name,
    slug: row.slug,
    title: row.title,
    excerpt: row.excerpt,
    contentType: row.content_type,
    contentUrl: row.content_url,
    publishedAt: row.published_at,
    topics: safeJsonParse(row.topics, []),
    media:
      row.media_url || row.media_duration || row.media_thumbnail
        ? {
            url: row.media_url,
            duration: row.media_duration,
            thumbnail: row.media_thumbnail,
          }
        : undefined,
    transcript: row.transcript_text
      ? {
          text: row.transcript_text,
          language: row.transcript_language,
        }
      : undefined,
  };
}

function safeJsonParse<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
