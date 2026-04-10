#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { registerTools } from "./tools.js";
import { VERSION } from "./version.js";

const enableWrites = process.argv.includes("--enable-writes");
let apiToken: string | undefined = process.env.PARSELY_API_TOKEN;

const server = new McpServer({
  name: "parsely",
  version: VERSION,
});

server.tool(
  "configure_token",
  "Set the Parsely API bearer token for this session",
  { token: z.string().describe("Parsely API bearer token") },
  async ({ token }) => {
    apiToken = token;
    return { content: [{ type: "text", text: "Token configured." }] };
  }
);

registerTools(
  server,
  () => {
    if (!apiToken) {
      throw new Error(
        "PARSELY_API_TOKEN is not set. Set it as an environment variable or use the configure_token tool."
      );
    }
    return apiToken;
  },
  enableWrites
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
