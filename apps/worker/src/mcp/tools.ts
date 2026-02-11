/**
 * MCP Tool Definitions
 *
 * These are the tools AI agents use to interact with the soup.
 * Each tool maps to a graph query, keeping the MCP layer thin.
 */

import {
  getCreators,
  getContent,
  getCreatorById,
  getCreatorByHandle,
  getCreatorByName,
  getContentByCreator,
  getFeed,
  getTrending,
  getStats,
} from "../services/graph";
import { getDemoSourceSet } from "../services/sourceIndexer";
import { hashEmail } from "../lib/me3";

// ── Tool Definitions ───────────────────────────────────────

export const TOOLS = [
  {
    name: "soup_discover",
    description:
      "Discover creators and content in the human soup. Search by topic, content type, or recency. Use this to find interesting people and content for your human.",
    inputSchema: {
      type: "object" as const,
      properties: {
        search_type: {
          type: "string",
          enum: ["creators", "content"],
          description: "Whether to search for creators or content",
        },
        topic: {
          type: "string",
          description: "Filter by topic (e.g. 'ai', 'startups', 'web-dev')",
        },
        content_type: {
          type: "string",
          enum: ["article", "note", "video", "audio", "image", "link"],
          description: "Filter by content format",
        },
        since: {
          type: "string",
          description: "ISO date - only results after this date",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 20, max 100)",
        },
      },
      required: ["search_type"],
    },
  },
  {
    name: "soup_feed",
    description:
      "Get a personalised feed of recent content from creators a human subscribes to. Returns content ordered by recency from their subscription graph.",
    inputSchema: {
      type: "object" as const,
      properties: {
        subscriber_id: {
          type: "string",
          description: "The subscriber's creator ID or email hash",
        },
        since: {
          type: "string",
          description: "ISO date - only content published after this date",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 50, max 200)",
        },
      },
      required: ["subscriber_id"],
    },
  },
  {
    name: "soup_profile",
    description:
      "Get a creator's full profile and their recent content. Use this to learn about a specific person in the soup.",
    inputSchema: {
      type: "object" as const,
      properties: {
        creator_id: {
          type: "string",
          description: "The creator's ID in the soup",
        },
      },
      required: ["creator_id"],
    },
  },
  {
    name: "soup_trending",
    description:
      "Get trending content across the soup. Returns recent content from high-trust creators, ordered by trust and recency.",
    inputSchema: {
      type: "object" as const,
      properties: {
        days: {
          type: "number",
          description: "Lookback period in days (default 7, max 30)",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 20, max 100)",
        },
      },
    },
  },
  {
    name: "soup_my_soup",
    description:
      "Get a personalised soup feed for a handle. Use this when a human asks for their custom soup digest.",
    inputSchema: {
      type: "object" as const,
      properties: {
        handle: {
          type: "string",
          description: "The handle to fetch (e.g. 'kieran')",
        },
        since: {
          type: "string",
          description: "ISO date - only content published after this date",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 50, max 200)",
        },
        content_type: {
          type: "string",
          enum: ["article", "note", "video", "audio", "image", "link"],
          description: "Filter by content format",
        },
      },
      required: ["handle"],
    },
  },
  {
    name: "soup_latest_from",
    description:
      "Get the latest content from a specific creator (by handle or name).",
    inputSchema: {
      type: "object" as const,
      properties: {
        source: {
          type: "string",
          description: "Creator handle or display name",
        },
        limit: {
          type: "number",
          description: "Max results to return (default 10, max 50)",
        },
        content_type: {
          type: "string",
          enum: ["article", "note", "video", "audio", "image", "link"],
          description: "Filter by content format",
        },
      },
      required: ["source"],
    },
  },
  {
    name: "soup_stats",
    description:
      "Get aggregate statistics about the human soup: creator count, content count, subscription count, and last crawl time.",
    inputSchema: {
      type: "object" as const,
      properties: {},
    },
  },
] as const;

// ── Tool Handlers ──────────────────────────────────────────

export async function handleTool(
  db: D1Database,
  name: string,
  args: Record<string, unknown>,
): Promise<{ content: Array<{ type: "text"; text: string }> }> {
  switch (name) {
    case "soup_discover": {
      const searchType = args.search_type as string;
      const topic = args.topic as string | undefined;
      const contentType = args.content_type as string | undefined;
      const since = args.since as string | undefined;
      const limit = Math.min((args.limit as number) ?? 20, 100);

      if (searchType === "creators") {
        const creators = await getCreators(db, { topic, limit });
        return text(
          JSON.stringify({ creators, count: creators.length }, null, 2),
        );
      } else {
        const content = await getContent(db, {
          topic,
          contentType,
          since,
          limit,
        });
        return text(
          JSON.stringify({ content, count: content.length }, null, 2),
        );
      }
    }

    case "soup_feed": {
      const subscriberId = args.subscriber_id as string;
      const since = args.since as string | undefined;
      const limit = Math.min((args.limit as number) ?? 50, 200);

      const feed = await getFeed(db, subscriberId, { since, limit });
      return text(JSON.stringify(feed, null, 2));
    }

    case "soup_profile": {
      const creatorId = args.creator_id as string;
      const creator = await getCreatorById(db, creatorId);
      if (!creator) {
        return text(JSON.stringify({ error: "Creator not found" }));
      }
      const content = await getContentByCreator(db, creatorId, 20);
      return text(JSON.stringify({ creator, content }, null, 2));
    }

    case "soup_trending": {
      const days = Math.min((args.days as number) ?? 7, 30);
      const limit = Math.min((args.limit as number) ?? 20, 100);
      const content = await getTrending(db, { days, limit });
      return text(JSON.stringify({ content, count: content.length }, null, 2));
    }

    case "soup_my_soup": {
      const handle = args.handle as string;
      const since = args.since as string | undefined;
      const limit = Math.min((args.limit as number) ?? 50, 200);
      const contentType = args.content_type as string | undefined;

      const subscriberHash = await hashEmail(`handle:${handle}`);
      const feed = await getFeed(db, handle, {
        since,
        limit,
        contentType,
        subscriberEmailHash: subscriberHash,
      });
      const sources = getDemoSourceSet(handle)?.sources ?? [];

      return text(
        JSON.stringify(
          {
            handle,
            items: feed.items,
            total: feed.total,
            since: feed.since,
            sources,
          },
          null,
          2,
        ),
      );
    }

    case "soup_latest_from": {
      const source = args.source as string;
      const limit = Math.min((args.limit as number) ?? 10, 50);
      const contentType = args.content_type as string | undefined;

      let creator =
        (await getCreatorByHandle(db, source)) ??
        (await getCreatorByName(db, source));

      if (!creator) {
        return text(JSON.stringify({ error: "Creator not found" }));
      }

      const content = await getContent(db, {
        creatorId: creator.id,
        contentType,
        limit,
      });

      return text(
        JSON.stringify(
          {
            creator,
            content,
            count: content.length,
          },
          null,
          2,
        ),
      );
    }

    case "soup_stats": {
      const stats = await getStats(db);
      return text(JSON.stringify(stats, null, 2));
    }

    default:
      return text(JSON.stringify({ error: `Unknown tool: ${name}` }));
  }
}

function text(content: string): {
  content: Array<{ type: "text"; text: string }>;
} {
  return { content: [{ type: "text", text: content }] };
}
