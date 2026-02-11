import type { DemoSource, DemoSourceSet } from "../sources/demoSources";
import { DEMO_SOURCES } from "../sources/demoSources";
import { parseFeed } from "./rss";
import type { ParsedFeed, ParsedFeedItem } from "./rss";
import { hashEmail, normalizeUrl, uuid } from "../lib/me3";
import { listSoupSourcesByHandle } from "./soupStore";

export interface IndexSourcesResult {
  handle: string;
  feedsIndexed: number;
  itemsIndexed: number;
  creatorIds: string[];
}

const MIN_LONG_FORM_VIDEO_SECONDS = 180;

export function getDemoSourceSet(handle: string): DemoSourceSet | null {
  return DEMO_SOURCES[handle] ?? null;
}

export async function indexUserSources(
  db: D1Database,
  handle: string,
  options: { limitPerFeed?: number } = {},
): Promise<IndexSourcesResult> {
  const sources = await getSourcesForHandle(db, handle);
  if (!sources.length) {
    return { handle, feedsIndexed: 0, itemsIndexed: 0, creatorIds: [] };
  }

  const limitPerFeed = options.limitPerFeed ?? 20;
  const creatorIds: string[] = [];
  let feedsIndexed = 0;
  let itemsIndexed = 0;

  for (const source of sources) {
    const result = await indexFeed(db, source, limitPerFeed);
    if (result) {
      creatorIds.push(result.creatorId);
      feedsIndexed++;
      itemsIndexed += result.itemsIndexed;
    }
  }

  if (creatorIds.length > 0) {
    await ensureSubscriptions(db, handle, creatorIds);
  }

  return { handle, feedsIndexed, itemsIndexed, creatorIds };
}

async function getSourcesForHandle(
  db: D1Database,
  handle: string,
): Promise<DemoSource[]> {
  const soup = await listSoupSourcesByHandle(db, handle);
  if (soup?.sources?.length) {
    return soup.sources.map((source) => ({
      feedUrl: source.feedUrl,
      type: source.sourceType,
      name: source.name ?? undefined,
      siteUrl: source.siteUrl ?? undefined,
    }));
  }

  const demo = getDemoSourceSet(handle);
  return demo?.sources ?? [];
}

export async function ensureSubscriptions(
  db: D1Database,
  handle: string,
  creatorIds: string[],
): Promise<void> {
  if (!creatorIds.length) return;

  const subscriber = await db
    .prepare("SELECT id FROM creators WHERE handle = ?")
    .bind(handle)
    .first<{ id: string }>();

  const subscriberId = subscriber?.id ?? null;
  const subscriberHash = await hashEmail(`handle:${handle}`);

  for (const creatorId of creatorIds) {
    await db
      .prepare(
        `INSERT INTO subscriptions (id, subscriber_id, subscriber_email_hash, creator_id, source)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(subscriber_email_hash, creator_id) DO UPDATE SET
           subscriber_id = COALESCE(excluded.subscriber_id, subscriptions.subscriber_id),
           unsubscribed_at = NULL`,
      )
      .bind(
        uuid(),
        subscriberId,
        subscriberHash,
        creatorId,
        "demo_sources",
      )
      .run();
  }
}

