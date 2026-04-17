#!/usr/bin/env node
// Measure context cost of the MCP server across two dimensions:
//   1. tools/list schema payload (what every turn carries)
//   2. tools/call response payload for a few representative tools
//
// Usage:
//   BASE_URL=http://localhost:8787 \
//   PARSLEY_API_TOKEN=... \
//   ANTHROPIC_API_KEY=... \
//   node scripts/measure-tokens.mjs
//
// BASE_URL defaults to http://localhost:8787 (wrangler dev).
// PARSLEY_API_TOKEN is needed for /mcp, /mcp/write, and tool-response scenarios.
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

const schemaScenarios = [
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

function jsonRpcRequest(id, method, params) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

async function mcpRequest(path, needsAuth, method, params) {
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
    body: jsonRpcRequest(1, method, params),
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
  return body.result;
}

async function fetchToolsList(path, needsAuth) {
  const result = await mcpRequest(path, needsAuth, "tools/list", {});
  return result.tools;
}

async function callTool(path, needsAuth, name, args) {
  const result = await mcpRequest(path, needsAuth, "tools/call", {
    name,
    arguments: args,
  });
  const text = result.content.map((c) => c.text ?? "").join("");
  let parsed = null;
  try {
    parsed = JSON.parse(text);
  } catch {
    // non-JSON (CSV etc.) is fine
  }
  return { text, parsed };
}

function toAnthropicTools(mcpTools) {
  return mcpTools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema,
  }));
}

async function countTokensWithTools(tools) {
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
  return (await res.json()).input_tokens;
}

async function countTokensOfText(text) {
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
      messages: [{ role: "user", content: text }],
    }),
  });
  if (!res.ok) {
    throw new Error(`count_tokens ${res.status}: ${await res.text()}`);
  }
  return (await res.json()).input_tokens;
}

function pad(s, n) {
  s = String(s);
  return s.length >= n ? s : s + " ".repeat(n - s.length);
}

function firstNumericId(items, key = "id") {
  for (const item of items ?? []) {
    if (typeof item?.[key] === "number") {
      return item[key];
    }
  }
  return null;
}

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

async function measureSchemas() {
  let baselineTokens = null;
  if (ANTHROPIC_API_KEY) {
    baselineTokens = await countTokensWithTools([]);
  }

  const rows = [];
  for (const s of schemaScenarios) {
    if (s.auth && !PARSLEY_API_TOKEN) {
      rows.push({ label: s.label, skipped: "no PARSLEY_API_TOKEN" });
      continue;
    }
    try {
      const tools = await fetchToolsList(s.path, s.auth);
      const bytes = JSON.stringify(tools).length;
      const totalTokens = await countTokensWithTools(tools);
      const toolsTokens =
        totalTokens !== null && baselineTokens !== null
          ? totalTokens - baselineTokens
          : null;
      rows.push({ label: s.label, count: tools.length, bytes, tokens: toolsTokens });
    } catch (err) {
      rows.push({ label: s.label, error: err.message });
    }
  }

  console.log();
  console.log("== Tool schemas (cost per turn) ==");
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
  if (baselineTokens !== null) {
    console.log(
      `(tokens are tools-only: total minus empty-tools baseline of ${baselineTokens})`
    );
  }
}

async function measureToolResponses() {
  if (!PARSLEY_API_TOKEN) {
    console.log();
    console.log("== Tool responses ==");
    console.log("(skipped: PARSLEY_API_TOKEN not set)");
    return;
  }

  const path = "/mcp";
  const auth = true;

  // Discover IDs from list calls so get_* calls have something to hit.
  let recipeId = null;
  let menuId = null;
  try {
    const { parsed } = await callTool(path, auth, "list_menu_items", {});
    recipeId = firstNumericId(parsed);
  } catch {}
  try {
    const { parsed } = await callTool(path, auth, "list_menus", {});
    menuId = firstNumericId(parsed);
  } catch {}

  const today = new Date();
  const monthAgo = new Date(today);
  monthAgo.setDate(monthAgo.getDate() - 30);
  const eventStart = `${isoDate(monthAgo)}T00:00:00`;
  const eventEnd = `${isoDate(today)}T23:59:59`;

  const calls = [
    { name: "list_menu_items", args: {} },
    { name: "list_ingredients", args: {} },
    { name: "list_menus", args: {} },
    { name: "list_events", args: { startDate: eventStart, endDate: eventEnd } },
  ];
  if (recipeId !== null) {
    calls.push({ name: "get_recipe", args: { id: String(recipeId) } });
  }
  if (menuId !== null) {
    calls.push({ name: "get_menu", args: { id: menuId } });
  }

  console.log();
  console.log("== Tool responses (cost each time the tool is called) ==");
  console.log(
    `${pad("tool", 32)}${pad("bytes", 10)}${pad("tokens", 8)}`
  );
  console.log("-".repeat(50));
  for (const c of calls) {
    const label = `${c.name}${c.args && Object.keys(c.args).length ? "(…)" : "()"}`;
    try {
      const { text } = await callTool(path, auth, c.name, c.args);
      const bytes = text.length;
      const tokens = await countTokensOfText(text);
      console.log(
        `${pad(label, 32)}${pad(bytes, 10)}${pad(tokens ?? "-", 8)}`
      );
    } catch (err) {
      console.log(`${pad(label, 32)}ERROR: ${err.message}`);
    }
  }
  if (!ANTHROPIC_API_KEY) {
    console.log("(set ANTHROPIC_API_KEY to get exact token counts)");
  }
}

async function main() {
  await measureSchemas();
  await measureToolResponses();
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
