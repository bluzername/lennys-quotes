import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { gzipSync } from 'node:zlib';
import { downloadDatabase, readMeta, writeMeta } from '../src/data/download.js';
import { resolveDatabase } from '../src/data/resolve.js';
import { cachedDbPath } from '../src/data/paths.js';

function fakeFetch(status: number, body?: string, etag = 'W/"abc"'): typeof fetch {
  return (async (_url: unknown, init?: RequestInit) => {
    const sent = (init?.headers as Record<string, string>)?.['If-None-Match'];
    if (sent === etag && status === 200) return new Response(null, { status: 304 });
    if (status !== 200) return new Response(null, { status });
    const gz = gzipSync(Buffer.from(body ?? ''));
    return new Response(new Blob([gz]).stream(), { status: 200, headers: { etag } });
  }) as typeof fetch;
}

test('downloadDatabase gunzips atomically and honours ETag', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lenny-dl-'));
  const dbPath = path.join(dir, 'x.db');
  const fetchImpl = fakeFetch(200, 'hello-db');
  assert.equal(await downloadDatabase('http://x', dbPath, null, fetchImpl), 'downloaded');
  assert.equal(await readFile(dbPath, 'utf8'), 'hello-db');
  const meta = await readMeta(dbPath);
  assert.equal(meta?.etag, 'W/"abc"');
  assert.equal(await downloadDatabase('http://x', dbPath, meta!.etag, fetchImpl), 'not-modified');
  await assert.rejects(downloadDatabase('http://x', dbPath, null, fakeFetch(500)), /HTTP 500/);
  await rm(dir, { recursive: true, force: true });
});

test('resolveDatabase prefers LENNYS_DB, then fresh cache, then background refresh', async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'lenny-rs-'));
  const explicit = path.join(dir, 'explicit.db');
  await writeFile(explicit, 'x');
  assert.equal((await resolveDatabase({ env: { LENNYS_DB: explicit } })).source, 'env');
  await assert.rejects(resolveDatabase({ env: { LENNYS_DB: path.join(dir, 'missing.db') } }), /missing file/);

  const env = { XDG_CACHE_HOME: dir, LENNYS_OFFLINE: '1' };
  await assert.rejects(resolveDatabase({ env }), /LENNYS_OFFLINE/);

  const cache = cachedDbPath(env);
  await writeFile(cache, 'cached').catch(async () => {
    await (await import('node:fs/promises')).mkdir(path.dirname(cache), { recursive: true });
    await writeFile(cache, 'cached');
  });
  await writeMeta(cache, { etag: null, checkedAt: new Date().toISOString(), sourceUrl: '' });
  const fresh = await resolveDatabase({ env: { XDG_CACHE_HOME: dir } });
  assert.equal(fresh.source, 'cache');
  assert.equal(fresh.refresh, undefined);

  const old = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  await writeMeta(cache, { etag: null, checkedAt: old, sourceUrl: '' });
  const messages: string[] = [];
  const stale = await resolveDatabase({ env: { XDG_CACHE_HOME: dir, LENNYS_DATA_URL: 'http://127.0.0.1:9/none' }, log: (m) => messages.push(m) });
  assert.equal(stale.source, 'cache');
  await stale.refresh;
  assert.ok(messages.some((m) => m.includes('Background data refresh skipped')));
  await rm(dir, { recursive: true, force: true });
});
