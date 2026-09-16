import { access } from 'node:fs/promises';
import { DATA_RELEASE_URL, cachedDbPath } from './paths.js';
import { downloadDatabase, readMeta } from './download.js';

export interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  log?: (message: string) => void;
  now?: () => number;
}

export interface ResolvedData {
  dbPath: string;
  source: 'env' | 'cache' | 'download';
  /** Set when a refresh was started in the background; resolves when it finishes. */
  refresh?: Promise<void>;
}

const HOURS = 60 * 60 * 1000;
const DEFAULT_REFRESH_HOURS = 24;

async function exists(file: string): Promise<boolean> {
  try {
    await access(file);
    return true;
  } catch {
    return false;
  }
}

function refreshIntervalMs(env: NodeJS.ProcessEnv): number {
  const hours = Number(env.LENNYS_REFRESH_HOURS);
  return (Number.isFinite(hours) && hours > 0 ? hours : DEFAULT_REFRESH_HOURS) * HOURS;
}

/**
 * Decide which database file to open.
 *
 * 1. LENNYS_DB points at a file: use it, never download.
 * 2. Cached copy exists: use it immediately. If it is older than the refresh
 *    interval, refresh in the background so the next start picks it up.
 * 3. No cache: download now (first run), fail loudly if that is impossible.
 *
 * LENNYS_OFFLINE=1 disables all network access.
 */
export async function resolveDatabase(options: ResolveOptions = {}): Promise<ResolvedData> {
  const env = options.env ?? process.env;
  const log = options.log ?? (() => undefined);
  const now = options.now ?? Date.now;
  const url = env.LENNYS_DATA_URL || DATA_RELEASE_URL;

  if (env.LENNYS_DB) {
    if (!(await exists(env.LENNYS_DB))) throw new Error(`LENNYS_DB points at a missing file: ${env.LENNYS_DB}`);
    return { dbPath: env.LENNYS_DB, source: 'env' };
  }

  const dbPath = cachedDbPath(env);
  const offline = env.LENNYS_OFFLINE === '1';
  const cached = await exists(dbPath);

  if (cached) {
    const meta = await readMeta(dbPath);
    const age = meta ? now() - Date.parse(meta.checkedAt) : Number.POSITIVE_INFINITY;
    if (offline || age < refreshIntervalMs(env)) return { dbPath, source: 'cache' };

    const refresh = downloadDatabase(url, dbPath, meta?.etag ?? null)
      .then((outcome) => log(`Transcript data ${outcome === 'downloaded' ? 'updated; restart to load it' : 'is current'}`))
      .catch((error: unknown) => log(`Background data refresh skipped: ${(error as Error).message}`));
    return { dbPath, source: 'cache', refresh };
  }

  if (offline) throw new Error(`No cached transcript data at ${dbPath} and LENNYS_OFFLINE=1`);
  log(`Downloading transcript data to ${dbPath} ...`);
  await downloadDatabase(url, dbPath, null);
  return { dbPath, source: 'download' };
}
