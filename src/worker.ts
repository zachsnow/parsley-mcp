import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerTools } from "./tools.js";

function createServer(apiToken: string, enableWrites: boolean): McpServer {
  const server = new McpServer({
    name: "parsely",
    version: "1.0.0",
  });

  registerTools(server, () => apiToken, enableWrites);

  return server;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return new Response("ok");
    }

    const enableWrites = url.pathname === "/mcp/write";
    if (!enableWrites && url.pathname !== "/mcp") {
      return new Response("Not found", { status: 404 });
    }

    const authHeader = request.headers.get("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return new Response(
        JSON.stringify({ error: "Missing or invalid Authorization header. Provide a Parsely API token as a Bearer token." }),
        { status: 401, headers: { "Content-Type": "application/json" } }
      );
    }
    const apiToken = authHeader.slice(7);

    const server = createServer(apiToken, enableWrites);
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
  },
};
