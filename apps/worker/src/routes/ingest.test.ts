import { describe, it, expect, beforeEach, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../lib/types";

vi.mock("../services/indexer", () => ({
  indexSite: vi.fn(),
}));

import { indexSite } from "../services/indexer";
import ingest from "./ingest";

describe("ingest routes", () => {
  let app: Hono<{ Bindings: Env }>;

  const mockEnv = {
    DB: {},
  } as Env;

  beforeEach(() => {
    vi.clearAllMocks();
    app = new Hono<{ Bindings: Env }>();
    app.route("/", ingest);
  });

  it("rejects missing site_url on ping", async () => {
    const res = await app.request(
      "/ingest/ping",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      },
      mockEnv
    );

    expect(res.status).toBe(400);
  });

  it("returns index result on ping", async () => {
    (indexSite as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      siteUrl: "https://example.com",
      status: "success",
      postsFound: 2,
      postsNew: 1,
      postsUpdated: 1,
      durationMs: 12,
    });

    const res = await app.request(
      "/ingest/ping",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site_url: "https://example.com" }),
      },
      mockEnv
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toEqual({
      status: "success",
      postsFound: 2,
      postsNew: 1,
      postsUpdated: 1,
      durationMs: 12,
    });
  });
});
