import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as demo from "./demo-data.js";

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

function notFound(type: string, id: string | number) {
  return {
    content: [{ type: "text" as const, text: `No ${type} found with ID ${id}` }],
    isError: true as const,
  };
}

const PAGE_LIMIT = 20;

function paged<T>(items: T[]) {
  return {
    items: items.slice(0, PAGE_LIMIT),
    total: items.length,
    truncated: items.length > PAGE_LIMIT,
  };
}

function projectMenuItem(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    itemNumber: row.itemNumber,
    tags: row.tags,
    type: row.type,
  };
}

function projectIngredient(row: Record<string, unknown>) {
  return {
    id: row.id,
    name: row.name,
    itemNumber: row.itemNumber,
    salable: row.salable,
  };
}

function matchesQuery(haystack: (string | undefined)[], needle: string): boolean {
  const q = needle.toLowerCase();
  return haystack.some((s) => typeof s === "string" && s.toLowerCase().includes(q));
}

export function registerDemoTools(
  server: McpServer,
  filter?: ReadonlySet<string> | null
) {
  const tool = ((name: string, ...rest: unknown[]) => {
    if (filter && !filter.has(name)) {
      return;
    }
    (server.tool as unknown as (...a: unknown[]) => unknown)(name, ...rest);
  }) as unknown as typeof server.tool;

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
    async ({ syncTag, type }) => {
      let items = demo.menuItems;
      if (syncTag) {
        items = items.filter((i) => i.tags.includes(syncTag));
      }
      if (type) {
        items = items.filter((i) => i.type === type);
      }
      return jsonResult(paged(items.map(projectMenuItem)));
    }
  );

  tool(
    "search_menu_items",
    `Search menu items by substring in name/itemNumber/tags (case-insensitive). Returns up to ${PAGE_LIMIT} with {items, total, truncated}. Narrow the query if truncated.`,
    {
      query: z.string().describe("Substring to match"),
      type: z
        .enum(["recipe", "subrecipe", "ingredient"])
        .optional()
        .describe("Filter by item type"),
    },
    async ({ query, type }) => {
      const filtered = demo.menuItems.filter((i) => {
        if (type && i.type !== type) {
          return false;
        }
        return matchesQuery([i.name, i.itemNumber, ...(i.tags ?? [])], query);
      });
      return jsonResult(paged(filtered.map(projectMenuItem)));
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
      let item: unknown;
      if (getByItemNumber) {
        const mi = demo.menuItems.find((i) => i.itemNumber === id);
        if (mi) {
          item = demo.menuItemDetails[mi.id];
        }
      } else {
        item = demo.menuItemDetails[Number(id)];
      }
      if (!item) {
        return notFound("menu item", id);
      }
      return jsonResult(item);
    }
  );

  tool(
    "list_menus",
    "List menus.",
    {},
    async () => jsonResult(demo.menus)
  );

  tool(
    "get_menu",
    "Get menu with sections, stations, and items.",
    { id: z.number() },
    async ({ id }) => {
      const menu = demo.menuDetails[id];
      if (!menu) {
        return notFound("menu", id);
      }
      return jsonResult(menu);
    }
  );

  tool(
    "get_recipe",
    "Get recipe: steps, ingredients, sub-recipes, nutrition, cost.",
    {
      id: z.string().describe("ID (numeric) or item number (string)"),
      getByItemNumber: z.boolean().optional().describe("True if id is an item number"),
      roundedQuantities: z.boolean().optional().describe("Round to 2 decimals (default true)"),
    },
    async ({ id, getByItemNumber }) => {
      let recipe: unknown;
      if (getByItemNumber) {
        const mi = demo.menuItems.find((i) => i.itemNumber === id);
        if (mi) {
          recipe = demo.recipeDetails[mi.id];
        }
      } else {
        recipe = demo.recipeDetails[Number(id)];
      }
      if (!recipe) {
        return notFound("recipe", id);
      }
      return jsonResult(recipe);
    }
  );

  tool(
    "list_ingredients",
    `List ingredients. Returns up to ${PAGE_LIMIT} with {items, total, truncated}; each item has id, name, itemNumber, salable. If truncated, prefer search_ingredients or filter by salable.`,
    { salable: z.boolean().optional().describe("Filter by salable status") },
    async ({ salable }) => {
      let items = demo.ingredients as ReadonlyArray<Record<string, unknown>>;
      if (salable !== undefined) {
        items = items.filter((i) => i.salable === salable);
      }
      return jsonResult(paged(items.map(projectIngredient)));
    }
  );

  tool(
    "search_ingredients",
    `Search ingredients by substring in name/itemNumber (case-insensitive). Returns up to ${PAGE_LIMIT} with {items, total, truncated}. Narrow the query if truncated.`,
    {
      query: z.string().describe("Substring to match"),
      salable: z.boolean().optional().describe("Filter by salable status"),
    },
    async ({ query, salable }) => {
      let items = demo.ingredients as ReadonlyArray<Record<string, unknown>>;
      if (salable !== undefined) {
        items = items.filter((i) => i.salable === salable);
      }
      const filtered = items.filter((i) =>
        matchesQuery([i.name as string | undefined, i.itemNumber as string | undefined], query)
      );
      return jsonResult(paged(filtered.map(projectIngredient)));
    }
  );

  tool(
    "get_ingredient",
    "Get ingredient: conversions, supply options, preparations.",
    { id: z.number() },
    async ({ id }) => {
      const ingredient = demo.ingredientDetails[id];
      if (!ingredient) {
        return notFound("ingredient", id);
      }
      return jsonResult(ingredient);
    }
  );

  tool(
    "list_events",
    "List events in a date range.",
    {
      startDate: z.string().describe("Start, e.g. 2023-01-03T09:00:00"),
      endDate: z.string().describe("End, e.g. 2023-12-31T23:59:59"),
    },
    async ({ startDate, endDate }) => {
      const start = startDate.slice(0, 10);
      const end = endDate.slice(0, 10);
      const filtered = demo.events.filter((e) => e.date >= start && e.date <= end);
      return jsonResult(filtered);
    }
  );

  tool(
    "get_event",
    "Get event with line items.",
    { id: z.number() },
    async ({ id }) => {
      const event = demo.eventDetails[id];
      if (!event) {
        return notFound("event", id);
      }
      return jsonResult(event);
    }
  );

  tool(
    "list_serving_stations",
    "List serving stations.",
    {},
    async () => jsonResult(demo.servingStations)
  );

  tool(
    "list_chef_tags",
    "List chef tags.",
    {},
    async () => jsonResult(demo.chefTags)
  );

  tool(
    "list_chef_users",
    "List chef users.",
    {},
    async () => jsonResult(demo.chefUsers)
  );

  tool(
    "get_access_token",
    "Get CloudFront access token for CDN.",
    {},
    async () =>
      jsonResult({
        policy: "eyJkZW1vIjoidGhpcyBpcyBhIGRlbW8gdG9rZW4ifQ==",
        signature: "DEMO_SIGNATURE",
        keyPairId: "K2DEMO000000",
      })
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
        `date,from,to,item,quantity,uom,cost\n${startDate},Commissary,Location A,Lamb Ground 15%,10,kg,74.00\n${endDate},Commissary,Location B,Bread Whole Wheat,5,kg,12.50`
      )
  );
}
