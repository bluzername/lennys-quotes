#!/usr/bin/env node
/**
 * Ingest new Lenny's Podcast episodes into episodes/{slug}/transcript.md.
 *
 * Text comes from Lenny's public Dropbox folder (official transcripts, speaker-labelled).
 * Metadata comes from the channel RSS feed (newest 15, always works) and, when
 * available, yt-dlp (full channel listing and per-video details).
 *
 *   npm run sync -- --dry-run          show the plan, write nothing
 *   npm run sync -- --limit 3          cap new episodes (testing)
 *   npm run sync -- --dropbox-dir DIR  use already-extracted .txt files
 *   npm run sync -- --backfill         fill missing publish_date/view_count on existing episodes
 *   npm run sync -- --episodes-dir DIR write to a different episodes folder (tests)
 */
import { mkdir, mkdtemp, readdir, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import matter from 'gray-matter';
import { fetchDropboxTranscripts, readTranscriptDir, type DropboxTranscript } from '../ingest/dropbox.js';
import { buildVideoIndex, matchVideo, NON_INTERVIEW } from '../ingest/match.js';
import { norm, slugify } from '../ingest/names.js';
import { buildFrontmatter, renderTranscript } from '../ingest/write-transcript.js';
import { enrichVideo, fetchChannelVideos, fetchRssVideos, type Video } from '../ingest/youtube.js';

const log = (message: string): void => console.error(message);

const { values: args } = parseArgs({
  options: {
    'dry-run': { type: 'boolean', default: false },
    'dropbox-dir': { type: 'string' },
    limit: { type: 'string', default: '0' },
    backfill: { type: 'boolean', default: false },
    'episodes-dir': { type: 'string' }
  }
});

const root = path.resolve(new URL('../..', import.meta.url).pathname);
const episodesDir = args['episodes-dir'] ? path.resolve(args['episodes-dir']) : path.join(root, 'episodes');
const limit = Number(args.limit) || 0;

interface Existing {
  slugs: Set<string>;
  norms: Set<string>;
  usedIds: Set<string>;
}

async function readExisting(): Promise<Existing> {
  const slugs = new Set<string>();
  const norms = new Set<string>();
  const usedIds = new Set<string>();
  for (const slug of await readdir(episodesDir).catch(() => [] as string[])) {
    slugs.add(slug);
    norms.add(norm(slug));
    const file = path.join(episodesDir, slug, 'transcript.md');
    const head = await readFile(file, 'utf8').then((t) => t.slice(0, 2000)).catch(() => '');
    const id = head.match(/^video_id:\s*(\S+)/m)?.[1];
    if (id) usedIds.add(id.replace(/^['"]|['"]$/g, ''));
  }
  return { slugs, norms, usedIds };
}

function mergeVideos(rss: Video[], channel: Video[]): Video[] {
  const byId = new Map<string, Video>();
  for (const v of [...channel, ...rss]) byId.set(v.id, { ...byId.get(v.id), ...v });
  // channel order is newest first; RSS-only ids (if any) go in front since they are newest
  const ordered = [...rss.filter((v) => !channel.some((c) => c.id === v.id)), ...channel];
  return ordered.map((v) => byId.get(v.id)!);
}

async function completeVideo(video: Video): Promise<Video> {
  if (video.publishDate && video.viewCount !== undefined && video.description) return video;
  const enriched = await enrichVideo(video.id, log);
  return enriched ? { ...enriched, ...stripUndefined(video) } : video;
}

function stripUndefined<T extends object>(value: T): Partial<T> {
  return Object.fromEntries(Object.entries(value).filter(([, v]) => v !== undefined)) as Partial<T>;
}

async function ingestNew(transcripts: DropboxTranscript[], videos: Video[], existing: Existing): Promise<number> {
  const index = buildVideoIndex(videos);
  let fresh = transcripts.filter((t) => !existing.slugs.has(slugify(t.name)) && !existing.norms.has(norm(t.name)));
  log(`Dropbox transcripts: ${transcripts.length} | existing episodes: ${existing.slugs.size} | new: ${fresh.length}`);
  if (limit > 0) fresh = fresh.slice(0, limit);

  let written = 0;
  for (const item of fresh) {
    const slug = slugify(item.name);
    const nonInterview = NON_INTERVIEW.has(norm(item.name));
    const matched = nonInterview ? null : matchVideo(item.name, index, existing.usedIds);
    const video = matched ? await completeVideo(matched) : null;
    if (!video && !nonInterview) log(`  ! no YouTube match for "${item.name}" (ingesting without video link)`);
    if (video) existing.usedIds.add(video.id);

    const fm = buildFrontmatter(item.name, video);
    const target = path.join(episodesDir, slug, 'transcript.md');
    log(`  + ${slug}  <-  ${video ? `${video.id} ${video.publishDate ?? '(no date)'}` : 'no video'}  "${fm.title}"`);
    if (args['dry-run']) continue;
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, renderTranscript(fm, item.text));
    written += 1;
  }
  return written;
}

/** Fill missing metadata on existing episodes; also retries the video match for episodes that never got one. */
async function backfill(videos: Video[], existing: Existing): Promise<number> {
  const byId = new Map(videos.map((v) => [v.id, v]));
  const index = buildVideoIndex(videos);
  let updated = 0;
  for (const slug of await readdir(episodesDir)) {
    const file = path.join(episodesDir, slug, 'transcript.md');
    const raw = await readFile(file, 'utf8').catch(() => null);
    if (!raw) continue;
    const parsed = matter(raw);
    const data = parsed.data as Record<string, unknown>;
    const guest = String(data.guest ?? slug);
    let id = typeof data.video_id === 'string' ? data.video_id : '';
    if (!id && !NON_INTERVIEW.has(norm(guest))) {
      const rematched = matchVideo(guest, index, existing.usedIds);
      if (rematched) {
        id = rematched.id;
        existing.usedIds.add(id);
        log(`  ~ ${slug}: matched video ${id}`);
      }
    }
    if (!id || (data.publish_date && data.view_count !== undefined)) continue;

    const video = await completeVideo(byId.get(id) ?? { id, title: String(data.title ?? '') });
    const next = { ...data };
    if (!data.video_id || data.video_id === '') Object.assign(next, buildFrontmatter(guest, video), { keywords: data.keywords ?? [] });
    if (!next.publish_date && video.publishDate) next.publish_date = video.publishDate;
    if (next.view_count === undefined && video.viewCount !== undefined) next.view_count = video.viewCount;
    if (!next.description && video.description) next.description = video.description.split('\n', 1)[0];
    if (JSON.stringify(next) === JSON.stringify(data)) continue;
    log(`  ~ ${slug}: filled ${Object.keys(next).filter((k) => !(k in data)).join(', ')}`);
    updated += 1;
    if (!args['dry-run']) await writeFile(file, matter.stringify(parsed.content, next));
  }
  return updated;
}

async function main(): Promise<void> {
  const workdir = await mkdtemp(path.join(os.tmpdir(), 'lenny-sync-'));
  const transcripts = args['dropbox-dir'] ? await readTranscriptDir(args['dropbox-dir']) : await fetchDropboxTranscripts(workdir);
  const [rss, channel] = await Promise.all([fetchRssVideos(), fetchChannelVideos(log)]);
  log(`YouTube: ${rss.length} from RSS, ${channel.length} from channel listing`);
  const videos = mergeVideos(rss, channel);

  const existing = await readExisting();
  const written = await ingestNew(transcripts, videos, existing);
  const updated = args.backfill ? await backfill(videos, existing) : 0;
  log(`${args['dry-run'] ? '[dry run] ' : ''}wrote ${written} new episode(s), updated ${updated}`);
}

main().catch((error: unknown) => {
  log(`sync failed: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  process.exit(1);
});
