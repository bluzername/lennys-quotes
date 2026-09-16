import { createWriteStream } from 'node:fs';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { createGunzip } from 'node:zlib';
import { metaPath } from './paths.js';

export interface CacheMeta {
  etag: string | null;
  checkedAt: string;
  sourceUrl: string;
}

export type DownloadOutcome = 'downloaded' | 'not-modified';

export async function readMeta(dbPath: string): Promise<CacheMeta | null> {
  try {
    const raw = await readFile(metaPath(dbPath), 'utf8');
    const parsed = JSON.parse(raw) as Partial<CacheMeta>;
    if (typeof parsed.checkedAt !== 'string') return null;
    return { etag: parsed.etag ?? null, checkedAt: parsed.checkedAt, sourceUrl: parsed.sourceUrl ?? '' };
  } catch {
    return null;
  }
}

export async function writeMeta(dbPath: string, meta: CacheMeta): Promise<void> {
  await writeFile(metaPath(dbPath), JSON.stringify(meta, null, 2));
}

/**
 * Fetch the gzipped database from `url` into `dbPath`, atomically.
 * Sends If-None-Match when we already hold an ETag so unchanged data costs one
 * small request. Throws on network or HTTP failure; callers decide the fallback.
 */
export async function downloadDatabase(
  url: string,
  dbPath: string,
  previousEtag: string | null,
  fetchImpl: typeof fetch = fetch
): Promise<DownloadOutcome> {
  const headers: Record<string, string> = { 'User-Agent': 'lennys-podcast-wisdom' };
  if (previousEtag) headers['If-None-Match'] = previousEtag;

  const response = await fetchImpl(url, { headers, redirect: 'follow' });
  const now = new Date().toISOString();

  if (response.status === 304) {
    await writeMeta(dbPath, { etag: previousEtag, checkedAt: now, sourceUrl: url });
    return 'not-modified';
  }
  if (!response.ok || !response.body) {
    throw new Error(`Data download failed: HTTP ${response.status} from ${url}`);
  }

  await mkdir(path.dirname(dbPath), { recursive: true });
  const tmpPath = `${dbPath}.download-${process.pid}`;
  try {
    await pipeline(Readable.fromWeb(response.body as never), createGunzip(), createWriteStream(tmpPath));
    await rename(tmpPath, dbPath);
  } catch (error) {
    await rm(tmpPath, { force: true });
    throw error;
  }
  await writeMeta(dbPath, { etag: response.headers.get('etag'), checkedAt: now, sourceUrl: url });
  return 'downloaded';
}
