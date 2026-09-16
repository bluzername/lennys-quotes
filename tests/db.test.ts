import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildDatabase } from '../src/db/build.js';
import { openDatabase } from '../src/db/open.js';
import { searchQuotes, listEpisodes, findEpisode, randomQuote, dataStatus } from '../src/db/queries.js';
import type { SqliteDatabase } from '../src/db/sqlite.js';

const fixtures = path.join(path.dirname(new URL(import.meta.url).pathname), 'fixtures', 'episodes');
let dir: string;
let db: SqliteDatabase;
let dbPath: string;

before(async () => {
  dir = await mkdtemp(path.join(os.tmpdir(), 'lenny-test-'));
  dbPath = path.join(dir, 'test.db');
  const result = await buildDatabase(fixtures, dbPath);
  assert.equal(result.episodes, 2);
  assert.equal(result.segments, 7);
  db = openDatabase(dbPath);
});

after(async () => {
  db.close();
  await rm(dir, { recursive: true, force: true });
});

test('search ranks matching guest segments and excludes host by default', () => {
  const hits = searchQuotes(db, 'product-market fit');
  assert.equal(hits.length, 1);
  assert.equal(hits[0]!.segment.speaker, 'Ada Lovelace');
  assert.ok(hits[0]!.contextBefore?.includes('welcome'));
  assert.ok(hits[0]!.contextAfter?.includes('hiring'));
  assert.equal(searchQuotes(db, 'product-market fit', { includeHost: true }).length, 2);
});

test('search stems, supports phrases, guest filter, and any-term fallback', () => {
  assert.equal(searchQuotes(db, 'sails')[0]?.episode.guest, 'Grace Hopper');
  assert.equal(searchQuotes(db, '"talent density"').length, 1);
  assert.equal(searchQuotes(db, 'leadership', { guest: 'lovelace' }).length, 0);
  assert.equal(searchQuotes(db, 'port unicorns').length, 1);
  assert.ok(searchQuotes(db, 'NOT AND OR').length >= 1, 'FTS operators are treated as literal words');
});

test('episode listing and lookup', () => {
  assert.deepEqual(listEpisodes(db, { sortBy: 'date' }).map((e) => e.guest), ['Grace Hopper', 'Ada Lovelace']);
  assert.deepEqual(listEpisodes(db, { sortBy: 'views' }).map((e) => e.viewCount), [5000, 1000]);
  assert.equal(listEpisodes(db, { search: 'harbor' }).length, 1);
  assert.equal(findEpisode(db, 'ada-lovelace')?.segments.length, 4);
  assert.equal(findEpisode(db, 'grace0000001')?.guest, 'Grace Hopper');
  assert.deepEqual(findEpisode(db, 'Ada')?.keywords, ['engineering', 'history']);
  assert.equal(findEpisode(db, 'nobody'), null);
});

test('random quote and status', () => {
  const hit = randomQuote(db);
  assert.ok(hit && hit.segment.text.length >= 100 && hit.segment.speaker !== 'Lenny Rachitsky');
  assert.equal(randomQuote(db, 'leadership')?.episode.guest, 'Grace Hopper');
  const status = dataStatus(db, dbPath);
  assert.equal(status.episodes, 2);
  assert.equal(status.newestPublishDate, '2025-01-15');
  assert.ok(status.builtAt);
});
