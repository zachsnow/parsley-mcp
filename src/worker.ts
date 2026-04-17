import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerTools, ALL_TOOL_NAMES, READ_TOOL_NAMES } from "./tools.js";
import { registerDemoTools } from "./demo-tools.js";
import { VERSION } from "./version.js";
import INDEX_HTML from "./index.html";

function createServer(
  apiToken: string,
  enableWrites: boolean,
  filter: ReadonlySet<string> | null
): McpServer {
  const server = new McpServer({
    name: "parsley",
    version: VERSION,
  });

  registerTools(server, () => apiToken, enableWrites, filter);

  return server;
}

function createDemoServer(filter: ReadonlySet<string> | null): McpServer {
  const server = new McpServer({
    name: "parsley-demo",
    version: VERSION,
  });

  registerDemoTools(server, filter);

  return server;
}

async function handleMcp(request: Request, server: McpServer): Promise<Response> {
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });

  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    await transport.close();
    await server.close();
  }
}

function jsonError(message: string, status: number): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseToolsFilter(
  url: URL,
  allowed: readonly string[]
): { filter: ReadonlySet<string> | null; error?: string } {
  const raw = url.searchParams.get("tools");
  if (!raw) {
    return { filter: null };
  }
  const requested = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (requested.length === 0) {
    return { filter: null };
  }
  const allowedSet = new Set(allowed);
  const unknown = requested.filter((t) => !allowedSet.has(t));
  if (unknown.length > 0) {
    return {
      filter: null,
      error: `Unknown tool(s): ${unknown.join(", ")}. Allowed: ${allowed.join(", ")}`,
    };
  }
  return { filter: new Set(requested) };
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok");
    }

    if (url.pathname === "/robots.txt") {
      return new Response("User-agent: *\nAllow: /\n", {
        headers: { "Content-Type": "text/plain" },
      });
    }

    if (url.pathname === "/") {
      return new Response(INDEX_HTML.replace("__VERSION__", VERSION), {
        headers: { "Content-Type": "text/html; charset=utf-8" },
      });
    }

    // Demo endpoint — no auth required
    if (url.pathname === "/mcp/demo") {
      const { filter, error } = parseToolsFilter(url, READ_TOOL_NAMES);
      if (error) {
        return jsonError(error, 400);
      }
      return handleMcp(request, createDemoServer(filter));
    }

    const enableWrites = url.pathname === "/mcp/write";
    if (!enableWrites && url.pathname !== "/mcp") {
      return new Response("Not found", { status: 404 });
    }

    const allowed = enableWrites ? ALL_TOOL_NAMES : READ_TOOL_NAMES;
    const { filter, error } = parseToolsFilter(url, allowed);
    if (error) {
      return jsonError(error, 400);
    }

    const authHeader = request.headers.get("Authorization");
    const apiToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : url.searchParams.get("token");
    if (!apiToken) {
      return jsonError(
        "Missing API token. Provide a Parsley API token via Authorization: Bearer header or ?token= query parameter.",
        401
      );
    }

    return handleMcp(request, createServer(apiToken, enableWrites, filter));
  },
};
