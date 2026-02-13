import type { ContentResponse } from "../lib/types";

const DEFAULT_KEYWORDS_TO_SHOW = 3;

const STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "are",
  "as",
  "at",
  "be",
  "by",
  "for",
  "from",
  "give",
  "get",
  "how",
  "i",
  "im",
  "in",
  "into",
  "is",
  "it",
  "latest",
  "me",
  "my",
  "of",
  "on",
  "or",
  "that",
  "the",
  "this",
  "to",
  "up",
  "with",
  "you",
  "your",
]);

const BEHAVIOR_KEYWORDS = {
  listen: [
    "walk",
    "walking",
    "run",
    "running",
    "gym",
    "workout",
    "commute",
    "driving",
    "drive",
    "listen",
    "listening",
    "podcast",
    "audio",
  ],
  watch: [
    "watch",
    "watching",
    "video",
    "youtube",
    "couch",
    "evening",
    "tv",
    "screen",
  ],
  read: [
    "read",
    "reading",
    "article",
    "articles",
    "newsletter",
    "sunday",
    "morning",
    "relaxing",
    "learn",
    "learning",
    "study",
  ],
};

const INTENT_KEYWORDS = {
  latest: ["latest", "recent", "today", "this week", "new", "news", "update"],
  learn: ["learn", "learning", "understand", "goal", "skill", "research", "study"],
  entertainment: ["entertainment", "fun", "laugh", "chill", "relax", "enjoy"],
};

export type BehaviorMode = "listen" | "watch" | "read" | "mixed";
export type IntentMode = "latest" | "learn" | "entertainment" | "general";

export type TurnContext = {
  role: "user" | "assistant";
  content: string;
};

export type ServeRecommendation = {
  id: string;
  title: string;
  creatorName: string;
  creatorHandle: string;
  contentType: string;
  contentUrl: string;
  url: string;
  publishedAt: string | null;
  excerpt: string | null;
  media?: {
    url: string | null;
    thumbnail: string | null;
  };
  why: string;
  score: number;
  isFresh: boolean;
  keywords: string[];
};

export type ServeResult = {
  summary: string;
  recommendations: ServeRecommendation[];
  mode: {
    behavior: BehaviorMode;
    intent: IntentMode;
    preferredTypes: string[];
  };
  coverage: {
    windowDays: number;
    totalMatches: number;
    recentMatches: number;
    thin: boolean;
  };
  needsRefresh: boolean;
};

type InferredMode = {
  behavior: BehaviorMode;
  intent: IntentMode;
  preferredTypes: string[];
  terms: string[];
};

type ScoredRecommendation = ServeRecommendation;

export function buildServeResult(options: {
  prompt: string;
  items: ContentResponse[];
  days: number;
  limit: number;
  threadContext?: TurnContext[];
  refreshed?: boolean;
}): ServeResult {
  const {
    prompt,
    items,
    days,
    limit,
    threadContext = [],
    refreshed = false,
  } = options;
  const inferred = inferMode(prompt, threadContext);
  const now = Date.now();

  const scored = items
    .map((item) => scoreContentItem(item, inferred, days, now))
    .filter((item): item is ScoredRecommendation => item !== null)
    .sort((a, b) => b.score - a.score);

  const deduped = dedupeByUrl(scored);
  const recommendations = deduped.slice(0, Math.max(3, limit));

  const recentMatches = deduped.filter((item) => item.isFresh).length;
  const thin = recommendations.length < 3;
  const needsRefresh = !refreshed && (thin || recentMatches < 3);

  return {
    summary: buildSummary({
      prompt,
      recommendations,
      inferred,
      days,
      refreshed,
      needsRefresh,
    }),
    recommendations,
    mode: {
      behavior: inferred.behavior,
      intent: inferred.intent,
      preferredTypes: inferred.preferredTypes,
    },
    coverage: {
      windowDays: days,
      totalMatches: deduped.length,
      recentMatches,
      thin,
    },
    needsRefresh,
  };
}

