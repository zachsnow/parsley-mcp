# Parsley MCP Server

An [MCP](https://modelcontextprotocol.io/) server that gives AI assistants access to [Parsley](https://parsleycooks.com) — recipe management, menu planning, and event operations for food service.

## Hosted

A hosted version is available at [parsley.vein.io](https://parsley.vein.io). Connect any MCP client using a Remote transport with your Parsley API token, passed either as a Bearer token in the `Authorization` header or as a `?token=` query parameter.

Read-only endpoint:

```
https://parsley.vein.io/mcp
```

Read-write endpoint (includes event and user management):

```
https://parsley.vein.io/mcp/write
```

Demo endpoint (no auth required, mock data):

```
https://parsley.vein.io/mcp/demo
```

### Filtering tools

Pass `?tools=a,b,c` to register only the tools you need, trimming the tool schema from the context window:

```
https://parsley.vein.io/mcp?tools=list_menu_items,get_recipe,list_events
```

Unknown names return 400. Works on `/mcp`, `/mcp/write`, and `/mcp/demo`.

## Local (stdio)

Run locally via npx:

```bash
PARSLEY_API_TOKEN=your_token npx parsley-mcp
```

Or with write access:

```bash
PARSLEY_API_TOKEN=your_token npx parsley-mcp --enable-writes
```

### Claude Desktop configuration

```json
{
  "mcpServers": {
    "parsley": {
      "command": "npx",
      "args": ["parsley-mcp"],
      "env": {
        "PARSLEY_API_TOKEN": "your_token"
      }
    }
  }
}
```

## Tools

**Read-only:** list/get menu items, menus, recipes, ingredients, events, chef users, chef tags, serving stations, commissary reports, and CDN access tokens.

**Write (opt-in):** create/update events, push sales/waste/leftover data, create/update/delete chef users, and manage chef tags.

## Development

```bash
npm install
npm run build
npm start
```

Deploy to Cloudflare Workers:

```bash
npm run deploy
```

## License

MIT
