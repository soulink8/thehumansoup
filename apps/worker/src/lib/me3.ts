/**
 * me3 Protocol Helpers
 *
 * Fetches and parses me.json files from me3 sites.
 * The me.json is the source of truth -- the soup only indexes references.
 */

import type { Me3Profile } from "me3-protocol";

export interface FetchResult {
  success: boolean;
  profile?: Me3Profile;
  raw?: string;
  hash?: string;
  error?: string;
}

/**
 * Fetch and parse a me.json from a site URL.
 * Returns the parsed profile, raw JSON string, and a hash for change detection.
 */
export async function fetchMe3Profile(siteUrl: string): Promise<FetchResult> {
  const url = normalizeUrl(siteUrl);
  const meJsonUrl = `${url}/me.json`;

  try {
    const response = await fetch(meJsonUrl, {
      headers: {
        Accept: "application/json",
        "User-Agent": "TheHumanSoup/0.1 (content indexer)",
      },
      // 10 second timeout
      signal: AbortSignal.timeout(10_000),
    });

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    const raw = await response.text();

    // Parse JSON
    let data: unknown;
    try {
      data = JSON.parse(raw);
    } catch {
      return { success: false, error: "Invalid JSON in me.json" };
    }

    // Basic validation: must have version and name at minimum
    const profile = data as Me3Profile;
    if (!profile.version || !profile.name) {
      return {
        success: false,
        error: "Invalid me3 profile: missing version or name",
      };
    }

    // Hash for change detection
    const hash = await hashString(raw);

    return { success: true, profile, raw, hash };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown fetch error";
    return { success: false, error: message };
  }
}

/**
 * Normalize a site URL to a consistent format (no trailing slash).
 */
export function normalizeUrl(url: string): string {
  let normalized = url.trim();
  if (!normalized.startsWith("http")) {
    normalized = `https://${normalized}`;
  }
  // Remove trailing slash
  return normalized.replace(/\/+$/, "");
}

/**
 * Build the full content URL for a post on a me3 site.
 */
export function buildContentUrl(siteUrl: string, slug: string): string {
  return `${normalizeUrl(siteUrl)}/blog/${slug}`;
}

/**
 * Generate a SHA-256 hash of a string (for change detection).
 */
async function hashString(str: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(str);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Generate a UUID v4.
 */
export function uuid(): string {
  return crypto.randomUUID();
}

/**
 * Hash an email address for GDPR-compliant storage.
 */
export async function hashEmail(email: string): Promise<string> {
  return hashString(email.toLowerCase().trim());
}
