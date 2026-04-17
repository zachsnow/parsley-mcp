import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const BASE_URL = "https://app.parsleycooks.com/api/public";

export const READ_TOOL_NAMES = [
  "list_menu_items",
  "get_menu_item",
  "list_menus",
  "get_menu",
  "get_recipe",
  "list_ingredients",
  "get_ingredient",
  "list_events",
  "get_event",
  "list_serving_stations",
  "list_chef_tags",
  "list_chef_users",
  "get_access_token",
  "get_commissary_report",
] as const;

export const WRITE_TOOL_NAMES = [
  "create_event",
  "update_event",
  "push_event_sales",
  "push_event_waste_leftover",
  "create_chef_tag",
  "update_chef_tag",
  "remove_chef_tag_users",
  "create_chef_user",
  "update_chef_user",
  "delete_chef_user",
] as const;

export const ALL_TOOL_NAMES: readonly string[] = [
  ...READ_TOOL_NAMES,
  ...WRITE_TOOL_NAMES,
];

export async function parsleyFetch(
  apiToken: string,
  path: string,
  options: {
    method?: string;
    params?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<unknown> {
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

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`Parsley API error ${resp.status}: ${errorText}`);
  }

  const contentType = resp.headers.get("content-type") || "";

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
        text: typeof data === "string" ? data : JSON.stringify(data),
      },
    ],
  };
}

