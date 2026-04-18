import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import Fuse, { type IFuseOptions } from "fuse.js";
import { z } from "zod";

const BASE_URL = "https://app.parsleycooks.com/api/public";

export const READ_TOOL_NAMES = [
  "list_menu_items",
  "search_menu_items",
  "get_menu_item",
  "list_menus",
  "search_menus",
  "get_menu",
  "get_recipe",
  "list_ingredients",
  "search_ingredients",
  "get_ingredient",
  "list_events",
  "get_event",
  "list_serving_stations",
  "list_chef_tags",
  "list_chef_users",
  "get_access_token",
  "get_commissary_report",
  "clear_cache",
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

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type CacheEntry = { data: unknown; expiresAt: number };

// Keyed by `${token}|${path}?${sortedParams}`. Token is part of the key so
// different tenants never share entries. Module-level state persists for the
// life of the Cloudflare isolate — best-effort, not guaranteed.
const cache = new Map<string, CacheEntry>();

function cacheKey(apiToken: string, path: string, params?: Record<string, string>): string {
  const search = params
    ? Object.entries(params)
        .filter(([, v]) => v !== undefined && v !== "")
        .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
        .join("&")
    : "";
  return `${apiToken}|${path}?${search}`;
}

function invalidateToken(apiToken: string): number {
  const prefix = `${apiToken}|`;
  let n = 0;
  for (const key of cache.keys()) {
    if (key.startsWith(prefix)) {
      cache.delete(key);
      n++;
    }
  }
  return n;
}

export function clearCacheForToken(apiToken: string): number {
  return invalidateToken(apiToken);
}

export async function parsleyFetch(
  apiToken: string,
  path: string,
  options: {
    method?: string;
    params?: Record<string, string>;
    body?: unknown;
  } = {}
): Promise<unknown> {
  const method = options.method || "GET";
  const cacheable = method === "GET";
  const key = cacheable ? cacheKey(apiToken, path, options.params) : "";

  if (cacheable) {
    const hit = cache.get(key);
    if (hit && hit.expiresAt > Date.now()) {
      return hit.data;
    }
    if (hit) {
      cache.delete(key);
    }
  }

  const url = new URL(`${BASE_URL}${path}`);
  if (options.params) {
    for (const [k, v] of Object.entries(options.params)) {
      if (v !== undefined && v !== "") {
        url.searchParams.set(k, v);
      }
    }
  }

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiToken}`,
    "Content-Type": "application/json",
  };

  const resp = await fetch(url.toString(), {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!resp.ok) {
    const errorText = await resp.text();
    throw new Error(`Parsley API error ${resp.status}: ${errorText}`);
  }

  const contentType = resp.headers.get("content-type") || "";

  let data: unknown;
  if (contentType.includes("text/csv")) {
    data = await resp.text();
  } else if (resp.status === 204) {
    data = { status: "no content" };
  } else {
    data = await resp.json();
  }

  if (cacheable) {
    cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  } else {
    invalidateToken(apiToken);
  }

  return data;
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

const PAGE_LIMIT = 20;
const MAX_LIMIT = 50;

function paged<T>(items: T[], offset = 0, limit = PAGE_LIMIT) {
  const start = Math.max(0, offset);
  const end = start + Math.min(Math.max(1, limit), MAX_LIMIT);
  return {
    items: items.slice(start, end),
    total: items.length,
    offset: start,
    truncated: items.length > end,
  };
}

type MenuItemRow = {
  id: number;
  name: string;
  itemNumber?: string;
  tags?: string[];
  type?: string;
};

function projectMenuItem(row: MenuItemRow) {
  return {
    id: row.id,
    name: row.name,
    itemNumber: row.itemNumber,
    tags: row.tags,
    type: row.type,
  };
}

type MenuRow = { id: number; name: string };

function projectMenu(row: MenuRow) {
  return { id: row.id, name: row.name };
}

type IngredientRow = {
  id: number;
  name: string;
  itemNumber?: string;
  salable?: boolean;
};

function projectIngredient(row: IngredientRow) {
  return {
    id: row.id,
    name: row.name,
    itemNumber: row.itemNumber,
    salable: row.salable,
  };
}

const FUSE_BASE_OPTIONS = {
  threshold: 0.2,
  ignoreLocation: true,
} as const;

function fuseSearch<T>(
  items: T[],
  keys: IFuseOptions<T>["keys"],
  query: string
): T[] {
  const fuse = new Fuse(items, { ...FUSE_BASE_OPTIONS, keys });
  return fuse.search(query).map((r) => r.item);
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

  // MCP tool annotations (hints; clients may treat as advisory).
  const READ_ANNO = { readOnlyHint: true, openWorldHint: true } as const;
  const LOCAL_ANNO = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  } as const;
  const CREATE_ANNO = {
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  } as const;
  const UPDATE_ANNO = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  } as const;
  const DELETE_ANNO = {
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  } as const;

  // ============================================================
  // Read-only tools
  // ============================================================

  tool(
    "list_menu_items",
    `List menu items (recipes, subrecipes, ingredients). Returns up to ${PAGE_LIMIT} with {items, total, truncated}; each item has id, name, itemNumber, tags, type. If truncated, prefer search_menu_items or narrow with syncTag/type.`,
    {
      syncTag: z.string().optional().describe("Filter by sync tag name"),
      type: z
        .enum(["recipe", "subrecipe", "ingredient"])
        .optional()
        .describe("Filter by item type"),
    },
    READ_ANNO,
    async ({ syncTag, type }) => {
      const params: Record<string, string> = {};
      if (syncTag) {
        params.syncTag = syncTag;
      }
      let items = (await apiFetch("/menu_items", { params })) as MenuItemRow[];
      if (type) {
        items = items.filter((i) => i.type === type);
      }
      return jsonResult(paged(items.map(projectMenuItem)));
    }
  );

  tool(
    "search_menu_items",
    `Fuzzy-ranked search of menu items over name/itemNumber/tags (typo-tolerant, multi-token). Returns {items, total, offset, truncated}, best matches first. Default page size ${PAGE_LIMIT} (max ${MAX_LIMIT}); use offset to page through ranked results.`,
    {
      query: z.string().describe("Search query (fuzzy, multi-token)"),
      type: z
        .enum(["recipe", "subrecipe", "ingredient"])
        .optional()
        .describe("Filter by item type"),
      offset: z.number().int().min(0).optional().describe("Skip this many ranked results (default 0)"),
      limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Max items to return (default ${PAGE_LIMIT}, max ${MAX_LIMIT})`),
    },
    READ_ANNO,
    async ({ query, type, offset, limit }) => {
      const all = (await apiFetch("/menu_items")) as MenuItemRow[];
      const scoped = type ? all.filter((i) => i.type === type) : all;
      const ranked = fuseSearch(
        scoped,
        [
          { name: "name", weight: 2 },
          { name: "itemNumber", weight: 1.5 },
          { name: "tags", weight: 1 },
        ],
        query
      );
      return jsonResult(paged(ranked.map(projectMenuItem), offset, limit));
    }
  );

  tool(
    "get_menu_item",
    "Get menu item details: description, nutrition, allergens, photo.",
    {
      id: z.string().describe("ID (numeric) or item number (string)"),
      getByItemNumber: z.boolean().optional().describe("True if id is an item number"),
    },
    READ_ANNO,
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
    `List menus. Returns up to ${PAGE_LIMIT} with {items, total, truncated}; each item has id, name. If truncated, prefer search_menus.`,
    {},
    READ_ANNO,
    async () => {
      const items = (await apiFetch("/menus")) as MenuRow[];
      return jsonResult(paged(items.map(projectMenu)));
    }
  );

  tool(
    "search_menus",
    `Fuzzy-ranked search of menus by name (typo-tolerant, multi-token). Returns {items, total, offset, truncated}, best matches first. Default page size ${PAGE_LIMIT} (max ${MAX_LIMIT}); use offset to page through ranked results.`,
    {
      query: z.string().describe("Search query (fuzzy, multi-token)"),
      offset: z.number().int().min(0).optional().describe("Skip this many ranked results (default 0)"),
      limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Max items to return (default ${PAGE_LIMIT}, max ${MAX_LIMIT})`),
    },
    READ_ANNO,
    async ({ query, offset, limit }) => {
      const all = (await apiFetch("/menus")) as MenuRow[];
      const ranked = fuseSearch(all, [{ name: "name", weight: 1 }], query);
      return jsonResult(paged(ranked.map(projectMenu), offset, limit));
    }
  );

  tool(
    "get_menu",
    "Get menu with sections, stations, and items.",
    { id: z.number() },
    READ_ANNO,
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
    READ_ANNO,
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
    `List ingredients. Returns up to ${PAGE_LIMIT} with {items, total, truncated}; each item has id, name, itemNumber, salable. If truncated, prefer search_ingredients or filter by salable.`,
    { salable: z.boolean().optional().describe("Filter by salable status") },
    READ_ANNO,
    async ({ salable }) => {
      const params: Record<string, string> = {};
      if (salable !== undefined) {
        params.salable = String(salable);
      }
      const items = (await apiFetch("/ingredients", { params })) as IngredientRow[];
      return jsonResult(paged(items.map(projectIngredient)));
    }
  );

  tool(
    "search_ingredients",
    `Fuzzy-ranked search of ingredients over name/itemNumber (typo-tolerant, multi-token). Returns {items, total, offset, truncated}, best matches first. Default page size ${PAGE_LIMIT} (max ${MAX_LIMIT}); use offset to page through ranked results.`,
    {
      query: z.string().describe("Search query (fuzzy, multi-token)"),
      salable: z.boolean().optional().describe("Filter by salable status"),
      offset: z.number().int().min(0).optional().describe("Skip this many ranked results (default 0)"),
      limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Max items to return (default ${PAGE_LIMIT}, max ${MAX_LIMIT})`),
    },
    READ_ANNO,
    async ({ query, salable, offset, limit }) => {
      const params: Record<string, string> = {};
      if (salable !== undefined) {
        params.salable = String(salable);
      }
      const all = (await apiFetch("/ingredients", { params })) as IngredientRow[];
      const ranked = fuseSearch(
        all,
        [
          { name: "name", weight: 2 },
          { name: "itemNumber", weight: 1.5 },
        ],
        query
      );
      return jsonResult(paged(ranked.map(projectIngredient), offset, limit));
    }
  );

  tool(
    "get_ingredient",
    "Get ingredient: conversions, supply options, preparations.",
    { id: z.number() },
    READ_ANNO,
    async ({ id }) => jsonResult(await apiFetch(`/ingredients/${id}`))
  );

  tool(
    "list_events",
    "List events in a date range.",
    {
      startDate: z.string().describe("Start, e.g. 2023-01-03T09:00:00"),
      endDate: z.string().describe("End, e.g. 2023-12-31T23:59:59"),
    },
    READ_ANNO,
    async ({ startDate, endDate }) =>
      jsonResult(await apiFetch("/events", { params: { startDate, endDate } }))
  );

  tool(
    "get_event",
    "Get event with line items.",
    { id: z.number() },
    READ_ANNO,
    async ({ id }) => jsonResult(await apiFetch(`/events/${id}`))
  );

  tool(
    "list_serving_stations",
    "List serving stations.",
    {},
    READ_ANNO,
    async () => jsonResult(await apiFetch("/tags/serving_stations"))
  );

  tool(
    "list_chef_tags",
    "List chef tags.",
    {},
    READ_ANNO,
    async () => jsonResult(await apiFetch("/tags/chefs"))
  );

  tool(
    "list_chef_users",
    "List chef users.",
    {},
    READ_ANNO,
    async () => jsonResult(await apiFetch("/users/chefs"))
  );

  tool(
    "get_access_token",
    "Get CloudFront access token for CDN.",
    {},
    READ_ANNO,
    async () => jsonResult(await apiFetch("/users/accessToken"))
  );

  tool(
    "clear_cache",
    "Clear the cached Parsley API responses for this token. GET responses are cached for 24 hours; call this if you suspect data is stale. Ask the user for permission before calling, since subsequent reads will refetch from the API.",
    {},
    LOCAL_ANNO,
    async () => {
      const cleared = clearCacheForToken(getToken());
      return jsonResult({ cleared });
    }
  );

  tool(
    "get_commissary_report",
    "Commissary transaction report as CSV.",
    {
      startDate: z.string().describe("YYYY-MM-DD"),
      endDate: z.string().describe("YYYY-MM-DD"),
    },
    READ_ANNO,
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
    CREATE_ANNO,
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
    UPDATE_ANNO,
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
    UPDATE_ANNO,
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
    UPDATE_ANNO,
    async ({ id, items }) =>
      jsonResult(await apiFetch(`/events/${id}/waste_leftover`, { method: "PUT", body: items }))
  );

  tool(
    "create_chef_tag",
    "Create a chef tag.",
    { name: z.string() },
    CREATE_ANNO,
    async ({ name }) =>
      jsonResult(await apiFetch("/tags/chefs", { method: "POST", body: { name } }))
  );

  tool(
    "update_chef_tag",
    "Update a chef tag.",
    { id: z.number(), name: z.string() },
    UPDATE_ANNO,
    async ({ id, name }) =>
      jsonResult(await apiFetch(`/tags/chefs/${id}`, { method: "PUT", body: { name } }))
  );

  tool(
    "remove_chef_tag_users",
    "Remove all users from a chef tag.",
    { id: z.number() },
    DELETE_ANNO,
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
    CREATE_ANNO,
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
    UPDATE_ANNO,
    async ({ id, permissionLevel, chefTag }) =>
      jsonResult(
        await apiFetch(`/users/chefs/${id}`, { method: "PUT", body: { permissionLevel, chefTag } })
      )
  );

  tool(
    "delete_chef_user",
    "Delete a chef user.",
    { id: z.number() },
    DELETE_ANNO,
    async ({ id }) =>
      jsonResult(await apiFetch(`/users/chefs/${id}`, { method: "DELETE" }))
  );
}
