import matter from 'gray-matter';
import type { Video } from './youtube.js';

export interface Frontmatter {
  guest: string;
  title: string;
  youtube_url?: string;
  video_id?: string;
  publish_date?: string;
  description?: string;
  duration_seconds?: number;
  duration?: string;
  view_count?: number;
  channel: string;
  keywords: string[];
}

const CHANNEL_NAME = "Lenny's Podcast";
const DESCRIPTION_MAX = 300;

export function formatDuration(seconds: number): string {
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function shortDescription(description: string | undefined): string | undefined {
  const first = description?.trim().split('\n', 1)[0]?.trim();
  if (!first) return undefined;
  if (first.length <= DESCRIPTION_MAX) return first;
  return `${first.slice(0, DESCRIPTION_MAX).replace(/\s+\S*$/, '')}...`;
}

export function buildFrontmatter(guest: string, video: Video | null): Frontmatter {
  const fm: Frontmatter = { guest, title: video?.title || guest, channel: CHANNEL_NAME, keywords: [] };
  if (!video) return fm;
  fm.youtube_url = `https://www.youtube.com/watch?v=${video.id}`;
  fm.video_id = video.id;
  if (video.publishDate) fm.publish_date = video.publishDate;
  const description = shortDescription(video.description);
  if (description) fm.description = description;
  if (video.durationSeconds) {
    fm.duration_seconds = video.durationSeconds;
    fm.duration = formatDuration(video.durationSeconds);
  }
  if (video.viewCount !== undefined) fm.view_count = video.viewCount;
  return fm;
}

/** Drop blank lines between speaker turns and trailing whitespace, matching the archive layout. */
export function compactBody(raw: string): string {
  return raw
    .split('\n')
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim() !== '')
    .join('\n');
}

export function renderTranscript(fm: Frontmatter, body: string): string {
  const content = `# ${fm.title}\n## Transcript\n${compactBody(body)}\n`;
  return matter.stringify(content, fm as unknown as Record<string, unknown>);
}