export function inferMode(
  prompt: string,
  threadContext: TurnContext[] = [],
): InferredMode {
  const context = `${threadContext.map((turn) => turn.content).join(" ")} ${prompt}`
    .toLowerCase()
    .trim();

  const behaviorScores = {
    listen: keywordScore(context, BEHAVIOR_KEYWORDS.listen),
    watch: keywordScore(context, BEHAVIOR_KEYWORDS.watch),
    read: keywordScore(context, BEHAVIOR_KEYWORDS.read),
  };

  let behavior: BehaviorMode = "mixed";
  const bestBehavior = Object.entries(behaviorScores).sort((a, b) => b[1] - a[1])[0];
  if (bestBehavior && bestBehavior[1] > 0) {
    behavior = bestBehavior[0] as BehaviorMode;
  }

  let intent: IntentMode = "general";
  const intentScores = {
    latest: keywordScore(context, INTENT_KEYWORDS.latest),
    learn: keywordScore(context, INTENT_KEYWORDS.learn),
    entertainment: keywordScore(context, INTENT_KEYWORDS.entertainment),
  };
  const bestIntent = Object.entries(intentScores).sort((a, b) => b[1] - a[1])[0];
  if (bestIntent && bestIntent[1] > 0) {
    intent = bestIntent[0] as IntentMode;
  }

  const preferredTypes = preferredTypesForBehavior(behavior);

  return {
    behavior,
    intent,
    preferredTypes,
    terms: extractTerms(context),
  };
}

export function extractServeTerms(prompt: string): string[] {
  return extractTerms(prompt.toLowerCase().trim());
}

function scoreContentItem(
  item: ContentResponse,
  inferred: InferredMode,
  days: number,
  nowMs: number,
): ScoredRecommendation | null {
  const url = item.contentUrl?.trim() || item.media?.url?.trim() || "";
  if (!url) return null;

  const normalizedType = normalizeType(item.contentType);
  const typeScore = scoreType(normalizedType, inferred.preferredTypes);

  const corpus = [
    item.title,
    item.excerpt ?? "",
    item.creatorName,
    item.topics?.join(" ") ?? "",
    item.transcript?.text?.slice(0, 800) ?? "",
  ]
    .join(" ")
    .toLowerCase();

  const termMatches = inferred.terms.filter((term) => corpus.includes(term));
  const relevanceScore =
    inferred.terms.length > 0
      ? Math.min(1, termMatches.length / Math.min(8, inferred.terms.length))
      : 0.35;

  // Hard relevance gate: when the prompt has usable terms,
  // never include content that matches none of them.
  if (inferred.terms.length > 0 && termMatches.length === 0) {
    return null;
  }

  const freshness = scoreFreshness(item.publishedAt, days, nowMs);
  const freshnessScore = freshness.score;

  const weights = weightsForIntent(inferred.intent);
  let score =
    typeScore * weights.behavior +
    relevanceScore * weights.relevance +
    freshnessScore * weights.freshness;

  if (inferred.intent === "learn" && item.transcript?.text) {
    score += 0.03;
  }

  const keywordSlice = termMatches.slice(0, DEFAULT_KEYWORDS_TO_SHOW);
  const reasons: string[] = [typeReason(normalizedType, inferred.behavior)];
  if (keywordSlice.length > 0) {
    reasons.push(`matched ${keywordSlice.join(", ")}`);
  }
  reasons.push(
    freshness.isFresh
      ? `published in the last ${days} days`
      : `older but still relevant`,
  );

  return {
    id: item.id,
    title: item.title,
    creatorName: item.creatorName,
    creatorHandle: item.creatorHandle,
    contentType: normalizedType,
    contentUrl: url,
    url,
    publishedAt: item.publishedAt,
    excerpt: item.excerpt ?? null,
    media: {
      url: item.media?.url ?? null,
      thumbnail: item.media?.thumbnail ?? null,
    },
    why: reasons.slice(0, 2).join(" · "),
    score: Number(score.toFixed(4)),
    isFresh: freshness.isFresh,
    keywords: keywordSlice,
  };
}

function dedupeByUrl(items: ScoredRecommendation[]): ScoredRecommendation[] {
  const seen = new Set<string>();
  const deduped: ScoredRecommendation[] = [];
  for (const item of items) {
    if (seen.has(item.contentUrl)) continue;
    seen.add(item.contentUrl);
    deduped.push(item);
  }
  return deduped;
}

