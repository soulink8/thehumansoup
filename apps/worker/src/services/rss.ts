import { XMLParser } from "fast-xml-parser";

export interface ParsedFeedItem {
  id: string;
  title: string;
  link?: string;
  published?: string;
  description?: string;
  enclosureUrl?: string;
  thumbnail?: string;
  durationSeconds?: number;
}

export interface ParsedFeed {
  title: string;
  link?: string;
  image?: string;
  items: ParsedFeedItem[];
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: true,
  parseAttributeValue: false,
});

export function parseFeed(xml: string): ParsedFeed {
  const data = parser.parse(xml);

  if (data?.rss?.channel) {
    return parseRssChannel(data.rss.channel);
  }

  if (data?.feed) {
    return parseAtomFeed(data.feed);
  }

  throw new Error("Unsupported feed format");
}

function parseRssChannel(channel: any): ParsedFeed {
  const items = normalizeArray(channel.item).map((item) => normalizeRssItem(item));

  return {
    title: toText(channel.title) ?? "Untitled Feed",
    link: extractLink(channel.link),
    image: extractImageUrl(channel.image) ?? extractItunesImage(channel),
    items,
  };
}

function parseAtomFeed(feed: any): ParsedFeed {
  const entries = normalizeArray(feed.entry).map((entry) => normalizeAtomEntry(entry));

  return {
    title: toText(feed.title) ?? "Untitled Feed",
    link: extractAtomLink(feed.link),
    image: extractAtomLogo(feed),
    items: entries,
  };
}

function normalizeRssItem(item: any): ParsedFeedItem {
  const link = extractLink(item.link);
  const guid = toText(item.guid);
  const ytId = toText(item["yt:videoId"]);
  const id = ytId ?? guid ?? link ?? toText(item.title) ?? "unknown";
  const enclosureUrl = extractEnclosureUrl(item.enclosure);

  return {
    id,
    title: toText(item.title) ?? "Untitled",
    link,
    published: toText(item.pubDate) ?? toText(item["dc:date"]),
    description:
      toText(item["content:encoded"]) ??
      toText(item.description) ??
      toText(item.summary),
    enclosureUrl,
    thumbnail:
      extractThumbnail(item) ??
      (isLikelyImageUrl(enclosureUrl) ? enclosureUrl : undefined),
    durationSeconds: extractDurationSeconds(item),
  };
}

function normalizeAtomEntry(entry: any): ParsedFeedItem {
  const link = extractAtomLink(entry.link);
  const id = toText(entry.id) ?? link ?? toText(entry.title) ?? "unknown";
  const enclosureUrl = extractAtomEnclosure(entry.link);
  const enclosureImage = extractAtomImage(entry.link);

  return {
    id,
    title: toText(entry.title) ?? "Untitled",
    link,
    published: toText(entry.published) ?? toText(entry.updated),
    description: toText(entry.summary) ?? toText(entry.content),
    enclosureUrl,
    thumbnail:
      extractThumbnail(entry) ??
      enclosureImage ??
      (isLikelyImageUrl(enclosureUrl) ? enclosureUrl : undefined),
    durationSeconds: extractDurationSeconds(entry),
  };
}

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toText(value: unknown): string | undefined {
  if (value == null) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (typeof value === "object" && "#text" in (value as any)) {
    return toText((value as any)["#text"]);
  }
  return undefined;
}

function extractLink(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) {
    return extractLink(value[0]);
  }
  if (typeof value === "object" && "@_href" in (value as any)) {
    return String((value as any)["@_href"]);
  }
  return undefined;
}

function extractAtomLink(value: unknown): string | undefined {
  if (!value) return undefined;
  const links = normalizeArray(value as any);
  const preferred =
    links.find((link) => (link as any)?.["@_rel"] === "alternate") ?? links[0];
  return preferred ? extractLink(preferred) : undefined;
}

function extractAtomEnclosure(value: unknown): string | undefined {
  if (!value) return undefined;
  const links = normalizeArray(value as any);
  const enclosure = links.find((link) => (link as any)?.["@_rel"] === "enclosure");
  return enclosure ? extractLink(enclosure) : undefined;
}

