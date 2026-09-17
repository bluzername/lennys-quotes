import { readdir, stat, mkdir, rename, rm } from 'node:fs/promises';
import path from 'node:path';
import { DatabaseSync } from './sqlite.js';
import { SCHEMA_SQL } from './schema.js';
import { loadTranscriptFile } from '../ingest/parse-transcript.js';
import { isHost } from '../ingest/parse-body.js';
import type { Episode } from '../types.js';

export interface BuildResult {
  episodes: number;
  segments: number;
  dbPath: string;
}

async function listTranscriptFiles(episodesDir: string): Promise<string[]> {
  const entries = await readdir(episodesDir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const file = path.join(episodesDir, entry.name, 'transcript.md');
    try {
      await stat(file);
      files.push(file);
    } catch {
      // folder without a transcript: skip
    }
  }
  return files.sort();
}

function insertEpisode(db: InstanceType<typeof DatabaseSync>, episode: Episode): number {
  const insertEpisode = db.prepare(`
    INSERT INTO episodes (slug, guest, title, video_id, youtube_url, publish_date, description,
      duration_seconds, duration, view_count, keywords)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const insertSegment = db.prepare(`
    INSERT INTO segments (episode_id, idx, speaker, is_host, timestamp, seconds, text)
    VALUES (?, ?, ?, ?, ?, ?, ?)`);

  const result = insertEpisode.run(
    episode.slug, episode.guest, episode.title, episode.videoId, episode.youtubeUrl,
    episode.publishDate, episode.description, episode.durationSeconds, episode.duration,
    episode.viewCount, JSON.stringify(episode.keywords)
  );
  const episodeId = Number(result.lastInsertRowid);
  for (const segment of episode.segments) {
    insertSegment.run(episodeId, segment.idx, segment.speaker, isHost(segment.speaker) ? 1 : 0,
      segment.timestamp, segment.seconds, segment.text);
  }
  return episode.segments.length;
}

/** Build a fresh SQLite database from episodes/{slug}/transcript.md files. */
export async function buildDatabase(episodesDir: string, dbPath: string): Promise<BuildResult> {
  const files = await listTranscriptFiles(episodesDir);
  if (files.length === 0) throw new Error(`No transcripts found under ${episodesDir}`);

  await mkdir(path.dirname(dbPath), { recursive: true });
  const tmpPath = `${dbPath}.building`;
  await rm(tmpPath, { force: true });

  const db = new DatabaseSync(tmpPath);
  db.exec('PRAGMA journal_mode = OFF; PRAGMA synchronous = OFF;');
  db.exec(SCHEMA_SQL);

  let segments = 0;
  let episodes = 0;
  db.exec('BEGIN');
  for (const file of files) {
    const episode = await loadTranscriptFile(file);
    if (episode.segments.length === 0) continue;
    segments += insertEpisode(db, episode);
    episodes += 1;
  }
  db.exec(`INSERT INTO segments_fts(segments_fts) VALUES ('rebuild')`);
  db.prepare(`INSERT INTO meta (key, value) VALUES ('built_at', ?)`).run(new Date().toISOString());
  db.prepare(`INSERT INTO meta (key, value) VALUES ('schema_version', ?)`).run('1');
  db.exec('COMMIT');
  db.exec(`INSERT INTO segments_fts(segments_fts) VALUES ('optimize')`);
  db.exec('VACUUM');
  db.close();

  await rename(tmpPath, dbPath);
  return { episodes, segments, dbPath };
}
