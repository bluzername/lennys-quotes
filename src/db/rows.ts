import type { EpisodeMeta, Segment } from '../types.js';

export interface EpisodeRow {
  id: number;
  slug: string;
  guest: string;
  title: string;
  video_id: string;
  youtube_url: string;
  publish_date: string;
  description: string;
  duration_seconds: number;
  duration: string;
  view_count: number;
  keywords: string;
}

export interface SegmentRow {
  id: number;
  episode_id: number;
  idx: number;
  speaker: string;
  is_host: number;
  timestamp: string;
  seconds: number;
  text: string;
}

export const EPISODE_COLUMNS = `
  e.id AS e_id, e.slug, e.guest, e.title, e.video_id, e.youtube_url, e.publish_date,
  e.description, e.duration_seconds, e.duration, e.view_count, e.keywords`;

export const SEGMENT_COLUMNS = `
  s.id AS s_id, s.episode_id, s.idx, s.speaker, s.is_host, s.timestamp, s.seconds, s.text`;

export type JoinedRow = Omit<EpisodeRow, 'id'> & Omit<SegmentRow, 'id'> & {
  e_id: number;
  s_id: number;
  rank?: number;
};

export function toEpisodeMeta(row: Omit<EpisodeRow, 'id'>): EpisodeMeta {
  let keywords: string[] = [];
  try {
    keywords = JSON.parse(row.keywords) as string[];
  } catch {
    keywords = [];
  }
  return {
    slug: row.slug,
    guest: row.guest,
    title: row.title,
    videoId: row.video_id,
    youtubeUrl: row.youtube_url,
    publishDate: row.publish_date,
    description: row.description,
    durationSeconds: row.duration_seconds,
    duration: row.duration,
    viewCount: row.view_count,
    keywords
  };
}

export function toSegment(row: Omit<SegmentRow, 'id' | 'episode_id' | 'is_host'>): Segment {
  return {
    idx: row.idx,
    speaker: row.speaker,
    timestamp: row.timestamp,
    seconds: row.seconds,
    text: row.text
  };
}
