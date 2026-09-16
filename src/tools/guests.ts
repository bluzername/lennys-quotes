import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { listEpisodes } from '../db/queries.js';
import { formatEpisodeLine } from '../format/quotes.js';
import { READ_ONLY, text, type ToolContext } from './context.js';

export function registerListGuestsTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'list_guests',
    {
      title: 'List guests and episodes',
      description: "List Lenny's Podcast episodes with guest, title, publish date and view count. Sort by date to see the newest episodes.",
      inputSchema: {
        search: z.string().optional().describe('Filter by guest name or episode title (substring)'),
        sort_by: z.enum(['name', 'views', 'date']).default('name').describe('Sort order: name (A-Z), views (most viewed first) or date (newest first)'),
        limit: z.number().int().min(1).max(500).default(100).describe('Maximum number of episodes to list')
      },
      annotations: READ_ONLY
    },
    async ({ search, sort_by, limit }) => {
      const episodes = listEpisodes(ctx.db, { search, sortBy: sort_by, limit });
      if (episodes.length === 0) {
        return text(search ? `No episodes match "${search}".` : 'No episodes in the database.');
      }
      return text(`${episodes.length} episode(s):\n\n${episodes.map(formatEpisodeLine).join('\n')}`);
    }
  );
}
