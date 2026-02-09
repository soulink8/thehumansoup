/**
 * MCP Server
 *
 * Implements the Model Context Protocol over Server-Sent Events (SSE).
 * This is the primary interface for AI agents to interact with the soup.
 *
 * Transport: SSE (Streamable HTTP) per MCP spec
 * Endpoint: POST /mcp
 */

import { Hono } from "hono";
import type { Env } from "../lib/types";
import { TOOLS, handleTool } from "./tools";

const mcp = new Hono<{ Bindings: Env }>();

/**
 * POST /mcp
 * MCP Streamable HTTP transport.
 * Handles JSON-RPC messages from AI agents.
 */
mcp.post("/mcp", async (c) => {
  let body: JsonRpcRequest;
  try {
    body = await c.req.json<JsonRpcRequest>();
  } catch {
    return c.json(jsonRpcError(null, -32700, "Parse error"), 400);
  }

  const { method, params, id } = body;

  switch (method) {
    case "initialize":
      return c.json(
        jsonRpcResult(id, {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
          },
          serverInfo: {
            name: "thehumansoup",
            version: "0.1.0",
          },
        })
      );

    case "notifications/initialized":
      // Acknowledgement, no response needed for notifications
      return c.json(jsonRpcResult(id, {}));

    case "tools/list":
      return c.json(
        jsonRpcResult(id, {
          tools: TOOLS,
        })
      );

    case "tools/call": {
      const toolName = (params as { name: string; arguments?: Record<string, unknown> })?.name;
      const toolArgs = (params as { name: string; arguments?: Record<string, unknown> })?.arguments ?? {};

      if (!toolName) {
        return c.json(jsonRpcError(id, -32602, "Missing tool name"));
      }

      const validToolNames = TOOLS.map((t) => t.name) as string[];
      if (!validToolNames.includes(toolName)) {
        return c.json(jsonRpcError(id, -32602, `Unknown tool: ${toolName}`));
      }

      try {
        const result = await handleTool(c.env.DB, toolName, toolArgs);
        return c.json(jsonRpcResult(id, result));
      } catch (error) {
        const message = error instanceof Error ? error.message : "Tool execution failed";
        return c.json(jsonRpcError(id, -32603, message));
      }
    }

    default:
      return c.json(jsonRpcError(id, -32601, `Method not found: ${method}`));
  }
});

/**
 * GET /mcp
 * SSE endpoint for server-initiated messages (future).
 * For now, returns server info.
 */
mcp.get("/mcp", (c) => {
  return c.json({
    name: "thehumansoup",
    version: "0.1.0",
    description: "The Human Soup - AI-traversable content index for the me3 ecosystem",
    tools: TOOLS.map((t) => ({ name: t.name, description: t.description })),
  });
});

// ── JSON-RPC Helpers ───────────────────────────────────────

interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
  id: string | number | null;
}

function jsonRpcResult(id: string | number | null, result: unknown) {
  return { jsonrpc: "2.0", id, result };
}

function jsonRpcError(
  id: string | number | null,
  code: number,
  message: string
) {
  return { jsonrpc: "2.0", id, error: { code, message } };
}

export default mcp;