function buildSummary(options: {
  prompt: string;
  recommendations: ServeRecommendation[];
  inferred: InferredMode;
  days: number;
  refreshed: boolean;
  needsRefresh: boolean;
}): string {
  const { prompt, recommendations, inferred, days, refreshed, needsRefresh } = options;

  if (!recommendations.length) {
    if (needsRefresh) {
      return `I could not find strong matches for "${prompt}" yet. I am simmering your sources now and will update with fresher results.`;
    }
    return `I could not find strong matches for "${prompt}" in your soup right now.`;
  }

  const lead = recommendations[0];
  const secondaryTitles = recommendations
    .slice(1, 3)
    .map((item) => item.title);
  const secondary =
    secondaryTitles.length > 0
      ? secondaryTitles.join(" | ")
      : "no additional strong matches yet";

  const tone =
    inferred.intent === "latest"
      ? "latest"
      : inferred.intent === "learn"
        ? "learning-focused"
        : inferred.intent === "entertainment"
          ? "entertainment-focused"
          : "focused";

  const refreshNote = refreshed
    ? " Refreshed with newly ingested content."
    : needsRefresh
      ? " I am simmering for newer matches in parallel."
      : "";

  return `Here is a concise ${tone} pass for the last ${days} days: start with "${lead.title}" from ${lead.creatorName}. Next best: ${secondary}.${refreshNote}`;
}

function keywordScore(text: string, keywords: string[]): number {
  return keywords.reduce((sum, keyword) => (text.includes(keyword) ? sum + 1 : sum), 0);
}

function preferredTypesForBehavior(behavior: BehaviorMode): string[] {
  if (behavior === "listen") return ["audio", "video", "article"];
  if (behavior === "watch") return ["video", "audio", "article"];
  if (behavior === "read") return ["article", "audio", "video"];
  return ["video", "audio", "article"];
}

function extractTerms(text: string): string[] {
  const tokens = text.match(/[a-z0-9]{3,}/g) ?? [];
  const deduped = new Set<string>();
  for (const token of tokens) {
    if (STOP_WORDS.has(token)) continue;
    deduped.add(token);
    if (deduped.size >= 24) break;
  }
  return [...deduped];
}

function normalizeType(raw: string): string {
  const value = raw.trim().toLowerCase();
  if (value === "note" || value === "link" || value === "image") {
    return "article";
  }
  return value || "article";
}

function scoreType(contentType: string, preferredTypes: string[]): number {
  const index = preferredTypes.indexOf(contentType);
  if (index === 0) return 1;
  if (index === 1) return 0.72;
  if (index === 2) return 0.48;
  return 0.32;
}

function scoreFreshness(
  publishedAt: string | null,
  days: number,
  nowMs: number,
): { score: number; isFresh: boolean } {
  if (!publishedAt) {
    return { score: 0.2, isFresh: false };
  }

  const publishedMs = Date.parse(publishedAt);
  if (Number.isNaN(publishedMs)) {
    return { score: 0.2, isFresh: false };
  }

  const ageDays = Math.max(0, (nowMs - publishedMs) / (1000 * 60 * 60 * 24));
  if (ageDays <= days) {
    return {
      score: Math.max(0.65, 1 - (ageDays / Math.max(1, days)) * 0.35),
      isFresh: true,
    };
  }

  const ageOver = ageDays - days;
  const decay = ageOver / Math.max(1, days * 3);
  return {
    score: Math.max(0.05, 0.65 - decay),
    isFresh: false,
  };
}

function weightsForIntent(intent: IntentMode): {
  behavior: number;
  relevance: number;
  freshness: number;
} {
  if (intent === "latest") {
    return { behavior: 0.25, relevance: 0.35, freshness: 0.4 };
  }
  if (intent === "learn") {
    return { behavior: 0.3, relevance: 0.5, freshness: 0.2 };
  }
  if (intent === "entertainment") {
    return { behavior: 0.45, relevance: 0.35, freshness: 0.2 };
  }
  return { behavior: 0.35, relevance: 0.4, freshness: 0.25 };
}

function typeReason(contentType: string, behavior: BehaviorMode): string {
  if (behavior === "listen" && contentType === "audio") {
    return "audio-first fit for listening";
  }
  if (behavior === "watch" && contentType === "video") {
    return "video-first fit for watching";
  }
  if (behavior === "read" && contentType === "article") {
    return "article-first fit for reading";
  }
  return `good ${contentType} format match`;
}
