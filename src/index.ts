#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const BASE_URL = "https://app.parsleycooks.com/api/public";
const enableWrites = process.argv.includes("--enable-writes");

let apiToken: string | undefined = process.env.PARSELY_API_TOKEN;

async function parsleyFetch(
  path: string,
  options: {
    method?: string;
    params?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<unknown> {
  if (!apiToken) {
    throw new Error(
      "PARSELY_API_TOKEN is not set. Set it as an environment variable or use the configure_token tool."
    );
  }

  const url = new URL(`${BASE_URL}${path}`);
  if (options.params) {
    for (const [key, value] of Object.entries(options.params)) {
      if (value !== undefined && value !== "") {
        url.searchParams.set(key, value);
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  const resp = await fetch(url.toString(), {
    method: options.method || "GET",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const contentType = resp.headers.get("content-type") || "";

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`Parsely API error ${resp.status}: ${errorText}`);
  }

  if (contentType.includes("text/csv")) {
    return await resp.text();
  }

  if (resp.status === 204) {
    return { status: "no content" };
  }

  return await resp.json();
}

function jsonResult(data: unknown) {
  return {
    content: [
      {
        type: "text" as const,
        text: typeof data === "string" ? data : JSON.stringify(data, null, 2),
      },
    ],
  };
}

const server = new McpServer({
  name: "parsely",
  version: "1.0.0",
});

// ============================================================
// Read-only tools (always registered)
// ============================================================

server.tool(
  "configure_token",
  "Set the Parsely API bearer token for this session",
  { token: z.string().describe("Parsely API bearer token") },
  async ({ token }) => {
    apiToken = token;
    return { content: [{ type: "text", text: "Token configured." }] };
  }
);

// --- Menu Items ---

server.tool(
  "list_menu_items",
  "List all menu items (recipes, subrecipes, ingredients) with IDs, names, tags, and prices",
  {
    syncTag: z.string().optional().describe("Filter by sync tag name"),
  },
  async ({ syncTag }) => {
    const params: Record<string, string> = {};
    if (syncTag) {
      params.syncTag = syncTag;
    }
    return jsonResult(await parsleyFetch("/menu_items", { params }));
  }
);

server.tool(
  "get_menu_item",
  "Get detailed info for a menu item including description, nutrition, allergens, and photo URL",
  {
    id: z.string().describe("Menu item ID (numeric) or item number (string)"),
    getByItemNumber: z
      .boolean()
      .optional()
      .describe("Set true if id is an item number string"),
  },
  async ({ id, getByItemNumber }) => {
    const params: Record<string, string> = {};
    if (getByItemNumber) {
      params.getByItemNumber = "true";
    }
    return jsonResult(
      await parsleyFetch(`/menu_items/${encodeURIComponent(id)}`, { params })
    );
  }
);

// --- Menus ---

server.tool(
  "list_menus",
  "List all available menus with their IDs and names",
  {},
  async () => jsonResult(await parsleyFetch("/menus"))
);

server.tool(
  "get_menu",
  "Get full menu details including sections, stations, and menu items",
  { id: z.number().describe("Menu ID") },
  async ({ id }) => jsonResult(await parsleyFetch(`/menus/${id}`))
);

// --- Recipes ---

server.tool(
  "get_recipe",
  "Get recipe details including steps, ingredients, sub-recipes, nutrition, and cost",
  {
    id: z.string().describe("Recipe ID (numeric) or item number (string)"),
    getByItemNumber: z
      .boolean()
      .optional()
      .describe("Set true if id is an item number string"),
    roundedQuantities: z
      .boolean()
      .optional()
      .describe("Round quantities to 2 decimal places (default true)"),
  },
  async ({ id, getByItemNumber, roundedQuantities }) => {
    const params: Record<string, string> = {};
    if (getByItemNumber) {
      params.getByItemNumber = "true";
    }
    if (roundedQuantities !== undefined) {
      params.roundedQuantities = String(roundedQuantities);
    }
    return jsonResult(
      await parsleyFetch(`/recipes/${encodeURIComponent(id)}`, { params })
    );
  }
);

// --- Ingredients ---

server.tool(
  "list_ingredients",
  "List all ingredients with IDs, names, and whether they are used by recipes",
  { salable: z.boolean().optional().describe("Filter by salable status") },
  async ({ salable }) => {
    const params: Record<string, string> = {};
    if (salable !== undefined) {
      params.salable = String(salable);
    }
    return jsonResult(await parsleyFetch("/ingredients", { params }));
  }
);

server.tool(
  "get_ingredient",
  "Get detailed ingredient info including conversions, supply options, and preparations",
  { id: z.number().describe("Ingredient ID") },
  async ({ id }) => jsonResult(await parsleyFetch(`/ingredients/${id}`))
);

// --- Events (read) ---

server.tool(
  "list_events",
  "List events in a date range",
  {
    startDate: z.string().describe("Start date (inclusive), e.g. 2023-01-03T09:00:00"),
    endDate: z.string().describe("End date (inclusive), e.g. 2023-12-31T23:59:59"),
  },
  async ({ startDate, endDate }) =>
    jsonResult(await parsleyFetch("/events", { params: { startDate, endDate } }))
);

server.tool(
  "get_event",
  "Get full details of an event including all line items",
  { id: z.number().describe("Event ID") },
  async ({ id }) => jsonResult(await parsleyFetch(`/events/${id}`))
);

// --- Serving Stations ---

server.tool(
  "list_serving_stations",
  "List all serving stations with IDs and names",
  {},
  async () => jsonResult(await parsleyFetch("/tags/serving_stations"))
);

// --- Chef Tags (read) ---

server.tool(
  "list_chef_tags",
  "List all chef tags with IDs and names",
  {},
  async () => jsonResult(await parsleyFetch("/tags/chefs"))
);

// --- Chef Users (read) ---

server.tool(
  "list_chef_users",
  "List all chef users with IDs, emails, and permission levels",
  {},
  async () => jsonResult(await parsleyFetch("/users/chefs"))
);

// --- Access Token ---

server.tool(
  "get_access_token",
  "Generate a CloudFront access token for CDN resource access",
  {},
  async () => jsonResult(await parsleyFetch("/users/accessToken"))
);

// --- Reports ---

server.tool(
  "get_commissary_report",
  "Get commissary transaction report as CSV (commissary accounts only)",
  {
    startDate: z.string().describe("Start date, YYYY-MM-DD"),
    endDate: z.string().describe("End date, YYYY-MM-DD"),
  },
  async ({ startDate, endDate }) =>
    jsonResult(
      await parsleyFetch("/reports/commissaryTransaction", {
        params: { startDate, endDate },
      })
    )
);

// ============================================================
// Write tools (only registered with --enable-writes)
// ============================================================

if (enableWrites) {
  const lineItemSchema = z.object({
    menuItem: z.number().optional().describe("Menu item ID"),
    itemID: z.string().optional().describe("Menu item item number"),
    amount: z.number().describe("Quantity"),
    uom: z.string().optional().describe("Unit of measure"),
    station: z.string().optional(),
    stationID: z.number().optional(),
    section: z.string().optional(),
  });

  // --- Events (write) ---

  server.tool(
    "create_event",
    "Create a new event (workday, shift, service, or catering event)",
    {
      name: z.string().describe("Event name"),
      type: z.enum(["standard", "cafe-hot-bar", "sale", "forecast"]).describe("Event type"),
      date: z.string().describe("Event date, YYYY-MM-DD"),
      startTime: z.string().optional().describe("Start time HH:mm"),
      endTime: z.string().optional().describe("End time HH:mm"),
      menu: z.number().optional().describe("Menu ID"),
      description: z.string().optional(),
      private: z.boolean().optional().describe("Whether the event is private"),
      lineItems: z.array(lineItemSchema).describe("Line items"),
    },
    async ({ name, type, date, startTime, endTime, menu, description, lineItems, ...rest }) => {
      const body: Record<string, unknown> = { name, type, date, lineItems };
      if (startTime) { body.startTime = startTime; }
      if (endTime) { body.endTime = endTime; }
      if (menu !== undefined) { body.menu = menu; }
      if (description) { body.description = description; }
      if (rest.private !== undefined) { body.private = rest.private; }
      return jsonResult(await parsleyFetch("/events", { method: "POST", body }));
    }
  );

  server.tool(
    "update_event",
    "Update an existing event (replaces existing content)",
    {
      id: z.number().describe("Event ID"),
      name: z.string().describe("Event name"),
      type: z.enum(["standard", "cafe-hot-bar", "sale", "forecast"]).describe("Event type"),
      date: z.string().describe("Event date, YYYY-MM-DD"),
      startTime: z.string().optional().describe("Start time HH:mm"),
      endTime: z.string().optional().describe("End time HH:mm"),
      menu: z.number().optional().describe("Menu ID"),
      description: z.string().optional(),
      lineItems: z.array(lineItemSchema).describe("Line items"),
    },
    async ({ id, name, type, date, startTime, endTime, menu, description, lineItems }) => {
      const body: Record<string, unknown> = { name, type, date, lineItems };
      if (startTime) { body.startTime = startTime; }
      if (endTime) { body.endTime = endTime; }
      if (menu !== undefined) { body.menu = menu; }
      if (description) { body.description = description; }
      return jsonResult(await parsleyFetch(`/events/${id}`, { method: "PUT", body }));
    }
  );

  server.tool(
    "push_event_sales",
    "Push sales data for a cafe/hot bar event",
    {
      id: z.number().describe("Event ID"),
      lineItems: z
        .array(
          z.object({
            menuItem: z.number().optional(),
            itemID: z.string().optional(),
            amount: z.number(),
            uom: z.string().optional(),
          })
        )
        .describe("Sales line items"),
    },
    async ({ id, lineItems }) =>
      jsonResult(await parsleyFetch(`/events/${id}/sales`, { method: "PUT", body: lineItems }))
  );

  server.tool(
    "push_event_waste_leftover",
    "Push waste or leftover data for a cafe/hot bar event",
    {
      id: z.number().describe("Event ID"),
      items: z
        .array(
          z.object({
            menuItem: z.number().describe("Menu item ID"),
            waste: z.object({ amount: z.number(), uom: z.string().optional() }).optional(),
            leftover: z.object({ amount: z.number(), uom: z.string().optional() }).optional(),
            station: z.string().optional(),
            section: z.string().optional(),
          })
        )
        .describe("Waste/leftover items"),
    },
    async ({ id, items }) =>
      jsonResult(
        await parsleyFetch(`/events/${id}/waste_leftover`, { method: "PUT", body: items })
      )
  );

  // --- Chef Tags (write) ---

  server.tool(
    "create_chef_tag",
    "Create a new chef tag (requires Chef IDs enabled)",
    { name: z.string().describe("Chef tag name") },
    async ({ name }) =>
      jsonResult(await parsleyFetch("/tags/chefs", { method: "POST", body: { name } }))
  );

  server.tool(
    "update_chef_tag",
    "Update an existing chef tag",
    {
      id: z.number().describe("Chef tag ID"),
      name: z.string().describe("New name"),
    },
    async ({ id, name }) =>
      jsonResult(await parsleyFetch(`/tags/chefs/${id}`, { method: "PUT", body: { name } }))
  );

  server.tool(
    "remove_chef_tag_users",
    "Remove all users associated with a chef tag",
    { id: z.number().describe("Chef tag ID") },
    async ({ id }) =>
      jsonResult(await parsleyFetch(`/tags/chefs/${id}/users`, { method: "DELETE" }))
  );

  // --- Chef Users (write) ---

  server.tool(
    "create_chef_user",
    "Create a new chef user (requires Chef IDs enabled)",
    {
      email: z.string().describe("User email address"),
      permissionLevel: z.enum(["independent-chef", "chef-read-only"]).describe("Permission level"),
      chefTag: z.union([z.number(), z.string()]).describe("Chef tag ID or name"),
    },
    async ({ email, permissionLevel, chefTag }) =>
      jsonResult(
        await parsleyFetch("/users/chefs", {
          method: "POST",
          body: { email, permissionLevel, chefTag },
        })
      )
  );

  server.tool(
    "update_chef_user",
    "Update a chef user's permission level or chef tag",
    {
      id: z.number().describe("User ID"),
      permissionLevel: z.enum(["independent-chef", "chef-read-only"]).describe("Permission level"),
      chefTag: z.union([z.number(), z.string()]).describe("Chef tag ID or name"),
    },
    async ({ id, permissionLevel, chefTag }) =>
      jsonResult(
        await parsleyFetch(`/users/chefs/${id}`, {
          method: "PUT",
          body: { permissionLevel, chefTag },
        })
      )
  );

  server.tool(
    "delete_chef_user",
    "Delete a chef user",
    { id: z.number().describe("User ID") },
    async ({ id }) =>
      jsonResult(await parsleyFetch(`/users/chefs/${id}`, { method: "DELETE" }))
  );
}

// ============================================================
// Start
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
