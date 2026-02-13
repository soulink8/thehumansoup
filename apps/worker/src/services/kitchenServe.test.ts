import { describe, expect, it } from "vitest";
import { buildServeResult, inferMode } from "./kitchenServe";
import type { ContentResponse } from "../lib/types";

const now = Date.now();

function daysAgo(days: number): string {
  return new Date(now - days * 24 * 60 * 60 * 1000).toISOString();
}

const items: ContentResponse[] = [
  {
    id: "a1",
    creatorId: "c1",
    creatorHandle: "creator-one",
    creatorName: "Creator One",
    slug: "audio-1",
    title: "AI trends this week for founders",
    excerpt: "Latest AI updates and practical takeaways.",
    contentType: "audio",
    contentUrl: "https://example.com/audio",
    publishedAt: daysAgo(1),
    topics: ["ai", "startups"],
  },
  {
    id: "v1",
    creatorId: "c2",
    creatorHandle: "creator-two",
    creatorName: "Creator Two",
    slug: "video-1",
    title: "Deep dive: building with agents",
    excerpt: "Long-form walkthrough.",
    contentType: "video",
    contentUrl: "https://example.com/video",
    publishedAt: daysAgo(2),
    topics: ["ai", "agents"],
  },
  {
    id: "r1",
    creatorId: "c3",
    creatorHandle: "creator-three",
    creatorName: "Creator Three",
    slug: "article-1",
    title: "Reference guide to retrieval systems",
    excerpt: "Detailed written guide.",
    contentType: "article",
    contentUrl: "https://example.com/article",
    publishedAt: daysAgo(10),
    topics: ["retrieval"],
  },
];

describe("inferMode", () => {
  it("prefers listening behavior for walk/run/gym prompts", () => {
    const mode = inferMode("I am going for a run. give me the latest ai updates.");
    expect(mode.behavior).toBe("listen");
    expect(mode.intent).toBe("latest");
    expect(mode.preferredTypes[0]).toBe("audio");
  });

  it("detects read behavior when prompt asks for reading", () => {
    const mode = inferMode("Sunday morning and I want articles to read.");
    expect(mode.behavior).toBe("read");
    expect(mode.preferredTypes[0]).toBe("article");
  });
});

describe("buildServeResult", () => {
  it("ranks by behavior + relevance + freshness", () => {
    const result = buildServeResult({
      prompt: "I am at the gym, give me latest AI updates",
      items,
      days: 7,
      limit: 3,
    });

    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0]?.contentType).toBe("audio");
    expect(result.coverage.windowDays).toBe(7);
    expect(result.summary.length).toBeGreaterThan(0);
  });

  it("hard-gates unrelated content when no terms match", () => {
    const result = buildServeResult({
      prompt: "Give me the latest on openclaw",
      items,
      days: 7,
      limit: 3,
    });

    expect(result.recommendations).toHaveLength(0);
    expect(result.needsRefresh).toBe(true);
  });

  it("marks thin coverage when fewer than 3 links exist", () => {
    const result = buildServeResult({
      prompt: "latest on AI",
      items: [items[0]],
      days: 7,
      limit: 3,
    });

    expect(result.coverage.thin).toBe(true);
    expect(result.needsRefresh).toBe(true);
  });
});
