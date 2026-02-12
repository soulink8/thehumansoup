import type { DbSoupProfile, DbSoupSource } from "../lib/types";
import { fetchMe3Profile, normalizeUrl, uuid } from "../lib/me3";

export type SoupVisibility = "public" | "unlisted" | "private";

export interface SoupProfileInput {
  handle: string;
  displayName: string;
  me3SiteUrl?: string | null;
  visibility?: SoupVisibility;
  ownerId?: string | null;
}

export interface SoupSourceInput {
  sourceType: "video" | "audio" | "article";
  name?: string | null;
  feedUrl: string;
  siteUrl?: string | null;
  confidence?: number | null;
}

export interface SoupSourceRecord {
  id: string;
  sourceType: "video" | "audio" | "article";
  name: string | null;
  feedUrl: string;
  siteUrl: string | null;
  confidence: number | null;
  addedBy: "agent" | "wizard" | "user";
  addedVia: "mcp" | "web" | "api";
  createdAt: string;
}

function normalizeHandle(value?: string | null): string | null {
  if (!value) return null;
  const normalized = value.trim().replace(/^@+/, "").toLowerCase();
  return normalized.length ? normalized : null;
}

export async function resolveSoupProfileInput(input: {
  handle?: string;
  displayName?: string;
  me3SiteUrl?: string | null;
  visibility?: SoupVisibility;
}): Promise<SoupProfileInput> {
  const inputHandle = normalizeHandle(input.handle);

  if (input.me3SiteUrl) {
    const normalized = normalizeUrl(input.me3SiteUrl);
    const result = await fetchMe3Profile(normalized);
    if (!result.success || !result.profile) {
      throw new Error(result.error ?? "Failed to fetch me.json");
    }
    const handle = inputHandle ?? normalizeHandle(result.profile.handle);
    if (!handle) {
      throw new Error("me3 profile missing handle");
    }
    const displayName = input.displayName ?? result.profile.name ?? handle;
    return {
      handle,
      displayName,
      me3SiteUrl: normalized,
      visibility: input.visibility,
    };
  }

  if (!inputHandle) {
    throw new Error("handle is required");
  }

  return {
    handle: inputHandle,
    displayName: input.displayName ?? inputHandle,
    me3SiteUrl: input.me3SiteUrl ?? null,
    visibility: input.visibility,
  };
}

export async function getSoupProfileByHandle(
  db: D1Database,
  handle: string,
): Promise<DbSoupProfile | null> {
  return await db
    .prepare("SELECT * FROM soup_profiles WHERE handle = ?")
    .bind(handle)
    .first<DbSoupProfile>();
}

export async function upsertSoupProfile(
  db: D1Database,
  input: SoupProfileInput,
): Promise<DbSoupProfile> {
  const profile = await getSoupProfileByHandle(db, input.handle);
  const id = profile?.id ?? uuid();
  const visibility = input.visibility ?? "public";
  const ownerId = input.ownerId ?? profile?.owner_id ?? null;

  await db
    .prepare(
      `INSERT INTO soup_profiles (id, handle, display_name, me3_site_url, visibility, owner_id)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(handle) DO UPDATE SET
         display_name = excluded.display_name,
         me3_site_url = excluded.me3_site_url,
         visibility = excluded.visibility,
         owner_id = COALESCE(soup_profiles.owner_id, excluded.owner_id)`,
    )
    .bind(
      id,
      input.handle,
      input.displayName,
      input.me3SiteUrl ?? null,
      visibility,
      ownerId,
    )
    .run();

  return (await getSoupProfileByHandle(db, input.handle)) as DbSoupProfile;
}

export async function listSoupSourcesByProfile(
  db: D1Database,
  profileId: string,
): Promise<SoupSourceRecord[]> {
  const result = await db
    .prepare("SELECT * FROM soup_sources WHERE profile_id = ? ORDER BY created_at DESC")
    .bind(profileId)
    .all<DbSoupSource>();

  return (result.results ?? []).map((row) => ({
    id: row.id,
    sourceType: row.source_type,
    name: row.name,
    feedUrl: row.feed_url,
    siteUrl: row.site_url,
    confidence: row.confidence ?? null,
    addedBy: row.added_by,
    addedVia: row.added_via,
    createdAt: row.created_at,
  }));
}

export async function listSoupSourcesByHandle(
  db: D1Database,
  handle: string,
): Promise<{ profile: DbSoupProfile; sources: SoupSourceRecord[] } | null> {
  const profile = await getSoupProfileByHandle(db, handle);
  if (!profile) return null;
  const sources = await listSoupSourcesByProfile(db, profile.id);
  return { profile, sources };
}

export async function listSoupProfilesByOwner(
  db: D1Database,
  ownerId: string,
): Promise<DbSoupProfile[]> {
  const result = await db
    .prepare("SELECT * FROM soup_profiles WHERE owner_id = ? ORDER BY created_at DESC")
    .bind(ownerId)
    .all<DbSoupProfile>();

  return result.results ?? [];
}

export async function upsertSoupSources(
  db: D1Database,
  profileId: string,
  sources: SoupSourceInput[],
  provenance: { addedBy: "agent" | "wizard" | "user"; addedVia: "mcp" | "web" | "api" },
): Promise<number> {
  let count = 0;

  for (const source of sources) {
    if (!source.feedUrl) continue;

    await db
      .prepare(
        `INSERT INTO soup_sources (
           id, profile_id, source_type, name, feed_url, site_url, confidence, added_by, added_via
         ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(profile_id, feed_url) DO UPDATE SET
           source_type = excluded.source_type,
           name = excluded.name,
           site_url = excluded.site_url,
           confidence = excluded.confidence,
           added_by = excluded.added_by,
           added_via = excluded.added_via`,
      )
      .bind(
        uuid(),
        profileId,
        source.sourceType,
        source.name ?? null,
        source.feedUrl,
        source.siteUrl ?? null,
        source.confidence ?? null,
        provenance.addedBy,
        provenance.addedVia,
      )
      .run();
    count++;
  }

  return count;
}

export async function deleteSoupSource(
  db: D1Database,
  profileId: string,
  feedUrl: string,
): Promise<boolean> {
  const result = await db
    .prepare("DELETE FROM soup_sources WHERE profile_id = ? AND feed_url = ?")
    .bind(profileId, feedUrl)
    .run();

  return result.success === true;
}
