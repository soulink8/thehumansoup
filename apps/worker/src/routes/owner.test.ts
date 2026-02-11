import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Env } from "../lib/types";

vi.mock("../services/graph", () => ({
  getCreatorBySiteUrl: vi.fn(),
}));

vi.mock("../services/indexer", () => ({
  indexSite: vi.fn(),
}));

vi.mock("../lib/me3", () => ({
  normalizeUrl: vi.fn((url: string) => url),
}));

import { getCreatorBySiteUrl } from "../services/graph";
import { indexSite } from "../services/indexer";
import owner from "./owner";

describe("owner routes", () => {
  let app: Hono<{ Bindings: Env }>;

  type OwnerResponse = {
    handle?: string;
    name?: string;
    siteUrl?: string;
    error?: string;
  };

  const mockEnv = {
    DB: {},
    SOUP_OWNER_SITE_URL: "https://kieran.me",
  } as Env;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono<{ Bindings: Env }>();
    app.route("/", owner);
  });

  describe("GET /owner", () => {
    it("returns 500 when SOUP_OWNER_SITE_URL is not configured", async () => {
      const envWithoutOwner = { ...mockEnv, SOUP_OWNER_SITE_URL: undefined };

      const res = await app.request("/owner", { method: "GET" }, envWithoutOwner);
      const json = (await res.json()) as OwnerResponse;

      expect(res.status).toBe(500);
      expect(json.error).toContain("SOUP_OWNER_SITE_URL");
    });

    it("returns owner when creator exists", async () => {
      (getCreatorBySiteUrl as ReturnType<typeof vi.fn>).mockResolvedValue({
        handle: "kieran",
        name: "Kieran",
        siteUrl: "https://kieran.me",
      });

      const res = await app.request("/owner", { method: "GET" }, mockEnv);
      const json = (await res.json()) as OwnerResponse;

      expect(res.status).toBe(200);
      expect(json.handle).toBe("kieran");
      expect(json.name).toBe("Kieran");
      expect(json.siteUrl).toBe("https://kieran.me");
    });

    it("returns 404 when owner not found after indexing", async () => {
      (getCreatorBySiteUrl as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce(null);
      (indexSite as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "success",
        postsFound: 0,
      });

      const res = await app.request("/owner", { method: "GET" }, mockEnv);
      const json = (await res.json()) as OwnerResponse;

      expect(res.status).toBe(404);
      expect(json.error).toBe("Owner not found");
    });

    it("indexes site and retries when owner not found initially", async () => {
      (getCreatorBySiteUrl as ReturnType<typeof vi.fn>)
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          handle: "kieran",
          name: "Kieran",
          siteUrl: "https://kieran.me",
        });
      (indexSite as ReturnType<typeof vi.fn>).mockResolvedValue({
        status: "success",
        postsFound: 1,
      });

      const res = await app.request("/owner", { method: "GET" }, mockEnv);
      const json = (await res.json()) as OwnerResponse;

      expect(res.status).toBe(200);
      expect(json.handle).toBe("kieran");
      expect(indexSite).toHaveBeenCalledTimes(1);
    });
  });
});
