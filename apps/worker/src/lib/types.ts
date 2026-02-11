/**
 * The Human Soup - Core Types
 */

// ── Cloudflare Bindings ────────────────────────────────────
export interface Env {
  DB: D1Database;
  ENVIRONMENT: string;
  SOUP_OWNER_SITE_URL: string;
  SOUP_WRITE_KEY: string;
  BRAVE_SEARCH_API_KEY: string;
  POSTMARK_TOKEN: string;
  POSTMARK_FROM_EMAIL: string;
  POSTMARK_STREAM: string;
  JWT_SECRET: string;
  SOUP_WEB_ORIGINS?: string;
}

// ── Database Row Types ─────────────────────────────────────

export interface DbCreator {
  id: string;
  handle: string;
  name: string;
  bio: string | null;
  location: string | null;
  avatar: string | null;
  banner: string | null;
  site_url: string;
  me_json_hash: string | null;
  topics: string; // JSON array
  content_types: string; // JSON array
  post_count: number;
  links: string; // JSON object
  subscribe_enabled: number;
  subscribe_title: string | null;
  subscribe_description: string | null;
  subscribe_frequency: string | null;
  first_seen_at: string;
  last_indexed_at: string | null;
  last_published_at: string | null;
  trust_score: number;
  trust_signals: string; // JSON object
  soup_enabled: number;
  subscriber_list_visible: number;
  verified: number;
  verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbContent {
  id: string;
  creator_id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content_type: string;
  file_path: string | null;
  content_url: string | null;
  published_at: string | null;
  topics: string; // JSON array
  media_url: string | null;
  media_duration: number | null;
  media_thumbnail: string | null;
  indexed_at: string;
  updated_at: string;
}

export interface DbSubscription {
  id: string;
  subscriber_id: string | null;
  subscriber_email_hash: string | null;
  creator_id: string;
  source: string;
  subscribed_at: string;
  unsubscribed_at: string | null;
}

export interface DbTopic {
  id: string;
  name: string;
  display_name: string;
  content_count: number;
  creator_count: number;
  created_at: string;
}

export interface DbCrawlLog {
  id: string;
  creator_id: string | null;
  site_url: string;
  status: "success" | "failed" | "unchanged";
  me_json_hash: string | null;
  posts_found: number;
  posts_new: number;
  posts_updated: number;
  error: string | null;
  duration_ms: number | null;
  crawled_at: string;
}

export interface DbSoupProfile {
  id: string;
  handle: string;
  display_name: string;
  me3_site_url: string | null;
  visibility: "public" | "unlisted" | "private";
  owner_id?: string | null;
  created_at: string;
}

export interface DbSoupSource {
  id: string;
  profile_id: string;
  source_type: "video" | "audio" | "article";
  name: string | null;
  feed_url: string;
  site_url: string | null;
  confidence: number | null;
  added_by: "agent" | "wizard" | "user";
  added_via: "mcp" | "web" | "api";
  created_at: string;
}

// ── API Response Types ─────────────────────────────────────

export interface CreatorResponse {
  id: string;
  handle: string;
  name: string;
  bio: string | null;
  location: string | null;
  avatar: string | null;
  siteUrl: string;
  topics: string[];
  contentTypes: string[];
  postCount: number;
  trustScore: number;
  verified: boolean;
  lastPublishedAt: string | null;
  subscribe?: {
    enabled: boolean;
    title: string | null;
    description: string | null;
    frequency: string | null;
  };
}

export interface ContentResponse {
  id: string;
  creatorId: string;
  creatorHandle: string;
  creatorName: string;
  slug: string;
  title: string;
  excerpt: string | null;
  contentType: string;
  contentUrl: string | null;
  publishedAt: string | null;
  topics: string[];
  media?: {
    url: string | null;
    duration: number | null;
    thumbnail: string | null;
  };
}

export interface FeedResponse {
  items: ContentResponse[];
  total: number;
  since: string | null;
}

export interface StatsResponse {
  creators: number;
  content: number;
  subscriptions: number;
  topics: number;
  lastCrawl: string | null;
}

// ── Trust Signals ──────────────────────────────────────────

export interface TrustSignals {
  hasCustomDomain: boolean;
  historyMonths: number;
  postCount: number;
  subscriberCount: number;
  verified: boolean;
  vouchCount: number;
}

// ── Ingest Types ───────────────────────────────────────────

export interface PingPayload {
  site_url: string;
  event: "publish" | "update" | "delete";
  post_slug?: string;
}

export interface SubscribePayload {
  subscriber_email_hash?: string;
  subscriber_site_url?: string;
  creator_site_url: string;
  source?: string;
}
