#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { resolveDatabase } from './data/resolve.js';
import { openDatabase } from './db/open.js';
import { dataStatus } from './db/queries.js';
import { createServer } from './server.js';
import { packageVersion } from './version.js';

const log = (message: string): void => console.error(`[lennys-wisdom] ${message}`);

async function main(): Promise<void> {
  const resolved = await resolveDatabase({ log });
  const db = openDatabase(resolved.dbPath);
  const status = dataStatus(db, resolved.dbPath);
  log(`${status.episodes} episodes, newest ${status.newestPublishDate || 'unknown'} (data from ${resolved.source})`);

  const server = createServer({ db, dbPath: resolved.dbPath }, packageVersion());
  await server.connect(new StdioServerTransport());
  log('ready');
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log(`fatal: ${message}`);
  log('Set LENNYS_DB=/path/to/lennys.db to use a local database, or check your network for the first-run download.');
  process.exit(1);
});
