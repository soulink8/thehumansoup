import { XMLParser } from "fast-xml-parser";

const YOUTUBE_TIMEDTEXT_URL = "https://www.youtube.com/api/timedtext";
const MAX_TRANSCRIPT_CHARS = 50_000;

interface CaptionTrack {
  langCode: string;
  kind?: string;
  name?: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
  parseTagValue: true,
  parseAttributeValue: false,
});

export interface YouTubeTranscript {
  language: string;
  text: string;
}

export function extractYouTubeVideoId(value?: string): string | null {
  if (!value) return null;
  const normalized = value.trim();
  if (!normalized) return null;

  if (/^[a-zA-Z0-9_-]{11}$/.test(normalized)) {
    return normalized;
  }

  try {
    const url = new URL(normalized);
    const host = url.hostname.toLowerCase();

    if (
      host === "youtube.com" ||
      host === "www.youtube.com" ||
      host === "m.youtube.com"
    ) {
      const watchId = url.searchParams.get("v");
      if (watchId && /^[a-zA-Z0-9_-]{11}$/.test(watchId)) return watchId;

      const pathParts = url.pathname.split("/").filter(Boolean);
      if (pathParts[0] === "shorts" && pathParts[1]) {
        const shortsId = pathParts[1];
        if (/^[a-zA-Z0-9_-]{11}$/.test(shortsId)) return shortsId;
      }
    }

    if (host === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      if (id && /^[a-zA-Z0-9_-]{11}$/.test(id)) return id;
    }
  } catch {
    return null;
  }

  return null;
}

export async function fetchYouTubeTranscript(
  videoId: string,
  options: { timeoutMs?: number } = {},
): Promise<YouTubeTranscript | null> {
  if (!/^[a-zA-Z0-9_-]{11}$/.test(videoId)) return null;
  const timeoutMs = options.timeoutMs ?? 8_000;

  const tracksXml = await fetchTimedTextXml(
    {
      type: "list",
      v: videoId,
    },
    timeoutMs,
  );

  const tracks = parseCaptionTracks(tracksXml ?? "");
  const chosenTrack = selectBestTrack(tracks);

  if (chosenTrack) {
    const xml = await fetchTimedTextXml(
      {
        v: videoId,
        lang: chosenTrack.langCode,
        ...(chosenTrack.kind ? { kind: chosenTrack.kind } : {}),
        ...(chosenTrack.name ? { name: chosenTrack.name } : {}),
      },
      timeoutMs,
    );

    const text = parseTranscriptText(xml ?? "");
    if (text) {
      return {
        language: chosenTrack.langCode,
        text,
      };
    }
  }

  // Fallback: attempt English auto-captions directly.
  const fallbackXml = await fetchTimedTextXml(
    {
      v: videoId,
      lang: "en",
    },
    timeoutMs,
  );

  const fallbackText = parseTranscriptText(fallbackXml ?? "");
  if (!fallbackText) return null;

  return {
    language: "en",
    text: fallbackText,
  };
}

async function fetchTimedTextXml(
  params: Record<string, string>,
  timeoutMs: number,
): Promise<string | null> {
  const query = new URLSearchParams(params).toString();
  const url = `${YOUTUBE_TIMEDTEXT_URL}?${query}`;

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "application/xml,text/xml",
        "User-Agent": "TheHumanSoup/0.1 (transcript fetcher)",
      },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) {
      response.body?.cancel();
      return null;
    }
    return await response.text();
  } catch {
    return null;
  }
}

function parseCaptionTracks(xml: string): CaptionTrack[] {
  if (!xml) return [];

  try {
    const data = parser.parse(xml);
    const rawTracks = data?.transcript_list?.track;
    const tracks = normalizeArray(rawTracks);
    const parsed: CaptionTrack[] = [];

    for (const track of tracks) {
      const langCode = toText(track?.["@_lang_code"]);
      if (!langCode) continue;
      parsed.push({
        langCode,
        kind: toText(track?.["@_kind"]) ?? undefined,
        name: toText(track?.["@_name"]) ?? undefined,
      });
    }
    return parsed;
  } catch {
    return [];
  }
}

function selectBestTrack(tracks: CaptionTrack[]): CaptionTrack | null {
  if (!tracks.length) return null;

  let best: CaptionTrack | null = null;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const track of tracks) {
    const score = scoreTrack(track);
    if (score > bestScore) {
      best = track;
      bestScore = score;
    }
  }

  return best;
}

function scoreTrack(track: CaptionTrack): number {
  const lang = track.langCode.toLowerCase();
  const kind = (track.kind ?? "").toLowerCase();
  const isAuto = kind === "asr";
  const isEnglish = lang === "en" || lang.startsWith("en-");

  if (isEnglish && !isAuto) return 100;
  if (isEnglish && isAuto) return 90;
  if (!isEnglish && !isAuto) return 70;
  return 60;
}

function parseTranscriptText(xml: string): string | null {
  if (!xml) return null;

  try {
    const data = parser.parse(xml);
    const rawNodes = normalizeArray(data?.transcript?.text);
    if (!rawNodes.length) return null;

    const chunks: string[] = [];
    for (const node of rawNodes) {
      const raw = toText(node?.["#text"] ?? node);
      if (!raw) continue;
      const decoded = decodeHtmlEntities(raw).replace(/\s+/g, " ").trim();
      if (decoded) chunks.push(decoded);
    }

    const joined = chunks.join(" ").replace(/\s+/g, " ").trim();
    if (!joined) return null;

    return joined.length > MAX_TRANSCRIPT_CHARS
      ? `${joined.slice(0, MAX_TRANSCRIPT_CHARS - 3)}...`
      : joined;
  } catch {
    return null;
  }
}

function normalizeArray<T>(value: T | T[] | undefined): T[] {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function toText(value: unknown): string | null {
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return null;
}

function decodeHtmlEntities(value: string): string {
  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    const named: Record<string, string> = {
      amp: "&",
      lt: "<",
      gt: ">",
      quot: "\"",
      apos: "'",
      nbsp: " ",
    };

    if (entity in named) {
      return named[entity];
    }

    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }

    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : match;
    }

    return match;
  });
}
