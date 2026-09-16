import type { SqliteDatabase } from '../db/sqlite.js';

export interface ToolContext {
  db: SqliteDatabase;
  dbPath: string;
}

export const READ_ONLY = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };

export function text(value: string): { content: Array<{ type: 'text'; text: string }> } {
  return { content: [{ type: 'text', text: value }] };
}
