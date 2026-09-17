import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { ToolContext } from './tools/context.js';
import { registerSearchTool } from './tools/search.js';
import { registerSmartSearchTool } from './tools/smart-search.js';
import { registerListGuestsTool } from './tools/guests.js';
import { registerGetEpisodeTool } from './tools/episode.js';
import { registerRandomWisdomTool } from './tools/random.js';
import { registerStatusTool } from './tools/status.js';

export const SERVER_NAME = 'lennys-podcast-wisdom';

export function createServer(ctx: ToolContext, version: string): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version },
    {
      instructions:
        "Search and browse Lenny's Podcast transcripts. Use search_quotes for keyword lookups, search_quotes_smart for nuanced topics, list_guests with sort_by=date for the newest episodes, and data_status to check how current the data is."
    }
  );
  registerSearchTool(server, ctx);
  registerSmartSearchTool(server, ctx);
  registerListGuestsTool(server, ctx);
  registerGetEpisodeTool(server, ctx);
  registerRandomWisdomTool(server, ctx);
  registerStatusTool(server, ctx);
  return server;
}
