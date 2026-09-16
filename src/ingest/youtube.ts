import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const CHANNEL_ID = 'UC6t1O76G0jYXOAoYCm153dA';
export const CHANNEL_URL = 'https://www.youtube.com/@LennysPodcast/videos';
export const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

export interface Video {
  id: string;
  title: string;
  durationSeconds?: number;
  publishDate?: string;
  description?: string;
  viewCount?: number;
}

function unescapeXml(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function tag(entry: string, name: string): string | undefined {
  const match = entry.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`));
  return match ? unescapeXml(match[1]!.trim()) : undefined;
}

/** Parse YouTube's channel RSS (newest 15 uploads, no bot checks, no API key). */
export function parseRss(xml: string): Video[] {
  return xml
    .split('<entry>')
    .slice(1)
    .map((entry) => {
      const views = entry.match(/<media:statistics[^>]*views="(\d+)"/);
      const published = tag(entry, 'published');
      return {
        id: tag(entry, 'yt:videoId') ?? '',
        title: tag(entry, 'title') ?? '',
        publishDate: published ? published.slice(0, 10) : undefined,
        description: tag(entry, 'media:description'),
        viewCount: views ? Number(views[1]) : undefined
      };
    })
    .filter((v) => v.id && v.title);
}

export async function fetchRssVideos(fetchImpl: typeof fetch = fetch): Promise<Video[]> {
  const response = await fetchImpl(RSS_URL);
  if (!response.ok) throw new Error(`RSS fetch failed: HTTP ${response.status}`);
  return parseRss(await response.text());
}

interface FlatEntry {
  id?: string;
  title?: string;
  duration?: number | null;
}

/** Full channel listing via yt-dlp. Returns [] when yt-dlp is missing or blocked. */
export async function fetchChannelVideos(log: (m: string) => void): Promise<Video[]> {
  try {
    const { stdout } = await execFileAsync('yt-dlp', ['--flat-playlist', '--dump-json', CHANNEL_URL], {
      maxBuffer: 64 * 1024 * 1024
    });
    return stdout
      .split('\n')
      .filter((line) => line.trim())
      .map((line) => JSON.parse(line) as FlatEntry)
      .filter((e) => e.id && e.title)
      .map((e) => ({ id: e.id!, title: e.title!, durationSeconds: e.duration ?? undefined }));
  } catch (error) {
    log(`yt-dlp channel listing unavailable (${(error as Error).message.split('\n')[0]}); using RSS only`);
    return [];
  }
}

interface FullEntry {
  title?: string;
  upload_date?: string;
  description?: string;
  duration?: number;
  view_count?: number;
}

/** Per-video metadata via yt-dlp. Returns null when unavailable. */
export async function enrichVideo(id: string, log: (m: string) => void): Promise<Video | null> {
  try {
    const { stdout } = await execFileAsync('yt-dlp', ['--skip-download', '--dump-json', `https://www.youtube.com/watch?v=${id}`], {
      maxBuffer: 16 * 1024 * 1024
    });
    const e = JSON.parse(stdout) as FullEntry;
    const d = e.upload_date;
    return {
      id,
      title: e.title ?? '',
      durationSeconds: e.duration,
      publishDate: d && d.length === 8 ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : undefined,
      description: e.description,
      viewCount: e.view_count
    };
  } catch (error) {
    log(`yt-dlp enrich failed for ${id}: ${(error as Error).message.split('\n')[0]}`);
    return null;
  }
}
