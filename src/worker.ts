import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerTools } from "./tools.js";
import { registerDemoTools } from "./demo-tools.js";
import { VERSION } from "./version.js";
import INDEX_HTML from "./index.html";

function createServer(apiToken: string, enableWrites: boolean): McpServer {
  const server = new McpServer({
    name: "parsley",
    version: VERSION,
  });

  registerTools(server, () => apiToken, enableWrites);

  return server;
}

function createDemoServer(): McpServer {
  const server = new McpServer({
    name: "parsley-demo",
    version: VERSION,
  });

  registerDemoTools(server);

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
      return handleMcp(request, createDemoServer());
    }

    const enableWrites = url.pathname === "/mcp/write";
    if (!enableWrites && url.pathname !== "/mcp") {
      return new Response("Not found", { status: 404 });
    }

    const authHeader = request.headers.get("Authorization");
    const apiToken = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : url.searchParams.get("token");
    if (!apiToken) {
      return new Response(
        JSON.stringify({ error: "Missing API token. Provide a Parsley API token via Authorization: Bearer header or ?token= query parameter." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }

    return handleMcp(request, createServer(apiToken, enableWrites));
  },
};
