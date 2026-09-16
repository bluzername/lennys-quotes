import { createRequire } from 'node:module';

/**
 * node:sqlite is stable enough for our read-mostly use but still prints an
 * ExperimentalWarning on some Node versions. Silence only that warning so
 * MCP client logs stay clean, then load the module.
 */
const require = createRequire(import.meta.url);

export type SqliteDatabase = import('node:sqlite').DatabaseSync;
type SqliteModule = typeof import('node:sqlite');

const originalEmitWarning = process.emitWarning;
process.emitWarning = ((warning: string | Error, ...rest: unknown[]) => {
  const text = typeof warning === 'string' ? warning : warning.message;
  if (text.includes('SQLite is an experimental feature')) return;
  return (originalEmitWarning as (...args: unknown[]) => void).call(process, warning, ...rest);
}) as typeof process.emitWarning;

const sqlite: SqliteModule = require('node:sqlite');

export const DatabaseSync = sqlite.DatabaseSync;
