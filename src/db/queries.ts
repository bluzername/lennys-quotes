import type { SqliteDatabase } from './sqlite.js';
import { buildMatchExpression } from './fts-query.js';
import { EPISODE_COLUMNS, SEGMENT_COLUMNS, toEpisodeMeta, toSegment, type EpisodeRow, type JoinedRow } from './rows.js';
import type { DataStatus, Episode, EpisodeMeta, Hit } from '../types.js';

export interface SearchOptions {
  guest?: string;
  limit?: number;
  includeHost?: boolean;
}

const CONTEXT_CHARS = 200;
const MIN_RANDOM_CHARS = 100;

function guestClause(guest: string | undefined): { sql: string; params: string[] } {
  if (!guest?.trim()) return { sql: '', params: [] };
  return { sql: ' AND e.guest LIKE ?', params: [`%${guest.trim()}%`] };
}

function withContext(db: SqliteDatabase, row: JoinedRow, score: number): Hit {
  const neighbours = db
    .prepare(`SELECT idx, text FROM segments WHERE episode_id = ? AND idx IN (?, ?)`)
    .all(row.episode_id, row.idx - 1, row.idx + 1) as Array<{ idx: number; text: string }>;
  const before = neighbours.find((n) => n.idx === row.idx - 1);
  const after = neighbours.find((n) => n.idx === row.idx + 1);
  return {
    episode: toEpisodeMeta(row),
    segment: toSegment(row),
    score,
    contextBefore: before ? before.text.slice(-CONTEXT_CHARS) : undefined,
    contextAfter: after ? after.text.slice(0, CONTEXT_CHARS) : undefined
  };
}

function runSearch(db: SqliteDatabase, match: string, options: SearchOptions): JoinedRow[] {
  const { guest, limit = 5, includeHost = false } = options;
  const g = guestClause(guest);
  const hostClause = includeHost ? '' : ' AND s.is_host = 0';
  const sql = `
    SELECT ${EPISODE_COLUMNS}, ${SEGMENT_COLUMNS}, bm25(segments_fts) AS rank
    FROM segments_fts f
    JOIN segments s ON s.id = f.rowid
    JOIN episodes e ON e.id = s.episode_id
    WHERE segments_fts MATCH ?${hostClause}${g.sql}
    ORDER BY rank
    LIMIT ?`;
  return db.prepare(sql).all(match, ...g.params, limit) as JoinedRow[];
}

/**
 * BM25 full-text search. Tries all terms first; if nothing matches, falls back
 * to any-term so partial queries still return something useful.
 */
export function searchQuotes(db: SqliteDatabase, query: string, options: SearchOptions = {}): Hit[] {
  const strict = buildMatchExpression(query, 'all');
  if (!strict) return [];
  let rows = runSearch(db, strict, options);
  if (rows.length === 0) {
    const loose = buildMatchExpression(query, 'any');
    if (loose && loose !== strict) rows = runSearch(db, loose, options);
  }
  return rows.map((row) => withContext(db, row, -(row.rank ?? 0)));
}

export interface GuestListOptions {
  search?: string;
  sortBy?: 'name' | 'views' | 'date';
  limit?: number;
}

export function listEpisodes(db: SqliteDatabase, options: GuestListOptions = {}): EpisodeMeta[] {
  const { search, sortBy = 'name', limit = 500 } = options;
  const order = { name: 'guest COLLATE NOCASE ASC', views: 'view_count DESC', date: 'publish_date DESC' }[sortBy];
  const where = search?.trim() ? `WHERE guest LIKE ? OR title LIKE ?` : '';
  const params = search?.trim() ? [`%${search.trim()}%`, `%${search.trim()}%`] : [];
  const rows = db
    .prepare(`SELECT * FROM episodes ${where} ORDER BY ${order} LIMIT ?`)
    .all(...params, limit) as unknown as EpisodeRow[];
  return rows.map(toEpisodeMeta);
}

export function findEpisode(db: SqliteDatabase, lookup: string): Episode | null {
  const needle = lookup.trim();
  if (!needle) return null;
  const row = db
    .prepare(`SELECT * FROM episodes WHERE slug = ? OR video_id = ? OR guest LIKE ? OR title LIKE ?
              ORDER BY publish_date DESC LIMIT 1`)
    .get(needle, needle, `%${needle}%`, `%${needle}%`) as unknown as EpisodeRow | undefined;
  if (!row) return null;
  const segments = db
    .prepare(`SELECT idx, speaker, timestamp, seconds, text FROM segments WHERE episode_id = ? ORDER BY idx`)
    .all(row.id) as Array<{ idx: number; speaker: string; timestamp: string; seconds: number; text: string }>;
  return { ...toEpisodeMeta(row), segments: segments.map(toSegment) };
}

export function randomQuote(db: SqliteDatabase, topic?: string): Hit | null {
  if (topic?.trim()) {
    const hits = searchQuotes(db, topic, { limit: 50 });
    if (hits.length === 0) return null;
    return hits[Math.floor(Math.random() * hits.length)] ?? null;
  }
  const row = db
    .prepare(`
      SELECT ${EPISODE_COLUMNS}, ${SEGMENT_COLUMNS}
      FROM segments s JOIN episodes e ON e.id = s.episode_id
      WHERE s.is_host = 0 AND length(s.text) >= ?
      ORDER BY random() LIMIT 1`)
    .get(MIN_RANDOM_CHARS) as JoinedRow | undefined;
  return row ? withContext(db, row, 1) : null;
}

export function dataStatus(db: SqliteDatabase, dbPath: string): DataStatus {
  const counts = db
    .prepare(`SELECT (SELECT count(*) FROM episodes) AS episodes, (SELECT count(*) FROM segments) AS segments`)
    .get() as { episodes: number; segments: number };
  const newest = db
    .prepare(`SELECT guest, title, publish_date FROM episodes WHERE publish_date <> '' ORDER BY publish_date DESC LIMIT 1`)
    .get() as { guest: string; title: string; publish_date: string } | undefined;
  const built = db.prepare(`SELECT value FROM meta WHERE key = 'built_at'`).get() as { value: string } | undefined;
  return {
    episodes: counts.episodes,
    segments: counts.segments,
    newestEpisode: newest ? `${newest.guest}: ${newest.title}` : '',
    newestPublishDate: newest?.publish_date ?? '',
    builtAt: built?.value ?? '',
    dbPath
  };
}
