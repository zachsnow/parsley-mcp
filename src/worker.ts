import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerTools } from "./tools.js";

interface Env {
  ENABLE_WRITES: string;
}

function createServer(env: Env, apiToken: string): McpServer {
  const server = new McpServer({
    name: "parsely",
    version: "1.0.0",
  });

  registerTools(server, () => apiToken, env.ENABLE_WRITES === "true");

  return server;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok");
    }

    // Only handle /mcp
    if (url.pathname !== "/mcp") {
      return new Response("Not found", { status: 404 });
    }

    // Extract bearer token from the MCP client request and pass it through to Parsely
    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header. Provide a Parsely API token as a Bearer token." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    const apiToken = authHeader.slice(7);

    // Stateless: each request gets a fresh server + transport
    const server = createServer(env, apiToken);
    const transport = new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined, // stateless
      enableJsonResponse: true,
    });

    await server.connect(transport);

    try {
      return await transport.handleRequest(request);
    } finally {
      await transport.close();
      await server.close();
    }
  },
};
