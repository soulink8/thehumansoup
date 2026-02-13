import { describe, it, expect } from "vitest";
import { shouldSkipYouTubeShort } from "./sourceIndexer";

describe("shouldSkipYouTubeShort", () => {
  const youtubeFeed =
    "https://www.youtube.com/feeds/videos.xml?channel_id=abc123";

  it("skips short-form entries based on duration", () => {
    const result = shouldSkipYouTubeShort(youtubeFeed, {
      id: "1",
      title: "Quick update",
      durationSeconds: 45,
      link: "https://www.youtube.com/watch?v=abc",
    });

    expect(result).toBe(true);
  });

  it("keeps longer videos", () => {
    const result = shouldSkipYouTubeShort(youtubeFeed, {
      id: "2",
      title: "Long interview",
      durationSeconds: 900,
      link: "https://www.youtube.com/watch?v=def",
    });

    expect(result).toBe(false);
  });

  it("skips shorts markers when duration is missing", () => {
    const result = shouldSkipYouTubeShort(youtubeFeed, {
      id: "3",
      title: "Big idea #shorts",
      link: "https://www.youtube.com/watch?v=ghi",
    });

    expect(result).toBe(true);
  });

  it("skips direct youtube shorts URLs", () => {
    const result = shouldSkipYouTubeShort(youtubeFeed, {
      id: "5",
      title: "A short update",
      link: "https://www.youtube.com/shorts/abc123xyz",
    });

    expect(result).toBe(true);
  });

  it("skips mobile youtube shorts URLs", () => {
    const result = shouldSkipYouTubeShort(youtubeFeed, {
      id: "6",
      title: "Another short update",
      link: "https://m.youtube.com/shorts/abc123xyz",
    });

    expect(result).toBe(true);
  });

  it("does not apply shorts filtering to non-youtube feeds", () => {
    const result = shouldSkipYouTubeShort("https://example.com/feed.xml", {
      id: "4",
      title: "Announcement #shorts",
      durationSeconds: 30,
      link: "https://example.com/post",
    });

    expect(result).toBe(false);
  });
});
