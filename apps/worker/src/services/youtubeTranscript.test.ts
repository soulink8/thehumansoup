import { afterEach, describe, expect, it, vi } from "vitest";
import {
  extractYouTubeVideoId,
  fetchYouTubeTranscript,
} from "./youtubeTranscript";

describe("extractYouTubeVideoId", () => {
  it("extracts from watch URLs", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/watch?v=dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("extracts from youtu.be URLs", () => {
    expect(extractYouTubeVideoId("https://youtu.be/dQw4w9WgXcQ")).toBe(
      "dQw4w9WgXcQ",
    );
  });

  it("extracts from shorts URLs", () => {
    expect(
      extractYouTubeVideoId("https://www.youtube.com/shorts/dQw4w9WgXcQ"),
    ).toBe("dQw4w9WgXcQ");
  });

  it("accepts direct 11-char video IDs", () => {
    expect(extractYouTubeVideoId("dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for invalid values", () => {
    expect(extractYouTubeVideoId("https://example.com/video")).toBeNull();
    expect(extractYouTubeVideoId("not-a-valid-id")).toBeNull();
  });
});

describe("fetchYouTubeTranscript", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("fetches and parses transcript text from preferred track", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("type=list")) {
        return new Response(
          `<transcript_list>
            <track id="0" lang_code="en" kind="asr" />
            <track id="1" lang_code="en" />
          </transcript_list>`,
          { status: 200 },
        );
      }

      return new Response(
        `<transcript>
          <text start="0.0" dur="1.0">Hello &amp; welcome</text>
          <text start="1.0" dur="1.0">to The Human Soup</text>
        </transcript>`,
        { status: 200 },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchYouTubeTranscript("dQw4w9WgXcQ", {
      timeoutMs: 100,
    });

    expect(result).toEqual({
      language: "en",
      text: "Hello & welcome to The Human Soup",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("falls back to direct english transcript request when track list is empty", async () => {
    const fetchMock = vi.fn(async (input: URL | RequestInfo) => {
      const url = String(input);
      if (url.includes("type=list")) {
        return new Response("<transcript_list></transcript_list>", { status: 200 });
      }

      return new Response(
        `<transcript><text start="0.0" dur="1.0">Fallback transcript</text></transcript>`,
        { status: 200 },
      );
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchYouTubeTranscript("dQw4w9WgXcQ", {
      timeoutMs: 100,
    });

    expect(result).toEqual({
      language: "en",
      text: "Fallback transcript",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("returns null when transcript cannot be fetched", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await fetchYouTubeTranscript("dQw4w9WgXcQ", {
      timeoutMs: 100,
    });

    expect(result).toBeNull();
  });
});
