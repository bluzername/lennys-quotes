import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { randomQuote } from '../db/queries.js';
import { formatHits } from '../format/quotes.js';
import { READ_ONLY, text, type ToolContext } from './context.js';

export function registerRandomWisdomTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'random_wisdom',
    {
      title: 'Random wisdom',
      description: "A random substantive quote from a Lenny's Podcast guest, optionally about a topic.",
      inputSchema: {
        topic: z.string().optional().describe('Optional topic to draw from (e.g. leadership, growth)')
      },
      annotations: { ...READ_ONLY, idempotentHint: false }
    },
    async ({ topic }) => {
      const hit = randomQuote(ctx.db, topic);
      if (!hit) return text(topic ? `No quotes found for topic "${topic}". Try another topic or leave it empty.` : 'No quotes available.');
      return text(`${topic ? `Wisdom about "${topic}"` : 'Random wisdom'}:\n\n${formatHits([hit])}`);
    }
  );
}
