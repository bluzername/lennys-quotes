import { readFile } from 'node:fs/promises';
import path from 'node:path';
import matter from 'gray-matter';
import type { Episode } from '../types.js';
import { parseBody } from './parse-body.js';

function asString(value: unknown, fallback = ''): string {
  if (value === undefined || value === null) return fallback;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  return String(value);
}

function asNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map((v) => String(v)) : [];
}

/** Parse one episodes/{slug}/transcript.md file into an Episode. */
export function parseTranscript(slug: string, content: string): Episode {
  const { data, content: body } = matter(content);
  const videoId = asString(data.video_id);
  return {
    slug,
    guest: asString(data.guest, 'Unknown'),
    title: asString(data.title, slug),
    videoId,
    youtubeUrl: asString(data.youtube_url, videoId ? `https://www.youtube.com/watch?v=${videoId}` : ''),
    publishDate: asString(data.publish_date),
    description: asString(data.description).trim(),
    durationSeconds: asNumber(data.duration_seconds),
    duration: asString(data.duration),
    viewCount: asNumber(data.view_count),
    keywords: asStringArray(data.keywords),
    segments: parseBody(body)
  };
}

export async function loadTranscriptFile(filePath: string): Promise<Episode> {
  const slug = path.basename(path.dirname(filePath));
  const content = await readFile(filePath, 'utf8');
  return parseTranscript(slug, content);
}
