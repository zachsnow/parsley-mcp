#!/usr/bin/env node
// Measure context cost of the MCP server's tools/list payload across scenarios.
//
// Usage:
//   BASE_URL=http://localhost:8787 \
//   PARSLEY_API_TOKEN=... \
//   ANTHROPIC_API_KEY=... \
//   node scripts/measure-tokens.mjs
//
// BASE_URL defaults to http://localhost:8787 (wrangler dev).
// PARSLEY_API_TOKEN is only needed for /mcp and /mcp/write scenarios.
// ANTHROPIC_API_KEY is optional; without it the script reports bytes only.
//
// .env and .env.local are loaded automatically if present (.env.local wins).

import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import dotenv from "dotenv";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "..");
dotenv.config({ path: [resolve(repoRoot, ".env.local"), resolve(repoRoot, ".env")] });

const BASE_URL = process.env.BASE_URL ?? "http://localhost:8787";
const PARSLEY_API_TOKEN = process.env.PARSLEY_API_TOKEN;
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const MODEL = process.env.MODEL ?? "claude-sonnet-4-5";

const COMMON_READ_TOOLS = [
  "list_menu_items",
  "get_recipe",
  "list_events",
  "get_event",
];

const scenarios = [
  { label: "demo: all tools", path: "/mcp/demo", auth: false },
  {
    label: `demo: filtered (${COMMON_READ_TOOLS.length})`,
    path: `/mcp/demo?tools=${COMMON_READ_TOOLS.join(",")}`,
    auth: false,
  },
  { label: "read: all tools", path: "/mcp", auth: true },
  {
    label: `read: filtered (${COMMON_READ_TOOLS.length})`,
    path: `/mcp?tools=${COMMON_READ_TOOLS.join(",")}`,
    auth: true,
  },
  { label: "write: all tools", path: "/mcp/write", auth: true },
];

async function fetchToolsList(path, needsAuth) {
  const headers = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
  };
  if (needsAuth) {
    if (!PARSLEY_API_TOKEN) {
      throw new Error("PARSLEY_API_TOKEN not set");
    }
    headers.Authorization = `Bearer ${PARSLEY_API_TOKEN}`;
  }
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/list",
      params: {},
    }),
  });
  if (!res.ok) {
    throw new Error(`${res.status}: ${await res.text()}`);
  }
  const text = await res.text();
  const ct = res.headers.get("content-type") ?? "";
  let body;
  if (ct.includes("text/event-stream")) {
    const line = text.split("\n").find((l) => l.startsWith("data: "));
    if (!line) {
      throw new Error(`no data line in SSE: ${text}`);
    }
    body = JSON.parse(line.slice(6));
  } else {
    body = JSON.parse(text);
  }
  if (body.error) {
    throw new Error(`JSON-RPC error: ${JSON.stringify(body.error)}`);
  }
  return body.result.tools;
}

function toAnthropicTools(mcpTools) {
  return mcpTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

async function countTokens(tools) {
  if (!ANTHROPIC_API_KEY) {
    return null;
  }
  const res = await fetch("https://api.anthropic.com/v1/messages/count_tokens", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      tools: toAnthropicTools(tools),
      messages: [{ role: "user", content: "x" }],
    }),
  });
  if (!res.ok) {
    throw new Error(`count_tokens ${res.status}: ${await res.text()}`);
  }
  const body = await res.json();
  return body.input_tokens;
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

async function main() {
  let baselineTokens = null;
  if (ANTHROPIC_API_KEY) {
    baselineTokens = await countTokens([]);
  }

  const rows = [];
  for (const s of scenarios) {
    if (s.auth && !PARSLEY_API_TOKEN) {
      rows.push({ label: s.label, skipped: "no PARSLEY_API_TOKEN" });
      continue;
    }
    try {
      const tools = await fetchToolsList(s.path, s.auth);
      const bytes = JSON.stringify(tools).length;
      const totalTokens = await countTokens(tools);
      const toolsTokens =
        totalTokens !== null && baselineTokens !== null
          ? totalTokens - baselineTokens
          : null;
      rows.push({
        label: s.label,
        count: tools.length,
        bytes,
        tokens: toolsTokens,
      });
    } catch (err) {
      rows.push({ label: s.label, error: err.message });
    }
  }

  console.log();
  console.log(
    `${pad("scenario", 32)}${pad("tools", 8)}${pad("bytes", 10)}${pad("tokens", 8)}`
  );
  console.log("-".repeat(58));
  for (const r of rows) {
    if (r.skipped) {
      console.log(`${pad(r.label, 32)}(skipped: ${r.skipped})`);
    } else if (r.error) {
      console.log(`${pad(r.label, 32)}ERROR: ${r.error}`);
    } else {
      console.log(
        `${pad(r.label, 32)}${pad(r.count, 8)}${pad(r.bytes, 10)}${pad(
          r.tokens ?? "-",
          8
        )}`
      );
    }
  }
  console.log();
  if (baselineTokens !== null) {
    console.log(
      `(token counts are tools-only: total input_tokens minus empty-tools baseline of ${baselineTokens})`
    );
  } else {
    console.log("(set ANTHROPIC_API_KEY to get exact token counts)");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
