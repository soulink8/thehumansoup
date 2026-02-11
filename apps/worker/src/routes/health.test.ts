import { describe, it, expect, vi, beforeEach } from "vitest";
import { Hono } from "hono";
import type { Env } from "../lib/types";

vi.mock("../services/graph", () => ({
  getStats: vi.fn(),
}));

import { getStats } from "../services/graph";
import health from "./health";

describe("health routes", () => {
  let app: Hono<{ Bindings: Env }>;

  const mockEnv = {
    DB: {},
  } as Env;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono<{ Bindings: Env }>();
    app.route("/", health);
  });

  describe("GET /health", () => {
    it("returns ok status and service info", async () => {
      const res = await app.request("/health", { method: "GET" }, mockEnv);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("ok");
      expect(json.service).toBe("thehumansoup");
      expect(json.version).toBe("0.1.0");
      expect(json.timestamp).toBeDefined();
    });
  });

  describe("GET /stats", () => {
    it("returns stats from graph service", async () => {
      (getStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        creators: 10,
        content: 100,
        subscriptions: 5,
        topics: 3,
        lastCrawl: "2026-02-11T10:00:00Z",
      });

      const res = await app.request("/stats", { method: "GET" }, mockEnv);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.creators).toBe(10);
      expect(json.content).toBe(100);
      expect(json.subscriptions).toBe(5);
      expect(json.topics).toBe(3);
      expect(json.lastCrawl).toBe("2026-02-11T10:00:00Z");
    });

    it("returns empty stats when graph returns zeros", async () => {
      (getStats as ReturnType<typeof vi.fn>).mockResolvedValue({
        creators: 0,
        content: 0,
        subscriptions: 0,
        topics: 0,
        lastCrawl: null,
      });

      const res = await app.request("/stats", { method: "GET" }, mockEnv);
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.creators).toBe(0);
      expect(json.lastCrawl).toBeNull();
    });
  });
});
