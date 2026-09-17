import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { searchQuotes } from '../db/queries.js';
import { formatHits } from '../format/quotes.js';
import { READ_ONLY, text, type ToolContext } from './context.js';

export function registerSearchTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'search_quotes',
    {
      title: 'Search quotes',
      description:
        "Full-text search across every Lenny's Podcast transcript. Returns the best matching quotes with speaker, episode, date and a YouTube link to the exact moment. Wrap phrases in double quotes for exact matches.",
      inputSchema: {
        query: z.string().min(1).describe('Topic, keyword, or "exact phrase" (e.g. "product-market fit", hiring, growth loops)'),
        guest: z.string().optional().describe('Only quotes from episodes with this guest (substring match, e.g. "Chesky")'),
        limit: z.number().int().min(1).max(20).default(5).describe('Maximum number of quotes'),
        include_host: z.boolean().default(false).describe("Also return Lenny's own lines (questions and intros). Off by default so results are guest insights.")
      },
      annotations: READ_ONLY
    },
    async ({ query, guest, limit, include_host }) => {
      const hits = searchQuotes(ctx.db, query, { guest, limit, includeHost: include_host });
      if (hits.length === 0) {
        return text(`No quotes found for "${query}"${guest ? ` from guest "${guest}"` : ''}. Try fewer or different words${guest ? ', or drop the guest filter' : ''}.`);
      }
      return text(`Found ${hits.length} quote(s) for "${query}":\n\n${formatHits(hits)}`);
    }
  );
}
