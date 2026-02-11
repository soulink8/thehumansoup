-- ============================================================================
-- The Human Soup - Content Graph Schema
-- ============================================================================

-- Creators: indexed from me.json profiles. Each me3 site = one creator.
CREATE TABLE IF NOT EXISTS creators (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL,
  name TEXT NOT NULL,
  bio TEXT,
  location TEXT,
  avatar TEXT,
  banner TEXT,
  site_url TEXT NOT NULL UNIQUE,
  me_json_hash TEXT,
  topics TEXT DEFAULT '[]',
  content_types TEXT DEFAULT '[]',
  post_count INTEGER DEFAULT 0,
  links TEXT DEFAULT '{}',
  subscribe_enabled INTEGER DEFAULT 0,
  subscribe_title TEXT,
  subscribe_description TEXT,
  subscribe_frequency TEXT,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_indexed_at TEXT,
  last_published_at TEXT,
  trust_score REAL DEFAULT 0.0,
  trust_signals TEXT DEFAULT '{}',
  soup_enabled INTEGER DEFAULT 1,
  subscriber_list_visible INTEGER DEFAULT 0,
  verified INTEGER DEFAULT 0,
  verified_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Content: individual posts/notes/videos indexed from me.json posts array
CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  slug TEXT NOT NULL,
  title TEXT NOT NULL,
  excerpt TEXT,
  content_type TEXT DEFAULT 'article',
  file_path TEXT,
  content_url TEXT,
  published_at TEXT,
  topics TEXT DEFAULT '[]',
  media_url TEXT,
  media_duration INTEGER,
  media_thumbnail TEXT,
  indexed_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(creator_id, slug)
);

-- Subscriptions: the social graph - who follows whom
CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  subscriber_id TEXT,
  subscriber_email_hash TEXT,
  creator_id TEXT NOT NULL REFERENCES creators(id) ON DELETE CASCADE,
  source TEXT DEFAULT 'newsletter_block',
  subscribed_at TEXT NOT NULL DEFAULT (datetime('now')),
  unsubscribed_at TEXT,
  UNIQUE(subscriber_email_hash, creator_id)
);

-- Topics: canonical topic registry for consistent classification
CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  content_count INTEGER DEFAULT 0,
  creator_count INTEGER DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Content <-> Topics: many-to-many join
CREATE TABLE IF NOT EXISTS content_topics (
  content_id TEXT NOT NULL REFERENCES content(id) ON DELETE CASCADE,
  topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  confidence REAL DEFAULT 1.0,
  PRIMARY KEY (content_id, topic_id)
);

-- Crawl log: audit trail for indexer runs
CREATE TABLE IF NOT EXISTS crawl_log (
  id TEXT PRIMARY KEY,
  creator_id TEXT REFERENCES creators(id) ON DELETE SET NULL,
  site_url TEXT NOT NULL,
  status TEXT NOT NULL,
  me_json_hash TEXT,
  posts_found INTEGER DEFAULT 0,
  posts_new INTEGER DEFAULT 0,
  posts_updated INTEGER DEFAULT 0,
  error TEXT,
  duration_ms INTEGER,
  crawled_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Soup Profiles: owner of a custom soup (agent + wizard)
CREATE TABLE IF NOT EXISTS soup_profiles (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  me3_site_url TEXT,
  visibility TEXT NOT NULL DEFAULT 'public',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Soup Sources: per-handle list of sources with provenance
CREATE TABLE IF NOT EXISTS soup_sources (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL REFERENCES soup_profiles(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL,
  name TEXT,
  feed_url TEXT NOT NULL,
  site_url TEXT,
  confidence REAL DEFAULT 0.5,
  added_by TEXT NOT NULL,
  added_via TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(profile_id, feed_url)
);

-- ── Indexes ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_creators_handle ON creators(handle);
CREATE INDEX IF NOT EXISTS idx_creators_trust ON creators(trust_score DESC);
CREATE INDEX IF NOT EXISTS idx_creators_last_published ON creators(last_published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_creator ON content(creator_id);
CREATE INDEX IF NOT EXISTS idx_content_published ON content(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_content_type ON content(content_type);
CREATE INDEX IF NOT EXISTS idx_subscriptions_creator ON subscriptions(creator_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_subscriber ON subscriptions(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_crawl_log_creator ON crawl_log(creator_id);
CREATE INDEX IF NOT EXISTS idx_crawl_log_status ON crawl_log(status);
CREATE INDEX IF NOT EXISTS idx_soup_profiles_handle ON soup_profiles(handle);
CREATE INDEX IF NOT EXISTS idx_soup_sources_profile ON soup_sources(profile_id);
