import { XMLParser } from "fast-xml-parser";

export interface ParsedFeedItem {
  id: string;
  title: string;
  link?: string;
  published?: string;
  description?: string;
  enclosureUrl?: string;
  thumbnail?: string;
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

  return {
    id,
    title: toText(item.title) ?? "Untitled",
    link,
    published: toText(item.pubDate) ?? toText(item["dc:date"]),
    description:
      toText(item["content:encoded"]) ??
      toText(item.description) ??
      toText(item.summary),
    enclosureUrl: extractEnclosureUrl(item.enclosure),
    thumbnail: extractThumbnail(item),
  };
}

function normalizeAtomEntry(entry: any): ParsedFeedItem {
  const link = extractAtomLink(entry.link);
  const id = toText(entry.id) ?? link ?? toText(entry.title) ?? "unknown";

  return {
    id,
    title: toText(entry.title) ?? "Untitled",
    link,
    published: toText(entry.published) ?? toText(entry.updated),
    description: toText(entry.summary) ?? toText(entry.content),
    enclosureUrl: extractAtomEnclosure(entry.link),
    thumbnail: extractThumbnail(entry),
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
  const itunesImage = item?.["itunes:image"] ?? item?.["itunes:img"];

  return (
    extractMediaUrl(mediaThumb) ??
    extractMediaUrl(mediaGroup) ??
    extractMediaUrl(itunesImage)
  );
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
