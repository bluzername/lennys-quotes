import os from 'node:os';
import path from 'node:path';

export const DATA_RELEASE_URL =
  'https://github.com/bluzername/lennys-quotes/releases/download/data/lennys.db.gz';

export const DB_FILENAME = 'lennys.db';

/** Per-user cache directory, XDG aware. */
export function cacheDir(env: NodeJS.ProcessEnv = process.env): string {
  const base = env.XDG_CACHE_HOME || path.join(os.homedir(), '.cache');
  return path.join(base, 'lennys-wisdom');
}

export function cachedDbPath(env: NodeJS.ProcessEnv = process.env): string {
  return path.join(cacheDir(env), DB_FILENAME);
}

export function metaPath(dbPath: string): string {
  return `${dbPath}.meta.json`;
}
