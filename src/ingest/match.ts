import { guestFromTitle, norm, stripVersion } from './names.js';
import type { Video } from './youtube.js';

/** Episodes whose YouTube title omits the guest name; keyed by Dropbox filename stem. */
export const VIDEO_OVERRIDES: Record<string, string> = {
  'Sam Lessin': 'KtKJ3A6DWTs',
  'Max Schoenig': 'mCO-D3pkviM',
  'Michelle Rial': 'mlbWjGZiG20',
  'Daniel Lereya': 'L9qqwV8_rvY',
  'Peter Deng': '8TpakBfsmcQ'
};

/** Dropbox files that are not single-guest interviews; ingest without expecting a video match. */
export const NON_INTERVIEW = new Set(['failure', 'eoyreview', 'teaser2021', 'interviewqcompilation']);

export type VideoIndex = Map<string, Video[]>;

const MIN_CONTAINMENT_KEY = 7;

/** guest norm -> videos, preserving input order (newest first when fed a channel listing). */
export function buildVideoIndex(videos: Video[]): VideoIndex {
  const index: VideoIndex = new Map();
  for (const video of videos) {
    const guest = guestFromTitle(video.title);
    if (!guest) continue;
    const key = norm(guest);
    const list = index.get(key) ?? [];
    index.set(key, [...list, video]);
  }
  return index;
}

function containmentCandidates(key: string, index: VideoIndex): Video[] | undefined {
  let best: [string, Video[]] | undefined;
  for (const [candidateKey, videos] of index) {
    if (candidateKey.length < MIN_CONTAINMENT_KEY || key.length < MIN_CONTAINMENT_KEY) continue;
    if (!(candidateKey.includes(key) || key.includes(candidateKey))) continue;
    if (!best || candidateKey.length > best[0].length) best = [candidateKey, videos];
  }
  return best?.[1];
}

/** Best video for a Dropbox transcript name, skipping videos already assigned to other episodes. */
export function matchVideo(name: string, index: VideoIndex, usedIds: Set<string>): Video | null {
  const override = VIDEO_OVERRIDES[name];
  if (override) return { id: override, title: name };

  const key = norm(stripVersion(name));
  const candidates = index.get(key) ?? containmentCandidates(key, index);
  if (!candidates || candidates.length === 0) return null;
  return candidates.find((v) => !usedIds.has(v.id)) ?? candidates[0]!;
}
