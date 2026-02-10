import { describe, it, expect, vi } from "vitest";
import type { Me3Profile } from "me3-protocol";

vi.mock("../lib/me3", () => ({
  fetchMe3Profile: vi.fn(),
  buildContentUrl: (siteUrl: string, slug: string) =>
    `${siteUrl}/blog/${slug}`,
  uuid: vi.fn(() => "uuid-1"),
}));

import { fetchMe3Profile } from "../lib/me3";
import { indexSite } from "./indexer";

function createMockDb() {
  let contentInsertArgs: unknown[] | null = null;

  const db = {
    contentInsertArgs,
    prepare: vi.fn((sql: string) => {
      if (sql.startsWith("SELECT id, me_json_hash FROM creators")) {
        return {
          bind: () => ({
            first: vi.fn().mockResolvedValue(null),
          }),
        };
      }

      if (sql.startsWith("INSERT INTO creators")) {
        return { bind: () => ({ run: vi.fn().mockResolvedValue({}) }) };
      }

      if (sql.startsWith("SELECT id, title, excerpt")) {
        return {
          bind: () => ({
            first: vi.fn().mockResolvedValue(null),
          }),
        };
      }

      if (sql.startsWith("INSERT INTO content")) {
        return {
          bind: (...args: unknown[]) => {
            contentInsertArgs = args;
            return { run: vi.fn().mockResolvedValue({}) };
          },
        };
      }

      if (sql.startsWith("UPDATE creators SET post_count")) {
        return { bind: () => ({ run: vi.fn().mockResolvedValue({}) }) };
      }

      if (sql.startsWith("SELECT COUNT(*) as count FROM subscriptions")) {
        return {
          bind: () => ({ first: vi.fn().mockResolvedValue({ count: 0 }) }),
        };
      }

      if (sql.startsWith("SELECT first_seen_at FROM creators")) {
        return {
          bind: () => ({
            first: vi.fn().mockResolvedValue({
              first_seen_at: new Date().toISOString(),
            }),
          }),
        };
      }

      if (sql.startsWith("UPDATE creators SET trust_score")) {
        return { bind: () => ({ run: vi.fn().mockResolvedValue({}) }) };
      }

      if (sql.startsWith("INSERT INTO crawl_log")) {
        return { bind: () => ({ run: vi.fn().mockResolvedValue({}) }) };
      }

      return { bind: () => ({ run: vi.fn(), first: vi.fn(), all: vi.fn() }) };
    }),
    get contentArgs() {
      return contentInsertArgs;
    },
  };

  return db;
}

describe("indexer", () => {
  it("stores video media fields on insert", async () => {
    const profile: Me3Profile = {
      version: "0.1",
      name: "Video Tester",
      posts: [
        {
          slug: "demo-video",
          title: "Demo Video",
          file: "blog/demo-video.md",
          type: "video",
          media: {
            url: "https://player.example.com/vid",
            duration: 120,
            thumbnail: "https://player.example.com/thumb.jpg",
          },
          publishedAt: "2026-02-10T10:00:00Z",
          excerpt: "A demo video post.",
        },
      ],
    };

    (fetchMe3Profile as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      success: true,
      profile,
      raw: "{}",
      hash: "abc",
    });

    const db = createMockDb();
    const result = await indexSite(db as any, "https://example.com");

    expect(result.status).toBe("success");
    expect(result.postsFound).toBe(1);
    expect(result.postsNew).toBe(1);

    const args = db.contentArgs as unknown[];
    expect(args).toBeTruthy();
    expect(args[2]).toBe("demo-video");
    expect(args[5]).toBe("video");
    expect(args[9]).toBe("https://player.example.com/vid");
    expect(args[10]).toBe(120);
    expect(args[11]).toBe("https://player.example.com/thumb.jpg");
  });
});
