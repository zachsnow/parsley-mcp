import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import * as demo from "./demo-data.js";

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

function notFound(type: string, id: string | number) {
  return {
    content: [{ type: "text" as const, text: `No ${type} found with ID ${id}` }],
    isError: true as const,
  };
}

export function registerDemoTools(server: McpServer) {
  server.tool(
    "list_menu_items",
    "List all menu items (recipes, subrecipes, ingredients) with IDs, names, tags, and prices",
    { syncTag: z.string().optional().describe("Filter by sync tag name") },
    async ({ syncTag }) => {
      let items = demo.menuItems;
      if (syncTag) {
        items = items.filter((i) => i.tags.includes(syncTag));
      }
      return jsonResult(items);
    }
  );

  server.tool(
    "get_menu_item",
    "Get detailed info for a menu item including description, nutrition, allergens, and photo URL",
    {
      id: z.string().describe("Menu item ID (numeric) or item number (string)"),
      getByItemNumber: z.boolean().optional().describe("Set true if id is an item number string"),
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

  server.tool(
    "list_menus",
    "List all available menus with their IDs and names",
    {},
    async () => jsonResult(demo.menus)
  );

  server.tool(
    "get_menu",
    "Get full menu details including sections, stations, and menu items",
    { id: z.number().describe("Menu ID") },
    async ({ id }) => {
      const menu = demo.menuDetails[id];
      if (!menu) {
        return notFound("menu", id);
      }
      return jsonResult(menu);
    }
  );

  server.tool(
    "get_recipe",
    "Get recipe details including steps, ingredients, sub-recipes, nutrition, and cost",
    {
      id: z.string().describe("Recipe ID (numeric) or item number (string)"),
      getByItemNumber: z.boolean().optional().describe("Set true if id is an item number string"),
      roundedQuantities: z.boolean().optional().describe("Round quantities to 2 decimal places (default true)"),
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

  server.tool(
    "list_ingredients",
    "List all ingredients with IDs, names, and whether they are used by recipes",
    { salable: z.boolean().optional().describe("Filter by salable status") },
    async () => jsonResult(demo.ingredients)
  );

  server.tool(
    "get_ingredient",
    "Get detailed ingredient info including conversions, supply options, and preparations",
    { id: z.number().describe("Ingredient ID") },
    async ({ id }) => {
      const ingredient = demo.ingredientDetails[id];
      if (!ingredient) {
        return notFound("ingredient", id);
      }
      return jsonResult(ingredient);
    }
  );

  server.tool(
    "list_events",
    "List events in a date range",
    {
      startDate: z.string().describe("Start date (inclusive), e.g. 2023-01-03T09:00:00"),
      endDate: z.string().describe("End date (inclusive), e.g. 2023-12-31T23:59:59"),
    },
    async ({ startDate, endDate }) => {
      const start = startDate.slice(0, 10);
      const end = endDate.slice(0, 10);
      const filtered = demo.events.filter((e) => e.date >= start && e.date <= end);
      return jsonResult(filtered);
    }
  );

  server.tool(
    "get_event",
    "Get full details of an event including all line items",
    { id: z.number().describe("Event ID") },
    async ({ id }) => {
      const event = demo.eventDetails[id];
      if (!event) {
        return notFound("event", id);
      }
      return jsonResult(event);
    }
  );

  server.tool(
    "list_serving_stations",
    "List all serving stations with IDs and names",
    {},
    async () => jsonResult(demo.servingStations)
  );

  server.tool(
    "list_chef_tags",
    "List all chef tags with IDs and names",
    {},
    async () => jsonResult(demo.chefTags)
  );

  server.tool(
    "list_chef_users",
    "List all chef users with IDs, emails, and permission levels",
    {},
    async () => jsonResult(demo.chefUsers)
  );

  server.tool(
    "get_access_token",
    "Generate a CloudFront access token for CDN resource access",
    {},
    async () =>
      jsonResult({
        policy: "eyJkZW1vIjoidGhpcyBpcyBhIGRlbW8gdG9rZW4ifQ==",
        signature: "DEMO_SIGNATURE",
        keyPairId: "K2DEMO000000",
      })
  );

  server.tool(
    "get_commissary_report",
    "Get commissary transaction report as CSV (commissary accounts only)",
    {
      startDate: z.string().describe("Start date, YYYY-MM-DD"),
      endDate: z.string().describe("End date, YYYY-MM-DD"),
    },
    async ({ startDate, endDate }) =>
      jsonResult(
        `date,from,to,item,quantity,uom,cost\n${startDate},Commissary,Location A,Lamb Ground 15%,10,kg,74.00\n${endDate},Commissary,Location B,Bread Whole Wheat,5,kg,12.50`
      )
  );
}
