#!/usr/bin/env node
import path from 'node:path';
import { writeFile } from 'node:fs/promises';
import { buildDatabase } from '../db/build.js';
import { openDatabase } from '../db/open.js';
import { dataStatus } from '../db/queries.js';

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const episodesDir = process.argv[2] ?? path.join(root, 'episodes');
const dbPath = process.argv[3] ?? path.join(root, 'data', 'lennys.db');

const started = Date.now();
const result = await buildDatabase(episodesDir, dbPath);
const db = openDatabase(dbPath);
const status = dataStatus(db, dbPath);
db.close();

const statusFile = path.join(root, 'data', 'status.json');
await writeFile(
  statusFile,
  JSON.stringify(
    {
      episodes: status.episodes,
      segments: status.segments,
      newestEpisode: status.newestEpisode,
      newestPublishDate: status.newestPublishDate,
      builtAt: status.builtAt
    },
    null,
    2
  ) + '\n'
);

console.log(`Built ${result.dbPath}: ${result.episodes} episodes, ${result.segments} segments in ${((Date.now() - started) / 1000).toFixed(1)}s`);
console.log(`Newest: ${status.newestEpisode} (${status.newestPublishDate})`);
