import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { dataStatus } from '../db/queries.js';
import { formatStatus } from '../format/quotes.js';
import { READ_ONLY, text, type ToolContext } from './context.js';

export function registerStatusTool(server: McpServer, ctx: ToolContext): void {
  server.registerTool(
    'data_status',
    {
      title: 'Data status',
      description: 'How current the transcript data is: episode count, newest episode, when the data was built, and where it is stored.',
      inputSchema: {},
      annotations: READ_ONLY
    },
    async () => text(formatStatus(dataStatus(ctx.db, ctx.dbPath)))
  );
}