function extractAtomImage(value: unknown): string | undefined {
  if (!value) return undefined;
  const links = normalizeArray(value as any);
  const imageLink = links.find((link) => {
    const rel = toText((link as any)?.["@_rel"])?.toLowerCase() ?? "";
    const type = toText((link as any)?.["@_type"])?.toLowerCase() ?? "";
    return rel === "enclosure" && type.startsWith("image/");
  });
  return imageLink ? extractLink(imageLink) : undefined;
}

function extractEnclosureUrl(enclosure: unknown): string | undefined {
  if (!enclosure) return undefined;
  if (Array.isArray(enclosure)) return extractEnclosureUrl(enclosure[0]);
  if (typeof enclosure === "object" && "@_url" in (enclosure as any)) {
    return String((enclosure as any)["@_url"]);
  }
  return undefined;
}

function extractThumbnail(item: any): string | undefined {
  const mediaThumb = item?.["media:thumbnail"];
  const mediaGroup = item?.["media:group"]?.["media:thumbnail"];
  const mediaContent = item?.["media:group"]?.["media:content"] ?? item?.["media:content"];
  const itunesImage = item?.["itunes:image"] ?? item?.["itunes:img"];

  return (
    extractMediaUrl(mediaThumb) ??
    extractMediaUrl(mediaGroup) ??
    extractImageMediaUrl(mediaContent) ??
    extractMediaUrl(itunesImage)
  );
}

function extractImageMediaUrl(value: unknown): string | undefined {
  if (!value) return undefined;
  const entries = normalizeArray(value as any);
  for (const entry of entries) {
    const type = toText((entry as any)?.["@_type"])?.toLowerCase() ?? "";
    const medium = toText((entry as any)?.["@_medium"])?.toLowerCase() ?? "";
    const url = extractMediaUrl(entry);
    if (!url) continue;
    if (type.startsWith("image/") || medium === "image" || isLikelyImageUrl(url)) {
      return url;
    }
  }
  return undefined;
}

function extractMediaUrl(value: unknown): string | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) return extractMediaUrl(value[0]);
  if (typeof value === "string") return value;
  if (typeof value === "object" && "@_url" in (value as any)) {
    return String((value as any)["@_url"]);
  }
  if (typeof value === "object" && "@_href" in (value as any)) {
    return String((value as any)["@_href"]);
  }
  return undefined;
}

function extractImageUrl(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "url" in (value as any)) {
    return toText((value as any).url);
  }
  return undefined;
}

function extractItunesImage(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === "object" && "itunes:image" in (value as any)) {
    return extractMediaUrl((value as any)["itunes:image"]);
  }
  return undefined;
}

function extractAtomLogo(feed: any): string | undefined {
  return toText(feed.logo) ?? toText(feed.icon);
}

function extractDurationSeconds(item: any): number | undefined {
  const ytDuration = item?.["media:group"]?.["yt:duration"] ?? item?.["yt:duration"];
  const ytSeconds = readDurationSecondsAttribute(ytDuration);
  if (ytSeconds !== undefined) return ytSeconds;

  const mediaDuration = item?.["media:group"]?.["media:content"] ?? item?.["media:content"];
  const mediaSeconds = readDurationSecondsAttribute(mediaDuration, "duration");
  if (mediaSeconds !== undefined) return mediaSeconds;

  const itunesDuration = toText(item?.["itunes:duration"]);
  return parseDurationSeconds(itunesDuration);
}

function readDurationSecondsAttribute(
  value: unknown,
  attrName = "seconds",
): number | undefined {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    for (const entry of value) {
      const result = readDurationSecondsAttribute(entry, attrName);
      if (result !== undefined) return result;
    }
    return undefined;
  }

  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return parseDurationSeconds(value);
  if (typeof value !== "object") return undefined;

  const record = value as Record<string, unknown>;
  const raw = record[`@_${attrName}`] ?? record[attrName];
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : undefined;
  if (typeof raw === "string") return parseDurationSeconds(raw);

  return undefined;
}

function parseDurationSeconds(value?: string): number | undefined {
  if (!value) return undefined;

  if (/^\d+$/.test(value)) {
    const seconds = Number.parseInt(value, 10);
    return Number.isFinite(seconds) ? seconds : undefined;
  }

  const parts = value.split(":").map((part) => Number.parseInt(part, 10));
  if (parts.some((part) => Number.isNaN(part))) return undefined;

  if (parts.length === 2) {
    return parts[0] * 60 + parts[1];
  }

  if (parts.length === 3) {
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  }

  return undefined;
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
