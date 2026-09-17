export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  guest TEXT NOT NULL,
  title TEXT NOT NULL,
  video_id TEXT NOT NULL,
  youtube_url TEXT NOT NULL,
  publish_date TEXT NOT NULL,
  description TEXT NOT NULL,
  duration_seconds REAL NOT NULL,
  duration TEXT NOT NULL,
  view_count INTEGER NOT NULL,
  keywords TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS segments (
  id INTEGER PRIMARY KEY,
  episode_id INTEGER NOT NULL REFERENCES episodes(id),
  idx INTEGER NOT NULL,
  speaker TEXT NOT NULL,
  is_host INTEGER NOT NULL,
  timestamp TEXT NOT NULL,
  seconds INTEGER NOT NULL,
  text TEXT NOT NULL,
  UNIQUE (episode_id, idx)
);

CREATE VIRTUAL TABLE IF NOT EXISTS segments_fts USING fts5(
  text,
  content='segments',
  content_rowid='id',
  tokenize='porter unicode61'
);

CREATE INDEX IF NOT EXISTS idx_segments_episode ON segments(episode_id, idx);
CREATE INDEX IF NOT EXISTS idx_episodes_guest ON episodes(guest COLLATE NOCASE);
`;