async function indexFeed(
  db: D1Database,
  source: DemoSource,
  limitPerFeed: number,
): Promise<{ creatorId: string; itemsIndexed: number } | null> {
  const response = await fetch(source.feedUrl, {
    headers: {
      Accept: "application/rss+xml, application/atom+xml, application/xml",
      "User-Agent": "TheHumanSoup/0.1 (rss indexer)",
    },
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    console.warn(`[soup] RSS fetch failed ${response.status}: ${source.feedUrl}`);
    return null;
  }

  const xml = await response.text();
  let feed: ParsedFeed;
  try {
    feed = parseFeed(xml);
  } catch (error) {
    console.warn(
      `[soup] RSS parse failed: ${source.feedUrl}`,
      error instanceof Error ? error.message : error,
    );
    return null;
  }

  const siteUrl = source.siteUrl ? normalizeUrl(source.siteUrl) : undefined;
  const links = {
    rss: source.feedUrl,
    website: siteUrl ?? feed.link ?? null,
    sourceType: source.type,
  };

  const { creatorId } = await upsertSourceCreator(db, source, feed.title, links);

  const items = feed.items.slice(0, limitPerFeed);
  let itemsIndexed = 0;

  for (const item of items) {
    const slug = await buildItemSlug(item.id, item.title, item.link);

    if (source.type === "video" && shouldSkipYouTubeShort(source.feedUrl, item)) {
      await db
        .prepare("DELETE FROM content WHERE creator_id = ? AND slug = ?")
        .bind(creatorId, slug)
        .run();
      continue;
    }

    const publishedAt = toIsoDate(item.published);
    const excerpt = buildExcerpt(item.description);
    const contentUrl = item.link ?? null;
    const thumbnailUrl =
      item.thumbnail ?? (isLikelyImageUrl(item.enclosureUrl) ? item.enclosureUrl : undefined);

    const mediaUrl =
      source.type === "audio"
        ? item.enclosureUrl ?? item.link ?? null
        : source.type === "video"
        ? item.link ?? item.enclosureUrl ?? null
        : null;

    const existing = await db
      .prepare(
        "SELECT id, title, excerpt, content_type, media_url, media_thumbnail, published_at FROM content WHERE creator_id = ? AND slug = ?",
      )
      .bind(creatorId, slug)
      .first<{
        id: string;
        title: string;
        excerpt: string | null;
        content_type: string | null;
        media_url: string | null;
        media_thumbnail: string | null;
        published_at: string | null;
      }>();

    if (existing) {
      if (
        existing.title !== item.title ||
        existing.excerpt !== excerpt ||
        existing.content_type !== source.type ||
        existing.media_url !== mediaUrl ||
        existing.media_thumbnail !== (thumbnailUrl ?? null) ||
        existing.published_at !== publishedAt
      ) {
        await db
          .prepare(
            `UPDATE content
             SET title = ?, excerpt = ?, content_type = ?, media_url = ?, media_thumbnail = ?, published_at = ?, content_url = ?, updated_at = datetime('now')
             WHERE id = ?`,
          )
          .bind(
            item.title,
            excerpt,
            source.type,
            mediaUrl,
            thumbnailUrl ?? null,
            publishedAt,
            contentUrl,
            existing.id,
          )
          .run();
        itemsIndexed++;
      }
    } else {
      await db
        .prepare(
          `INSERT INTO content
           (id, creator_id, slug, title, excerpt, content_type, file_path, content_url, published_at, media_url, media_thumbnail)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          uuid(),
          creatorId,
          slug,
          item.title,
          excerpt,
          source.type,
          null,
          contentUrl,
          publishedAt,
          mediaUrl,
          thumbnailUrl ?? null,
        )
        .run();
      itemsIndexed++;
    }
  }

  await updateCreatorStats(db, creatorId);
  return { creatorId, itemsIndexed };
}

export function shouldSkipYouTubeShort(
  sourceFeedUrl: string,
  item: ParsedFeedItem,
): boolean {
  if (!isYouTubeFeedUrl(sourceFeedUrl)) return false;

  if (
    typeof item.durationSeconds === "number" &&
    item.durationSeconds > 0 &&
    item.durationSeconds < MIN_LONG_FORM_VIDEO_SECONDS
  ) {
    return true;
  }

  const markerText = [item.title, item.description, item.link]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return markerText.includes("#shorts") || markerText.includes("/shorts/");
}

async function upsertSourceCreator(
  db: D1Database,
  source: DemoSource,
  title: string,
  links: Record<string, string | null>,
): Promise<{ creatorId: string }> {
  const existing = await db
    .prepare("SELECT id, handle FROM creators WHERE site_url = ?")
    .bind(source.feedUrl)
    .first<{ id: string; handle: string }>();

  const handle =
    existing?.handle ?? (await deriveHandle(title, source.feedUrl));
  const creatorId = existing?.id ?? uuid();
  const linksJson = JSON.stringify(links);

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
        content_types = excluded.content_types,
        links = excluded.links,
        last_indexed_at = datetime('now'),
        updated_at = datetime('now')`,
    )
    .bind(
      creatorId,
      handle,
      title || handle,
      "Imported from RSS",
      null,
      null,
      null,
      source.feedUrl,
      null,
      JSON.stringify([source.type]),
      linksJson,
      0,
      null,
      null,
      null,
    )
    .run();

  return { creatorId };
}

async function updateCreatorStats(db: D1Database, creatorId: string): Promise<void> {
  const posts = await db
    .prepare("SELECT COUNT(*) as count, MAX(published_at) as last_published FROM content WHERE creator_id = ?")
    .bind(creatorId)
    .first<{ count: number; last_published: string | null }>();

  await db
    .prepare(
      `UPDATE creators SET post_count = ?, last_published_at = ?, updated_at = datetime('now') WHERE id = ?`,
    )
    .bind(posts?.count ?? 0, posts?.last_published ?? null, creatorId)
    .run();
}

function buildExcerpt(description?: string): string | null {
  if (!description) return null;
  const text = description.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (!text) return null;
  return text.length > 220 ? `${text.slice(0, 217)}...` : text;
}

function toIsoDate(value?: string): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

async function deriveHandle(title: string, feedUrl: string): Promise<string> {
  const base = slugify(title || hostFromUrl(feedUrl) || "source");
  const hash = (await hashEmail(feedUrl)).slice(0, 6);
  return `${base}-${hash}`;
}

async function buildItemSlug(
  id?: string,
  title?: string,
  link?: string,
): Promise<string> {
  const seed = id ?? link ?? title ?? "item";
  const base = slugify(title ?? seed) || "item";
  const hash = (await hashEmail(seed)).slice(0, 8);
  return `${base}-${hash}`;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
}

function hostFromUrl(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

function isYouTubeFeedUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return (
      (url.hostname === "youtube.com" || url.hostname === "www.youtube.com") &&
      url.pathname === "/feeds/videos.xml"
    );
  } catch {
    return value.includes("youtube.com/feeds/videos.xml");
  }
}

function isLikelyImageUrl(value?: string): boolean {
  if (!value) return false;
  try {
    const url = new URL(value);
    return /\.(avif|gif|jpe?g|png|svg|webp)$/i.test(url.pathname);
  } catch {
    return /\.(avif|gif|jpe?g|png|svg|webp)(\?.*)?$/i.test(value);
  }
}
