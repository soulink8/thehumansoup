export interface SourceCandidate {
  name: string;
  type: "video" | "audio" | "article";
  feedUrl: string;
  siteUrl?: string;
  confidence: number;
}

export async function discoverSources(
  query: string,
  apiKey: string,
): Promise<SourceCandidate[]> {
  if (!apiKey) {
    throw new Error("BRAVE_SEARCH_API_KEY is not configured");
  }

  const searchUrl = new URL("https://api.search.brave.com/res/v1/web/search");
  searchUrl.searchParams.set("q", query);
  searchUrl.searchParams.set("count", "10");

  const response = await fetch(searchUrl.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
    signal: AbortSignal.timeout(10_000),
  });

  if (!response.ok) {
    throw new Error(`Brave Search failed (${response.status})`);
  }

  const data = (await response.json()) as {
    web?: { results?: Array<{ title?: string; url?: string; description?: string }> };
  };

  const results = data.web?.results ?? [];

  const seen = new Set<string>();
  const candidates: SourceCandidate[] = [];

  for (const result of results) {
    const url = result.url;
    if (!url) continue;
    if (seen.has(url)) continue;
    seen.add(url);
    const discovered = await inferFeedsFromUrl(url, result.title);
    for (const candidate of discovered) {
      const key = `${candidate.feedUrl}`;
      if (seen.has(key)) continue;
      seen.add(key);
      candidates.push(candidate);
    }
  }

  return candidates.slice(0, 12);
}

async function inferFeedsFromUrl(
  url: string,
  title?: string,
): Promise<SourceCandidate[]> {
  const candidates: SourceCandidate[] = [];
  const normalized = normalizeUrl(url);
  const nameHint = title?.split(" - ")[0]?.trim() || title?.trim();

  if (normalized.includes("youtube.com/channel/")) {
    const channelId = normalized.split("youtube.com/channel/")[1]?.split("/")[0];
    if (channelId) {
      candidates.push({
        name: nameHint || "YouTube Channel",
        type: "video",
        feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
        siteUrl: normalized,
        confidence: 0.85,
      });
      return candidates;
    }
  }

  if (normalized.includes("youtube.com/@")) {
    const channelId = await resolveYouTubeChannelId(normalized);
    if (channelId) {
      candidates.push({
        name: nameHint || "YouTube Channel",
        type: "video",
        feedUrl: `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`,
        siteUrl: normalized,
        confidence: 0.75,
      });
      return candidates;
    }
  }

  if (normalized.endsWith(".rss") || normalized.endsWith(".xml")) {
    candidates.push({
      name: nameHint || "RSS Feed",
      type: inferTypeFromUrl(normalized),
      feedUrl: normalized,
      siteUrl: normalized,
      confidence: 0.9,
    });
    return candidates;
  }

  if (normalized.includes(".substack.com")) {
    const origin = new URL(normalized).origin;
    candidates.push({
      name: nameHint || "Substack",
      type: "article",
      feedUrl: `${origin}/feed`,
      siteUrl: origin,
      confidence: 0.8,
    });
  }

  if (normalized.includes("medium.com/")) {
    const mediumFeed = buildMediumFeed(normalized);
    if (mediumFeed) {
      candidates.push({
        name: nameHint || "Medium",
        type: "article",
        feedUrl: mediumFeed,
        siteUrl: normalized,
        confidence: 0.75,
      });
    }
  }

  const rssLink = await fetchRssLink(normalized);
  if (rssLink) {
    candidates.push({
      name: nameHint || "Site RSS",
      type: inferTypeFromUrl(rssLink),
      feedUrl: rssLink,
      siteUrl: normalized,
      confidence: 0.7,
    });
  } else if (normalized.includes("podcast") || normalized.includes("feed")) {
    candidates.push({
      name: nameHint || "Podcast",
      type: "audio",
      feedUrl: normalized.endsWith("/feed") ? normalized : `${normalized.replace(/\/$/, "")}/feed`,
      siteUrl: normalized,
      confidence: 0.6,
    });
  }

  return candidates;
}

async function fetchRssLink(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    return extractRssFromHtml(html, url);
  } catch {
    return null;
  }
}

function extractRssFromHtml(html: string, baseUrl: string): string | null {
  const regex =
    /<link[^>]+rel=["']alternate["'][^>]+type=["']application\/(rss|atom)\+xml["'][^>]+>/gi;
  const match = regex.exec(html);
  if (!match) return null;
  const hrefMatch = match[0].match(/href=["']([^"']+)["']/i);
  if (!hrefMatch) return null;
  const href = hrefMatch[1];
  try {
    return new URL(href, baseUrl).toString();
  } catch {
    return href;
  }
}

async function resolveYouTubeChannelId(url: string): Promise<string | null> {
  try {
    const response = await fetch(url, {
      headers: { Accept: "text/html" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return null;
    const html = await response.text();
    const match =
      html.match(/"channelId":"(UC[a-zA-Z0-9_-]+)"/) ??
      html.match(/"browseId":"(UC[a-zA-Z0-9_-]+)"/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

function inferTypeFromUrl(url: string): "video" | "audio" | "article" {
  const lower = url.toLowerCase();
  if (lower.includes("youtube.com")) return "video";
  if (
    lower.includes("podcast") ||
    lower.includes("megaphone") ||
    lower.includes("simplecast") ||
    lower.includes("fireside") ||
    lower.includes("spreaker") ||
    lower.includes("rss")
  ) {
    return "audio";
  }
  return "article";
}

function buildMediumFeed(url: string): string | null {
  try {
    const parsed = new URL(url);
    if (!parsed.pathname || parsed.pathname === "/") return null;
    const path = parsed.pathname.replace(/\/$/, "");
    return `https://medium.com/feed${path}`;
  } catch {
    return null;
  }
}

function normalizeUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http")) return url;
  return `https://${url}`;
}