export function registerTools(
  server: McpServer,
  getToken: () => string,
  enableWrites: boolean,
  filter?: ReadonlySet<string> | null
) {
  function apiFetch(
    path: string,
    options?: { method?: string; params?: Record<string, string>; body?: unknown }
  ) {
    return parsleyFetch(getToken(), path, options);
  }

  const tool = ((name: string, ...rest: unknown[]) => {
    if (filter && !filter.has(name)) {
      return;
    }
    (server.tool as unknown as (...a: unknown[]) => unknown)(name, ...rest);
  }) as unknown as typeof server.tool;

  // ============================================================
  // Read-only tools
  // ============================================================

  tool(
    "list_menu_items",
    "List menu items (recipes, subrecipes, ingredients).",
    { syncTag: z.string().optional().describe("Filter by sync tag name") },
    async ({ syncTag }) => {
      const params: Record<string, string> = {};
      if (syncTag) {
        params.syncTag = syncTag;
      }
      return jsonResult(await apiFetch("/menu_items", { params }));
    }
  );

  tool(
    "get_menu_item",
    "Get menu item details: description, nutrition, allergens, photo.",
    {
      id: z.string().describe("ID (numeric) or item number (string)"),
      getByItemNumber: z.boolean().optional().describe("True if id is an item number"),
    },
    async ({ id, getByItemNumber }) => {
      const params: Record<string, string> = {};
      if (getByItemNumber) {
        params.getByItemNumber = "true";
      }
      return jsonResult(
        await apiFetch(`/menu_items/${encodeURIComponent(id)}`, { params })
      );
    }
  );

  tool(
    "list_menus",
    "List menus.",
    {},
    async () => jsonResult(await apiFetch("/menus"))
  );

  tool(
    "get_menu",
    "Get menu with sections, stations, and items.",
    { id: z.number() },
    async ({ id }) => jsonResult(await apiFetch(`/menus/${id}`))
  );

  tool(
    "get_recipe",
    "Get recipe: steps, ingredients, sub-recipes, nutrition, cost.",
    {
      id: z.string().describe("ID (numeric) or item number (string)"),
      getByItemNumber: z.boolean().optional().describe("True if id is an item number"),
      roundedQuantities: z
        .boolean()
        .optional()
        .describe("Round to 2 decimals (default true)"),
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
        await apiFetch(`/recipes/${encodeURIComponent(id)}`, { params })
      );
    }
  );

  tool(
    "list_ingredients",
    "List ingredients.",
    { salable: z.boolean().optional().describe("Filter by salable status") },
    async ({ salable }) => {
      const params: Record<string, string> = {};
      if (salable !== undefined) {
        params.salable = String(salable);
      }
      return jsonResult(await apiFetch("/ingredients", { params }));
    }
  );

  tool(
    "get_ingredient",
    "Get ingredient: conversions, supply options, preparations.",
    { id: z.number() },
    async ({ id }) => jsonResult(await apiFetch(`/ingredients/${id}`))
  );

  tool(
    "list_events",
    "List events in a date range.",
    {
      startDate: z.string().describe("Start, e.g. 2023-01-03T09:00:00"),
      endDate: z.string().describe("End, e.g. 2023-12-31T23:59:59"),
    },
    async ({ startDate, endDate }) =>
      jsonResult(await apiFetch("/events", { params: { startDate, endDate } }))
  );

  tool(
    "get_event",
    "Get event with line items.",
    { id: z.number() },
    async ({ id }) => jsonResult(await apiFetch(`/events/${id}`))
  );

  tool(
    "list_serving_stations",
    "List serving stations.",
    {},
    async () => jsonResult(await apiFetch("/tags/serving_stations"))
  );

  tool(
    "list_chef_tags",
    "List chef tags.",
    {},
    async () => jsonResult(await apiFetch("/tags/chefs"))
  );

  tool(
    "list_chef_users",
    "List chef users.",
    {},
    async () => jsonResult(await apiFetch("/users/chefs"))
  );

  tool(
    "get_access_token",
    "Get CloudFront access token for CDN.",
    {},
    async () => jsonResult(await apiFetch("/users/accessToken"))
  );

  tool(
    "get_commissary_report",
    "Commissary transaction report as CSV.",
    {
      startDate: z.string().describe("YYYY-MM-DD"),
      endDate: z.string().describe("YYYY-MM-DD"),
    },
    async ({ startDate, endDate }) =>
      jsonResult(
        await apiFetch("/reports/commissaryTransaction", {
          params: { startDate, endDate },
        })
      )
  );

  // ============================================================
  // Write tools (gated by enableWrites)
  // ============================================================

  if (!enableWrites) {
    return;
  }

  const lineItemSchema = z.object({
    menuItem: z.number().optional().describe("Menu item ID"),
    itemID: z.string().optional().describe("Menu item item number"),
    amount: z.number().describe("Quantity"),
    uom: z.string().optional().describe("Unit of measure"),
    station: z.string().optional(),
    stationID: z.number().optional(),
    section: z.string().optional(),
  });

  tool(
    "create_event",
    "Create an event (workday, shift, service, or catering).",
    {
      name: z.string(),
      type: z.enum(["standard", "cafe-hot-bar", "sale", "forecast"]),
      date: z.string().describe("YYYY-MM-DD"),
      startTime: z.string().optional().describe("HH:mm"),
      endTime: z.string().optional().describe("HH:mm"),
      menu: z.number().optional().describe("Menu ID"),
      description: z.string().optional(),
      private: z.boolean().optional(),
      lineItems: z.array(lineItemSchema),
    },
    async ({ name, type, date, startTime, endTime, menu, description, lineItems, ...rest }) => {
      const body: Record<string, unknown> = { name, type, date, lineItems };
      if (startTime) { body.startTime = startTime; }
      if (endTime) { body.endTime = endTime; }
      if (menu !== undefined) { body.menu = menu; }
      if (description) { body.description = description; }
      if (rest.private !== undefined) { body.private = rest.private; }
      return jsonResult(await apiFetch("/events", { method: "POST", body }));
    }
  );

  tool(
    "update_event",
    "Update an event (replaces content).",
    {
      id: z.number(),
      name: z.string(),
      type: z.enum(["standard", "cafe-hot-bar", "sale", "forecast"]),
      date: z.string().describe("YYYY-MM-DD"),
      startTime: z.string().optional().describe("HH:mm"),
      endTime: z.string().optional().describe("HH:mm"),
      menu: z.number().optional().describe("Menu ID"),
      description: z.string().optional(),
      lineItems: z.array(lineItemSchema),
    },
    async ({ id, name, type, date, startTime, endTime, menu, description, lineItems }) => {
      const body: Record<string, unknown> = { name, type, date, lineItems };
      if (startTime) { body.startTime = startTime; }
      if (endTime) { body.endTime = endTime; }
      if (menu !== undefined) { body.menu = menu; }
      if (description) { body.description = description; }
      return jsonResult(await apiFetch(`/events/${id}`, { method: "PUT", body }));
    }
  );

  tool(
    "push_event_sales",
    "Push sales data for a cafe/hot bar event.",
    {
      id: z.number(),
      lineItems: z.array(
        z.object({
          menuItem: z.number().optional(),
          itemID: z.string().optional(),
          amount: z.number(),
          uom: z.string().optional(),
        })
      ),
    },
    async ({ id, lineItems }) =>
      jsonResult(await apiFetch(`/events/${id}/sales`, { method: "PUT", body: lineItems }))
  );

  tool(
    "push_event_waste_leftover",
    "Push waste/leftover data for a cafe/hot bar event.",
    {
      id: z.number(),
      items: z.array(
        z.object({
          menuItem: z.number(),
          waste: z.object({ amount: z.number(), uom: z.string().optional() }).optional(),
          leftover: z.object({ amount: z.number(), uom: z.string().optional() }).optional(),
          station: z.string().optional(),
          section: z.string().optional(),
        })
      ),
    },
    async ({ id, items }) =>
      jsonResult(await apiFetch(`/events/${id}/waste_leftover`, { method: "PUT", body: items }))
  );

  tool(
    "create_chef_tag",
    "Create a chef tag.",
    { name: z.string() },
    async ({ name }) =>
      jsonResult(await apiFetch("/tags/chefs", { method: "POST", body: { name } }))
  );

  tool(
    "update_chef_tag",
    "Update a chef tag.",
    { id: z.number(), name: z.string() },
    async ({ id, name }) =>
      jsonResult(await apiFetch(`/tags/chefs/${id}`, { method: "PUT", body: { name } }))
  );

  tool(
    "remove_chef_tag_users",
    "Remove all users from a chef tag.",
    { id: z.number() },
    async ({ id }) =>
      jsonResult(await apiFetch(`/tags/chefs/${id}/users`, { method: "DELETE" }))
  );

  tool(
    "create_chef_user",
    "Create a chef user.",
    {
      email: z.string(),
      permissionLevel: z.enum(["independent-chef", "chef-read-only"]),
      chefTag: z.union([z.number(), z.string()]).describe("Chef tag ID or name"),
    },
    async ({ email, permissionLevel, chefTag }) =>
      jsonResult(
        await apiFetch("/users/chefs", { method: "POST", body: { email, permissionLevel, chefTag } })
      )
  );

  tool(
    "update_chef_user",
    "Update a chef user.",
    {
      id: z.number(),
      permissionLevel: z.enum(["independent-chef", "chef-read-only"]),
      chefTag: z.union([z.number(), z.string()]).describe("Chef tag ID or name"),
    },
    async ({ id, permissionLevel, chefTag }) =>
      jsonResult(
        await apiFetch(`/users/chefs/${id}`, { method: "PUT", body: { permissionLevel, chefTag } })
      )
  );

  tool(
    "delete_chef_user",
    "Delete a chef user.",
    { id: z.number() },
    async ({ id }) =>
      jsonResult(await apiFetch(`/users/chefs/${id}`, { method: "DELETE" }))
  );
}
